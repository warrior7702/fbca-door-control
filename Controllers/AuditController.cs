using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using FBCADoorControl.Data;
using FBCADoorControl.Models;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace FBCADoorControl.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuditController : ControllerBase
    {
        private readonly DoorControlDbContext _context;
        private readonly ILogger<AuditController> _logger;

        public AuditController(DoorControlDbContext context, ILogger<AuditController> logger)
        {
            _context = context;
            _logger = logger;
        }

        [HttpGet]
        public async Task<ActionResult> GetAuditLogs(
            [FromQuery] int hours = 168,
            [FromQuery] string? actionType = null,
            [FromQuery] bool? success = null,
            [FromQuery] int limit = 100)
        {
            try
            {
                var cutoff = DateTime.Now.AddHours(-hours);
                
                var query = _context.AuditLogs
                    .Where(log => log.Timestamp >= cutoff);
                
                if (!string.IsNullOrEmpty(actionType))
                {
                    query = query.Where(log => log.ActionType == actionType);
                }
                
                if (success.HasValue)
                {
                    query = query.Where(log => log.Success == success.Value);
                }
                
                var logs = await query
                    .OrderByDescending(log => log.Timestamp)
                    .Take(limit)
                    .Select(log => new {
                        log.LogID,
                        log.Timestamp,
                        log.ActionType,
                        log.UserEmail,
                        log.UserName,
                        log.DoorName,
                        log.EventName,
                        log.Success,
                        log.ErrorMessage
                    })
                    .ToListAsync();
                
                return Ok(logs);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to retrieve audit logs");
                return StatusCode(500, new { error = "Failed to load audit logs" });
            }
        }
    }
}
