namespace ConfigurationManager.Client.Models.Auth;

/// <summary>
/// Login request
/// </summary>
public class LoginRequest
{
    [JsonPropertyName("username")]
    public string Username { get; set; } = string.Empty;

    [JsonPropertyName("password")]
    public string Password { get; set; } = string.Empty;
}

/// <summary>
/// Register request
/// </summary>
public class RegisterRequest
{
    [JsonPropertyName("username")]
    public string Username { get; set; } = string.Empty;

    [JsonPropertyName("password")]
    public string Password { get; set; } = string.Empty;

    [JsonPropertyName("role")]
    public string Role { get; set; } = "USER";
}

/// <summary>
/// User information
/// </summary>
public class User
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("username")]
    public string Username { get; set; } = string.Empty;

    [JsonPropertyName("role")]
    public string Role { get; set; } = string.Empty;

    [JsonPropertyName("created_at")]
    public DateTime CreatedAt { get; set; }

    [JsonPropertyName("updated_at")]
    public DateTime UpdatedAt { get; set; }
}

/// <summary>
/// Authentication response
/// </summary>
public class AuthResponse
{
    [JsonPropertyName("token")]
    public string Token { get; set; } = string.Empty;

    [JsonPropertyName("user")]
    public User User { get; set; } = new();

    [JsonPropertyName("message")]
    public string? Message { get; set; }
}

/// <summary>
/// Current user response
/// </summary>
public class CurrentUserResponse
{
    [JsonPropertyName("user")]
    public User User { get; set; } = new();
}

/// <summary>
/// Token refresh response
/// </summary>
public class TokenRefreshResponse
{
    [JsonPropertyName("token")]
    public string Token { get; set; } = string.Empty;
}
