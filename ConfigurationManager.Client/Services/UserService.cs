namespace ConfigurationManager.Client.Services;

using ConfigurationManager.Client.Models.Users;

/// <summary>
/// User management service client
/// </summary>
public interface IUserService
{
    /// <summary>
    /// Get all users (admin only)
    /// </summary>
    Task<UsersListResponse> GetUsersAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Get a specific user by ID
    /// </summary>
    Task<UserResponse> GetUserAsync(string id, CancellationToken cancellationToken = default);

    /// <summary>
    /// Update user role (admin only)
    /// </summary>
    Task<UserRoleUpdateResponse> UpdateUserRoleAsync(
        string id,
        string role,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Delete a user (admin only)
    /// </summary>
    Task<UserDeletionResponse> DeleteUserAsync(string id, CancellationToken cancellationToken = default);

    /// <summary>
    /// Get configurations created by a user
    /// </summary>
    Task<UserConfigurationsResponse> GetUserConfigurationsAsync(
        string id,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// Implementation of user management service
/// </summary>
public class UserService : BaseHttpService, IUserService
{
    public UserService(HttpClient httpClient, IOptions<ConfigurationManagerClientOptions> options, ILogger<UserService> logger)
        : base(httpClient, options, logger)
    {
    }

    /// <inheritdoc />
    public async Task<UsersListResponse> GetUsersAsync(CancellationToken cancellationToken = default)
    {
        Logger.LogDebug("Getting all users");

        return await GetAsync<UsersListResponse>("users", cancellationToken);
    }

    /// <inheritdoc />
    public async Task<UserResponse> GetUserAsync(string id, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(id))
            throw new ArgumentException("User ID cannot be empty", nameof(id));

        Logger.LogDebug("Getting user: {UserId}", id);

        return await GetAsync<UserResponse>($"users/{id}", cancellationToken);
    }

    /// <inheritdoc />
    public async Task<UserRoleUpdateResponse> UpdateUserRoleAsync(
        string id,
        string role,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(id))
            throw new ArgumentException("User ID cannot be empty", nameof(id));

        if (string.IsNullOrWhiteSpace(role))
            throw new ArgumentException("Role cannot be empty", nameof(role));

        if (role != "USER" && role != "ADMIN")
            throw new ArgumentException("Role must be either 'USER' or 'ADMIN'", nameof(role));

        var request = new UpdateUserRoleRequest { Role = role };

        Logger.LogInformation("Updating user {UserId} role to {Role}", id, role);

        return await PutAsync<UserRoleUpdateResponse>($"users/{id}/role", request, cancellationToken);
    }

    /// <inheritdoc />
    public async Task<UserDeletionResponse> DeleteUserAsync(string id, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(id))
            throw new ArgumentException("User ID cannot be empty", nameof(id));

        Logger.LogInformation("Deleting user: {UserId}", id);

        return await DeleteAsync<UserDeletionResponse>($"users/{id}", cancellationToken);
    }

    /// <inheritdoc />
    public async Task<UserConfigurationsResponse> GetUserConfigurationsAsync(
        string id,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(id))
            throw new ArgumentException("User ID cannot be empty", nameof(id));

        Logger.LogDebug("Getting configurations for user: {UserId}", id);

        return await GetAsync<UserConfigurationsResponse>($"users/{id}/configurations", cancellationToken);
    }
}
