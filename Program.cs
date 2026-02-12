using Microsoft.EntityFrameworkCore;
using FBCADoorControl.Data;
using FBCADoorControl.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Configure database contexts
builder.Services.AddDbContext<DoorControlDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("FBCADoorControl")));

builder.Services.AddDbContext<VIACDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("VIAC")));

// Register services
builder.Services.AddScoped<IQuickControlsService, QuickControlsService>();
builder.Services.AddScoped<IDoorSyncService, DoorSyncService>();
builder.Services.AddHttpClient<IQuickControlsService, QuickControlsService>();

// Register background services
builder.Services.AddHostedService<SchedulerService>();

// Configure Kestrel
builder.WebHost.ConfigureKestrel(options =>
{
    options.ListenLocalhost(5002); // Port 5002 as per Billy's specification
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
