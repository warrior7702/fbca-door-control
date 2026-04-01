using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Threading.Tasks;
using FBCADoorControl.Data;
using FBCADoorControl.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace FBCADoorControl.Services
{
    public interface ICameraService
    {
        Task<List<SpotAICamera>> GetAllSpotAICamerasAsync();
        Task<SpotAICamera?> GetSpotAICameraByIdAsync(string cameraId);
        Task<SpotAIEmbedResponse?> GenerateLiveEmbedUrlAsync(string cameraId, int expirySeconds = 3600);
        Task<List<DoorCameraDto>> GetAllDoorCamerasAsync();
        Task<DoorCameraDto?> GetDoorCameraByDoorIdAsync(int doorId);
        Task<DoorCamera> CreateDoorCameraMappingAsync(int doorId, string spotAICameraId, string cameraName);
        Task<bool> DeleteDoorCameraMappingAsync(int doorId);
    }

    public class CameraService : ICameraService
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly DoorControlDbContext _context;
        private readonly IConfiguration _configuration;
        private readonly ILogger<CameraService> _logger;
        private readonly string _spotAIApiKey;
        private readonly string _spotAIBaseUrl;

        public CameraService(
            IHttpClientFactory httpClientFactory,
            DoorControlDbContext context,
            IConfiguration configuration,
            ILogger<CameraService> logger)
        {
            _httpClientFactory = httpClientFactory;
            _context = context;
            _configuration = configuration;
            _logger = logger;
            _spotAIApiKey = _configuration["SpotAI:ApiKey"] ?? throw new InvalidOperationException("SpotAI:ApiKey not configured");
            _spotAIBaseUrl = _configuration["SpotAI:BaseUrl"] ?? "https://dev-api.spot.ai";
        }

        private HttpClient CreateSpotAIClient()
        {
            var client = _httpClientFactory.CreateClient();
            client.BaseAddress = new Uri(_spotAIBaseUrl);
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", _spotAIApiKey);
            return client;
        }

        public async Task<List<SpotAICamera>> GetAllSpotAICamerasAsync()
        {
            try
            {
                using var client = CreateSpotAIClient();
                var response = await client.GetFromJsonAsync<SpotAICameraListResponse>("/v1/cameras");
                return response?.cameras ?? new List<SpotAICamera>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to fetch cameras from Spot AI");
                return new List<SpotAICamera>();
            }
        }

        public async Task<SpotAICamera?> GetSpotAICameraByIdAsync(string cameraId)
        {
            try
            {
                using var client = CreateSpotAIClient();
                return await client.GetFromJsonAsync<SpotAICamera>($"/v1/cameras/{cameraId}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to fetch camera {CameraId} from Spot AI", cameraId);
                return null;
            }
        }

        public async Task<SpotAIEmbedResponse?> GenerateLiveEmbedUrlAsync(string cameraId, int expirySeconds = 3600)
        {
            try
            {
                using var client = CreateSpotAIClient();
                
                // Use POST /v1/embeds/live per Spot.ai v1 API docs
                _logger.LogInformation("Calling Spot AI embed API for camera {CameraId}", cameraId);
                
                var requestBody = new { camera_id = int.Parse(cameraId) };
                var response = await client.PostAsJsonAsync("/v1/embeds/live", requestBody);
                
                var responseBody = await response.Content.ReadAsStringAsync();
                _logger.LogInformation("Spot AI response: {Response}", responseBody);
                
                response.EnsureSuccessStatusCode();
                
                var embedResponse = await response.Content.ReadFromJsonAsync<SpotAIEmbedResponse>();
                _logger.LogInformation("Deserialized embed response: url={Url}", embedResponse?.url);
                
                // Validate response has actual URL
                if (string.IsNullOrEmpty(embedResponse?.url))
                {
                    _logger.LogWarning("Spot AI returned empty URL for camera {CameraId}", cameraId);
                    return null;
                }
                
                return embedResponse;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to generate embed URL for camera {CameraId}", cameraId);
                return null;
            }
        }

        public async Task<List<DoorCameraDto>> GetAllDoorCamerasAsync()
        {
            return await _context.DoorCameras
                .Include(dc => dc.Door)
                .Where(dc => dc.IsActive)
                .Select(dc => new DoorCameraDto
                {
                    DoorID = dc.DoorID,
                    DoorName = dc.Door != null ? dc.Door.DoorName : "",
                    SpotAICameraID = dc.SpotAICameraID,
                    CameraName = dc.CameraName,
                    Building = dc.Building,
                    Location = dc.Location,
                    IsActive = dc.IsActive
                })
                .ToListAsync();
        }

        public async Task<DoorCameraDto?> GetDoorCameraByDoorIdAsync(int doorId)
        {
            return await _context.DoorCameras
                .Include(dc => dc.Door)
                .Where(dc => dc.DoorID == doorId && dc.IsActive)
                .Select(dc => new DoorCameraDto
                {
                    DoorID = dc.DoorID,
                    DoorName = dc.Door != null ? dc.Door.DoorName : "",
                    SpotAICameraID = dc.SpotAICameraID,
                    CameraName = dc.CameraName,
                    Building = dc.Building,
                    Location = dc.Location,
                    IsActive = dc.IsActive
                })
                .FirstOrDefaultAsync();
        }

        public async Task<DoorCamera> CreateDoorCameraMappingAsync(int doorId, string spotAICameraId, string cameraName)
        {
            // Verify door exists
            var door = await _context.Doors.FindAsync(doorId);
            if (door == null)
                throw new ArgumentException($"Door with ID {doorId} not found");

            // Check if mapping already exists
            var existing = await _context.DoorCameras.FirstOrDefaultAsync(dc => dc.DoorID == doorId);
            if (existing != null)
                throw new InvalidOperationException($"Door {doorId} already has a camera mapping");

            var doorCamera = new DoorCamera
            {
                DoorID = doorId,
                SpotAICameraID = spotAICameraId,
                CameraName = cameraName,
                Building = door.ControllerName ?? "",
                Location = door.DoorName ?? "",
                IsActive = true,
                CreatedAt = DateTime.Now,
                UpdatedAt = DateTime.Now
            };

            _context.DoorCameras.Add(doorCamera);
            await _context.SaveChangesAsync();

            return doorCamera;
        }

        public async Task<bool> DeleteDoorCameraMappingAsync(int doorId)
        {
            var doorCamera = await _context.DoorCameras.FirstOrDefaultAsync(dc => dc.DoorID == doorId);
            if (doorCamera == null)
                return false;

            _context.DoorCameras.Remove(doorCamera);
            await _context.SaveChangesAsync();
            return true;
        }
    }
}
