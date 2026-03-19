using System.Net;

namespace FBCADoorControl.Services;

/// <summary>
/// Service for interacting with MonitorCast Quick Controls API.
/// Manages session cookies, authentication, and door control commands.
/// </summary>
public class QuickControlsService : IQuickControlsService
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private readonly ILogger<QuickControlsService> _logger;
    private readonly CookieContainer _cookieContainer;
    
    private string BaseUrl => _configuration["MonitorCast:BaseUrl"] ?? "http://localhost:8080";
    private string Username => _configuration["MonitorCast:Username"] ?? "admin";
    private string Password => _configuration["MonitorCast:Password"] ?? "";
    private int RetryAttempts => _configuration.GetValue<int>("MonitorCast:RetryAttempts", 3);
    private int RetryDelaySeconds => _configuration.GetValue<int>("MonitorCast:RetryDelaySeconds", 5);
    
    private DateTime? _lastAuthTime;
    private readonly TimeSpan _sessionTimeout = TimeSpan.FromMinutes(30);

    public QuickControlsService(
        HttpClient httpClient,
        IConfiguration configuration,
        ILogger<QuickControlsService> logger,
        CookieContainer cookieContainer)
    {
        _httpClient = httpClient;
        _configuration = configuration;
        _logger = logger;
        _cookieContainer = cookieContainer; // Use shared singleton instance
        
        // Configure HttpClient handler with cookie support
        ConfigureHttpClient();
    }

    private void ConfigureHttpClient()
    {
        _httpClient.BaseAddress = new Uri(BaseUrl);
        _httpClient.Timeout = TimeSpan.FromSeconds(30);
    }

    public async Task<bool> UnlockDoorAsync(int viaDeviceId)
    {
        var response = await ExecuteActionAsync(viaDeviceId, "unlock");
        return response.Success;
    }

    public async Task<bool> LockDoorAsync(int viaDeviceId)
    {
        var response = await ExecuteActionAsync(viaDeviceId, "lock");
        return response.Success;
    }

    public async Task<QuickControlsResponse> ExecuteActionAsync(int viaDeviceId, string action)
    {
        // FIX: Always ensure fresh authentication before executing actions
        // This prevents issues with expired MonitorCast sessions
        if (!await IsAuthenticatedAsync())
        {
            _logger.LogInformation("Session expired or not authenticated, re-authenticating...");
            
            // Clear any stale cookies before re-authenticating
            ClearCookies();
            
            if (!await AuthenticateAsync())
            {
                return new QuickControlsResponse
                {
                    Success = false,
                    ErrorMessage = "Failed to authenticate to MonitorCast",
                    StatusCode = 401
                };
            }
        }

        // Execute with retry logic
        for (int attempt = 1; attempt <= RetryAttempts; attempt++)
        {
            try
            {
                _logger.LogInformation(
                    "Executing Quick Controls: {Action} door {DeviceId} (attempt {Attempt}/{Max})",
                    action, viaDeviceId, attempt, RetryAttempts);

                // FIX: Use correct MonitorCast field names (from working DoorHealth app)
                // MonitorCast expects: btnUnlock (no "Door") but btnLockDoor (WITH "Door"!) - inconsistent API!
                // Device ID field: ReadersSelectedList
                var fields = new List<KeyValuePair<string, string>>();
                
                if (action.Equals("unlock", StringComparison.OrdinalIgnoreCase))
                {
                    fields.Add(new KeyValuePair<string, string>("btnUnlock", "true"));
                }
                else
                {
                    fields.Add(new KeyValuePair<string, string>("btnLockDoor", "true"));
                }
                
                fields.Add(new KeyValuePair<string, string>("ReadersSelectedList", viaDeviceId.ToString()));
                fields.Add(new KeyValuePair<string, string>("s", ""));

                var requestContent = new FormUrlEncodedContent(fields);

                var request = new HttpRequestMessage(HttpMethod.Post, "/Dashboard/LockUnlockDoor")
                {
                    Content = requestContent
                };
                
                // Add required headers
                request.Headers.TryAddWithoutValidation("Accept", "*/*");
                request.Headers.TryAddWithoutValidation("X-Requested-With", "XMLHttpRequest");
                request.Headers.TryAddWithoutValidation("Origin", BaseUrl.TrimEnd('/'));
                request.Headers.TryAddWithoutValidation("Referer", BaseUrl.TrimEnd('/') + "/Dashboard");

                var response = await _httpClient.SendAsync(request);
                var responseBody = await response.Content.ReadAsStringAsync();

                // FIX: Handle ANY non-success as potential session error, not just 401
                // HTTP 306 (Unused) and other errors can occur when MonitorCast session expires
                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning(
                        "Quick Controls request failed: {StatusCode} ({ReasonPhrase}) - {Response}",
                        response.StatusCode, response.ReasonPhrase, responseBody);

                    // Clear auth state on ANY failure to force fresh authentication
                    _lastAuthTime = null;
                    ClearCookies();

                    // On last attempt, return failure
                    if (attempt >= RetryAttempts)
                    {
                        return new QuickControlsResponse
                        {
                            Success = false,
                            StatusCode = (int)response.StatusCode,
                            ResponseBody = responseBody,
                            ErrorMessage = $"HTTP {response.StatusCode}: {response.ReasonPhrase}"
                        };
                    }

                    // Re-authenticate and retry
                    _logger.LogInformation("Re-authenticating before retry...");
                    if (!await AuthenticateAsync())
                    {
                        _logger.LogError("Re-authentication failed, aborting retry");
                        return new QuickControlsResponse
                        {
                            Success = false,
                            StatusCode = (int)response.StatusCode,
                            ResponseBody = responseBody,
                            ErrorMessage = $"HTTP {response.StatusCode}: {response.ReasonPhrase} (re-auth failed)"
                        };
                    }

                    await Task.Delay(TimeSpan.FromSeconds(RetryDelaySeconds));
                    continue; // Retry with new session
                }

                // Success!
                _logger.LogInformation(
                    "Successfully executed {Action} for door {DeviceId}",
                    action, viaDeviceId);
                
                return new QuickControlsResponse
                {
                    Success = true,
                    StatusCode = (int)response.StatusCode,
                    ResponseBody = responseBody
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "Exception executing Quick Controls {Action} for door {DeviceId} (attempt {Attempt})",
                    action, viaDeviceId, attempt);

                if (attempt >= RetryAttempts)
                {
                    return new QuickControlsResponse
                    {
                        Success = false,
                        ErrorMessage = ex.Message,
                        StatusCode = 500
                    };
                }

                await Task.Delay(TimeSpan.FromSeconds(RetryDelaySeconds));
            }
        }

        return new QuickControlsResponse
        {
            Success = false,
            ErrorMessage = "Max retry attempts exceeded",
            StatusCode = 500
        };
    }

    public async Task<bool> AuthenticateAsync()
    {
        try
        {
            _logger.LogInformation("Authenticating to MonitorCast at {BaseUrl}", BaseUrl);

            // MonitorCast login form posts to root (/) with UserName, Password, and LoginType fields
            // Field names are case-sensitive and must match the form exactly
            var loginContent = new FormUrlEncodedContent(new[]
            {
                new KeyValuePair<string, string>("UserName", Username),
                new KeyValuePair<string, string>("Password", Password),
                new KeyValuePair<string, string>("LoginType", "1")
            });

            var response = await _httpClient.PostAsync("/", loginContent);
            
            if (response.IsSuccessStatusCode)
            {
                // MonitorCast returns 200 OK on successful login
                // Cookies are automatically stored in the CookieContainer by HttpClient
                _logger.LogInformation("MonitorCast authentication successful (HTTP {StatusCode})", response.StatusCode);
                _lastAuthTime = DateTime.UtcNow;
                return true;
            }

            _logger.LogError(
                "MonitorCast authentication failed: {StatusCode} - {Reason}",
                response.StatusCode, response.ReasonPhrase);
            return false;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Exception during MonitorCast authentication");
            return false;
        }
    }

    public Task<bool> IsAuthenticatedAsync()
    {
        // Check if we have authenticated recently (within session timeout)
        if (_lastAuthTime.HasValue)
        {
            var timeSinceAuth = DateTime.UtcNow - _lastAuthTime.Value;
            bool isValid = timeSinceAuth < _sessionTimeout;
            
            if (!isValid)
            {
                _logger.LogInformation(
                    "Session timeout detected: {TimeSinceAuth} > {Timeout}",
                    timeSinceAuth, _sessionTimeout);
            }
            
            return Task.FromResult(isValid);
        }

        return Task.FromResult(false);
    }

    /// <summary>
    /// Clear all cookies from the cookie container.
    /// Used to ensure fresh authentication when session is suspected to be invalid.
    /// </summary>
    private void ClearCookies()
    {
        try
        {
            // Get all cookies and remove them
            var cookies = _cookieContainer.GetCookies(new Uri(BaseUrl));
            foreach (System.Net.Cookie cookie in cookies)
            {
                cookie.Expired = true;
            }
            _logger.LogDebug("Cleared cookie container");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to clear cookies");
        }
    }
}
