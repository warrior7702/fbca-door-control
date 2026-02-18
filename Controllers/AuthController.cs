using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace FBCADoorControl.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/auth")]
    public class AuthController : ControllerBase
    {
        [HttpGet("user")]
        public IActionResult GetCurrentUser()
        {
            // Try to get name from claims
            var givenName = User.FindFirst(ClaimTypes.GivenName)?.Value 
                            ?? User.FindFirst("given_name")?.Value 
                            ?? User.FindFirst("name")?.Value;
            
            var surname = User.FindFirst(ClaimTypes.Surname)?.Value 
                          ?? User.FindFirst("family_name")?.Value 
                          ?? "";
            
            var email = User.FindFirst(ClaimTypes.Email)?.Value 
                        ?? User.FindFirst("preferred_username")?.Value 
                        ?? User.Identity?.Name 
                        ?? "";

            // If no name claims, try to extract from email (billy.nelms@fbca.org → Billy)
            if (string.IsNullOrEmpty(givenName) && !string.IsNullOrEmpty(email))
            {
                var emailParts = email.Split('@')[0].Split('.');
                if (emailParts.Length > 0)
                {
                    // Capitalize first letter (billy → Billy)
                    givenName = char.ToUpper(emailParts[0][0]) + emailParts[0].Substring(1);
                    
                    if (emailParts.Length > 1)
                    {
                        surname = char.ToUpper(emailParts[1][0]) + emailParts[1].Substring(1);
                    }
                }
            }

            return Ok(new
            {
                givenName = givenName ?? "User",
                surname = surname,
                email = email,
                fullName = $"{givenName} {surname}".Trim()
            });
        }
    }
}
