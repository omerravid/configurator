namespace ConfigurationManager.Client.Models.Users;

using ConfigurationManager.Client.Models.Auth;
using ConfigurationManager.Client.Models.Configuration;

/// <summary>
/// Users list response
/// </summary>
public class UsersListResponse
{
    [JsonPropertyName("users")]
    public List<User> Users { get; set; } = new();
}

/// <summary>
/// User response
/// </summary>
public class UserResponse
{
    [JsonPropertyName("user")]
    public User User { get; set; } = new();
}

/// <summary>
/// Update user role request
/// </summary>
public class UpdateUserRoleRequest
{
    [JsonPropertyName("role")]
    public string Role { get; set; } = string.Empty;
}

/// <summary>
/// User role update response
/// </summary>
public class UserRoleUpdateResponse
{
    [JsonPropertyName("message")]
    public string Message { get; set; } = string.Empty;

    [JsonPropertyName("user")]
    public User User { get; set; } = new();
}

/// <summary>
/// User deletion response
/// </summary>
public class UserDeletionResponse
{
    [JsonPropertyName("message")]
    public string Message { get; set; } = string.Empty;

    [JsonPropertyName("deletedUser")]
    public UserSummary DeletedUser { get; set; } = new();
}

/// <summary>
/// User summary
/// </summary>
public class UserSummary
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("username")]
    public string Username { get; set; } = string.Empty;
}

/// <summary>
/// User configurations response
/// </summary>
public class UserConfigurationsResponse
{
    [JsonPropertyName("configurations")]
    public List<Configuration> Configurations { get; set; } = new();
}
