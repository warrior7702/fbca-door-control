using FBCADoorControl.Models;
using FBCADoorControl.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FBCADoorControl.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class CameraController : ControllerBase
    {
        private readonly ICameraService _cameraService;
        private readonly ILogger<CameraController> _logger;

        public CameraController(ICameraService cameraService, ILogger<CameraController> logger)
        {
            _cameraService = cameraService;
            _logger = logger;
        }

        /// <summary>
        /// Get all cameras from Spot AI
        /// </summary>
        [HttpGet("spotai")]
        public async Task<ActionResult<List<SpotAICamera>>> GetAllSpotAICameras()
        {
            var cameras = await _cameraService.GetAllSpotAICamerasAsync();
            return Ok(cameras);
        }

        /// <summary>
        /// Get a specific camera from Spot AI by ID
        /// </summary>
        [HttpGet("spotai/{cameraId}")]
        public async Task<ActionResult<SpotAICamera>> GetSpotAICameraById(string cameraId)
        {
            var camera = await _cameraService.GetSpotAICameraByIdAsync(cameraId);
            if (camera == null)
                return NotFound(new { message = $"Camera {cameraId} not found" });
            
            return Ok(camera);
        }

        /// <summary>
        /// Generate an embeddable live feed URL for a camera
        /// </summary>
        [HttpPost("{cameraId}/embed")]
        public async Task<ActionResult<SpotAIEmbedResponse>> GenerateLiveEmbedUrl(string cameraId, [FromQuery] int expirySeconds = 3600)
        {
            var embedData = await _cameraService.GenerateLiveEmbedUrlAsync(cameraId, expirySeconds);
            if (embedData == null)
                return BadRequest(new { message = "Failed to generate embed URL" });
            
            return Ok(embedData);
        }

        /// <summary>
        /// Get all door-camera mappings
        /// </summary>
        [HttpGet("mappings")]
        public async Task<ActionResult<List<DoorCameraDto>>> GetAllDoorCameraMappings()
        {
            var mappings = await _cameraService.GetAllDoorCamerasAsync();
            return Ok(mappings);
        }

        /// <summary>
        /// Get camera for a specific door
        /// </summary>
        [HttpGet("door/{doorId}")]
        public async Task<ActionResult<DoorCameraDto>> GetCameraForDoor(int doorId)
        {
            var mapping = await _cameraService.GetDoorCameraByDoorIdAsync(doorId);
            if (mapping == null)
                return NotFound(new { message = $"No camera mapped to door {doorId}" });
            
            return Ok(mapping);
        }

        /// <summary>
        /// Get live embed URL for a door's camera
        /// </summary>
        [HttpPost("door/{doorId}/embed")]
        public async Task<ActionResult<SpotAIEmbedResponse>> GetDoorCameraEmbed(int doorId, [FromQuery] int expirySeconds = 3600)
        {
            // Get door's camera mapping
            var mapping = await _cameraService.GetDoorCameraByDoorIdAsync(doorId);
            if (mapping == null)
                return NotFound(new { message = $"No camera mapped to door {doorId}" });
            
            // Generate embed URL
            var embedData = await _cameraService.GenerateLiveEmbedUrlAsync(mapping.SpotAICameraID, expirySeconds);
            if (embedData == null)
                return BadRequest(new { message = "Failed to generate embed URL" });
            
            return Ok(embedData);
        }

        /// <summary>
        /// Create a new door-camera mapping
        /// </summary>
        [HttpPost("mappings")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<DoorCamera>> CreateDoorCameraMapping(
            [FromBody] CreateDoorCameraMappingRequest request)
        {
            try
            {
                var mapping = await _cameraService.CreateDoorCameraMappingAsync(
                    request.DoorID, 
                    request.SpotAICameraID, 
                    request.CameraName
                );
                
                return CreatedAtAction(
                    nameof(GetCameraForDoor), 
                    new { doorId = mapping.DoorID }, 
                    mapping
                );
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return Conflict(new { message = ex.Message });
            }
        }

        /// <summary>
        /// Delete a door-camera mapping
        /// </summary>
        [HttpDelete("door/{doorId}")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult> DeleteDoorCameraMapping(int doorId)
        {
            var success = await _cameraService.DeleteDoorCameraMappingAsync(doorId);
            if (!success)
                return NotFound(new { message = $"No camera mapping found for door {doorId}" });
            
            return NoContent();
        }
    }

    public class CreateDoorCameraMappingRequest
    {
        public int DoorID { get; set; }
        public string SpotAICameraID { get; set; } = string.Empty;
        public string CameraName { get; set; } = string.Empty;
    }
}
