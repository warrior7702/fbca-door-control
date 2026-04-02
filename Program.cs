using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.Identity.Web;
using Microsoft.Identity.Web.UI;
using Microsoft.EntityFrameworkCore;
using FBCADoorControl.Data;
using FBCADoorControl.Services;

var builder = WebApplication.CreateBuilder(args);

// Add Azure AD Authentication
builder.Services.AddAuthentication(OpenIdConnectDefaults.AuthenticationScheme)
    .AddMicrosoftIdentityWebApp(builder.Configuration.GetSection("AzureAd"));

builder.Services.AddControllersWithViews()
    .AddMicrosoftIdentityUI();

builder.Services.AddRazorPages();

builder.Services.AddAuthorization(options =>
{
    // Define policies
    options.AddPolicy("Admin", policy => policy.RequireRole("Admin"));
    options.AddPolicy("Viewer", policy => policy.RequireRole("Viewer", "Admin"));
});

// Add services to the container
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
        options.JsonSerializerOptions.DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull;
    });
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Configure database contexts
builder.Services.AddDbContext<DoorControlDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("FBCADoorControl")));

builder.Services.AddDbContext<VIACDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("VIAC")));

// Register services
var sharedCookieContainer = new System.Net.CookieContainer();
builder.Services.AddSingleton(sharedCookieContainer);

builder.Services.AddScoped<IQuickControlsService, QuickControlsService>();
builder.Services.AddScoped<IDoorSyncService, DoorSyncService>();
builder.Services.AddScoped<ICameraService, CameraService>();
// RecurrenceService removed
builder.Services.AddHttpClient<IQuickControlsService, QuickControlsService>()
    .ConfigurePrimaryHttpMessageHandler(sp => new HttpClientHandler
    {
        UseCookies = true,
        CookieContainer = sp.GetRequiredService<System.Net.CookieContainer>(),
        AllowAutoRedirect = true
    });

// Register background services
builder.Services.AddHostedService<SchedulerService>();

// Configure Kestrel
builder.WebHost.ConfigureKestrel(options =>
{
    options.ListenAnyIP(5002);
});

// Add CORS for local development
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

var app = builder.Build();

// Configure the HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors();
app.UseStaticFiles();

// Add authentication & authorization middleware
app.UseAuthentication();
app.UseAuthorization();

// Map routes
app.MapControllers();
app.MapRazorPages();

// Default route redirects to calendar
// NOTE: Authentication is NOT required for API endpoints (scheduler needs them)
// Only the UI pages require auth (see Controllers for [Authorize] attributes)
app.MapGet("/", () => Results.Redirect("/calendar.html"));

app.Run();
