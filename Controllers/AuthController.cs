using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Identity.Web;
using System.Security.Claims;

namespace FBCADoorControl.Controllers;

[Route("api/[controller]")]
[ApiController]
public class AuthController : ControllerBase
{
    /// <summary>
    /// Extract first name from email (billy.nelms@fbca.org -> Billy)
    /// </summary>
    private string ExtractFirstName(string email)
    {
        if (string.IsNullOrEmpty(email)) return "User";
        
        // Get username part (billy.nelms)
        var username = email.Split('@')[0];
        
        // Get first name (billy)
        var firstName = username.Split('.')[0];
        
        // Capitalize (Billy)
        return char.ToUpper(firstName[0]) + firstName.Substring(1);
    }

    /// <summary>
    /// Get current user info - returns just first name
    /// </summary>
    [HttpGet("user")]
    [Authorize]
    public IActionResult GetUser()
    {
        if (User.Identity?.IsAuthenticated != true)
        {
            return Unauthorized();
        }

        // Extract first name from email
        var firstName = ExtractFirstName(User.Identity?.Name);

        return Ok(new
        {
            name = firstName,
            givenName = firstName,
            email = User.Identity?.Name,
            isAuthenticated = true,
            roles = User.Claims
                .Where(c => c.Type == "roles" || c.Type == ClaimTypes.Role)
                .Select(c => c.Value)
                .ToList()
        });
    }

    /// <summary>
    /// Check if user is authenticated
    /// </summary>
    [HttpGet("check")]
    public IActionResult CheckAuth()
    {
        return Ok(new
        {
            isAuthenticated = User.Identity?.IsAuthenticated ?? false,
            name = ExtractFirstName(User.Identity?.Name)
        });
    }

    /// <summary>
    /// Sign in (redirects to Microsoft login)
    /// </summary>
    [HttpGet("login")]
    public IActionResult Login()
    {
        return Challenge(new AuthenticationProperties 
        { 
            RedirectUri = "/calendar.html" 
        }, OpenIdConnectDefaults.AuthenticationScheme);
    }

    /// <summary>
    /// Sign out
    /// </summary>
    [HttpGet("logout")]
    [Authorize]
    public IActionResult Logout()
    {
        return SignOut(new AuthenticationProperties 
        { 
            RedirectUri = "/" 
        }, OpenIdConnectDefaults.AuthenticationScheme);
    }
}
