using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace FBCADoorControl.Models
{
    [Table("DoorCameras")]
    public class DoorCamera
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int DoorCameraID { get; set; }

        [Required]
        public int DoorID { get; set; }

        [Required]
        [StringLength(100)]
        public string SpotAICameraID { get; set; } = string.Empty;

        [Required]
        [StringLength(200)]
        public string CameraName { get; set; } = string.Empty;

        [StringLength(100)]
        public string? Building { get; set; }

        [StringLength(200)]
        public string? Location { get; set; }

        public bool IsActive { get; set; } = true;

        public DateTime CreatedAt { get; set; } = DateTime.Now;

        public DateTime UpdatedAt { get; set; } = DateTime.Now;

        // Navigation property
        [ForeignKey("DoorID")]
        public virtual Door? Door { get; set; }
    }

    // DTO for API responses
    public class DoorCameraDto
    {
        public int DoorID { get; set; }
        public string DoorName { get; set; } = string.Empty;
        public string SpotAICameraID { get; set; } = string.Empty;
        public string CameraName { get; set; } = string.Empty;
        public string? Building { get; set; }
        public string? Location { get; set; }
        public bool IsActive { get; set; }
    }

    // Spot AI Camera API response models
    public class SpotAICamera
    {
        public string camera_id { get; set; } = string.Empty;
        public string name { get; set; } = string.Empty;
        public string? location_id { get; set; }
        public string? location_name { get; set; }
        public string status { get; set; } = string.Empty;
        public DateTime? last_motion { get; set; }
    }

    public class SpotAICameraListResponse
    {
        public List<SpotAICamera> cameras { get; set; } = new();
        public string? next { get; set; }
        public string? prev { get; set; }
    }

    public class SpotAIEmbedRequest
    {
        public int camera_id { get; set; } // Must be int, not string!
        public int expires_in { get; set; } = 3600; // 1 hour default
    }

    public class SpotAIEmbedResponse
    {
        public string url { get; set; } = string.Empty;
        
        // Properties for API response (computed from url)
        [System.Text.Json.Serialization.JsonIgnore(Condition = System.Text.Json.Serialization.JsonIgnoreCondition.Never)]
        public string embed_url => string.IsNullOrEmpty(url) ? string.Empty : url;
        
        [System.Text.Json.Serialization.JsonIgnore(Condition = System.Text.Json.Serialization.JsonIgnoreCondition.Never)]
        public DateTime expires_at => DateTime.UtcNow.AddHours(1); // Default 1 hour expiry
    }
}
