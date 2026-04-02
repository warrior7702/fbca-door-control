using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace FBCADoorControl.Models
{
    [Table("AuditLogs")]
    public class AuditLog
    {
        [Key]
        public int LogID { get; set; }
        
        public DateTime Timestamp { get; set; } = DateTime.Now;
        
        [Required]
        [MaxLength(50)]
        public string ActionType { get; set; } = "";
        
        [MaxLength(200)]
        public string? UserEmail { get; set; }
        
        [MaxLength(200)]
        public string? UserName { get; set; }
        
        public int? DoorID { get; set; }
        
        [MaxLength(200)]
        public string? DoorName { get; set; }
        
        public int? ScheduleID { get; set; }
        
        [MaxLength(200)]
        public string? EventName { get; set; }
        
        public bool Success { get; set; } = true;
        
        public string? ErrorMessage { get; set; }
        
        [MaxLength(50)]
        public string? IPAddress { get; set; }
        
        [MaxLength(500)]
        public string? UserAgent { get; set; }
        
        public string? Metadata { get; set; }
    }
}
