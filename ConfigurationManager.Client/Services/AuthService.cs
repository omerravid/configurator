namespace ConfigurationManager.Client.Services;

using ConfigurationManager.Client.Models.Auth;

/// <summary>
/// Authentication service client
/// </summary>
public interface IAuthService
{
    /// <summary>
    /// Login with username and password
    /// </summary>
    Task<AuthResponse> LoginAsync(string username, string password, CancellationToken cancellationToken = default);

    /// <summary>
    /// Register a new user
    /// </summary>
    Task<AuthResponse> RegisterAsync(string username, string password, string role = "USER", CancellationToken cancellationToken = default);

    /// <summary>
    /// Get current authenticated user information
    /// </summary>
    Task<CurrentUserResponse> GetCurrentUserAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Refresh JWT token
    /// </summary>
    Task<TokenRefreshResponse> RefreshTokenAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Update the client's JWT token
    /// </summary>
    void SetJwtToken(string token);
}

/// <summary>
/// Implementation of authentication service
/// </summary>
public class AuthService : BaseHttpService, IAuthService
{
    public AuthService(HttpClient httpClient, IOptions<ConfigurationManagerClientOptions> options, ILogger<AuthService> logger, IAuthenticationManager authManager)
        : base(httpClient, options, logger, authManager)
    {
    }

    /// <inheritdoc />
    public async Task<AuthResponse> LoginAsync(string username, string password, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(username))
            throw new ArgumentException("Username cannot be empty", nameof(username));

        if (string.IsNullOrWhiteSpace(password))
            throw new ArgumentException("Password cannot be empty", nameof(password));

        var request = new LoginRequest
        {
            Username = username,
            Password = password
        };

        Logger.LogInformation("Logging in user: {Username}", username);

        var response = await PostAsync<AuthResponse>("auth/login", request, cancellationToken);

        // Update the HTTP client with the new token
        if (!string.IsNullOrEmpty(response.Token))
        {
            UpdateJwtToken(response.Token);
            Logger.LogInformation("Successfully logged in user: {Username}", username);
        }

        return response;
    }

    /// <inheritdoc />
    public async Task<AuthResponse> RegisterAsync(string username, string password, string role = "USER", CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(username))
            throw new ArgumentException("Username cannot be empty", nameof(username));

        if (string.IsNullOrWhiteSpace(password))
            throw new ArgumentException("Password cannot be empty", nameof(password));

        if (role != "USER" && role != "ADMIN")
            throw new ArgumentException("Role must be either 'USER' or 'ADMIN'", nameof(role));

        var request = new RegisterRequest
        {
            Username = username,
            Password = password,
            Role = role
        };

        Logger.LogInformation("Registering new user: {Username} with role: {Role}", username, role);

        var response = await PostAsync<AuthResponse>("auth/register", request, cancellationToken);

        // Update the HTTP client with the new token
        if (!string.IsNullOrEmpty(response.Token))
        {
            UpdateJwtToken(response.Token);
            Logger.LogInformation("Successfully registered user: {Username}", username);
        }

        return response;
    }

    /// <inheritdoc />
    public async Task<CurrentUserResponse> GetCurrentUserAsync(CancellationToken cancellationToken = default)
    {
        Logger.LogDebug("Getting current user information");

        var response = await GetAsync<CurrentUserResponse>("auth/me", cancellationToken);

        Logger.LogDebug("Retrieved current user: {Username}", response.User?.Username);

        return response;
    }

    /// <inheritdoc />
    public async Task<TokenRefreshResponse> RefreshTokenAsync(CancellationToken cancellationToken = default)
    {
        Logger.LogInformation("Refreshing JWT token");

        var response = await PostAsync<TokenRefreshResponse>("auth/refresh", cancellationToken: cancellationToken);

        // Update the HTTP client with the new token
        if (!string.IsNullOrEmpty(response.Token))
        {
            UpdateJwtToken(response.Token);
            Logger.LogInformation("Successfully refreshed JWT token");
        }

        return response;
    }

    /// <inheritdoc />
    public void SetJwtToken(string token)
    {
        if (string.IsNullOrWhiteSpace(token))
            throw new ArgumentException("Token cannot be empty", nameof(token));

        UpdateJwtToken(token);
        Logger.LogInformation("JWT token updated");
    }
}
