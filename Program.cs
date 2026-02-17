using Microsoft.EntityFrameworkCore;
using FBCADoorControl.Data;
using FBCADoorControl.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        // Ensure DateTimes are serialized as UTC with Z suffix
        options.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
        // This ensures DateTime values are treated as UTC in JSON output
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
// CRITICAL: Use singleton CookieContainer so all requests share the same MonitorCast session
var sharedCookieContainer = new System.Net.CookieContainer();
builder.Services.AddSingleton(sharedCookieContainer);

builder.Services.AddScoped<IQuickControlsService, QuickControlsService>();
builder.Services.AddScoped<IDoorSyncService, DoorSyncService>();
builder.Services.AddScoped<RecurrenceService>();
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
    options.ListenAnyIP(5002); // Port 5002, accessible from network
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
app.UseStaticFiles(); // Serve wwwroot files (FullCalendar UI)
app.UseAuthorization();
app.MapControllers();

// Default route redirects to calendar
app.MapGet("/", () => Results.Redirect("/calendar.html"));

app.Run();
