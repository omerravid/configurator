namespace ConfigurationManager.Client.Services;

/// <summary>
/// Manages authentication state across all services
/// </summary>
public interface IAuthenticationManager
{
    /// <summary>
    /// Current JWT token
    /// </summary>
    string? CurrentToken { get; }

    /// <summary>
    /// Current API key
    /// </summary>
    string? CurrentApiKey { get; }

    /// <summary>
    /// Set JWT token
    /// </summary>
    void SetJwtToken(string token);

    /// <summary>
    /// Set API key
    /// </summary>
    void SetApiKey(string apiKey);

    /// <summary>
    /// Clear all authentication
    /// </summary>
    void ClearAuthentication();

    /// <summary>
    /// Configure HttpClient with current authentication
    /// </summary>
    void ConfigureHttpClient(HttpClient httpClient);
}

/// <summary>
/// Implementation of authentication manager
/// </summary>
public class AuthenticationManager : IAuthenticationManager
{
    private string? _currentToken;
    private string? _currentApiKey;

    /// <inheritdoc />
    public string? CurrentToken => _currentToken;

    /// <inheritdoc />
    public string? CurrentApiKey => _currentApiKey;

    /// <inheritdoc />
    public void SetJwtToken(string token)
    {
        if (string.IsNullOrWhiteSpace(token))
            throw new ArgumentException("Token cannot be empty", nameof(token));

        _currentToken = token;
        _currentApiKey = null; // Clear API key when setting JWT token
    }

    /// <inheritdoc />
    public void SetApiKey(string apiKey)
    {
        if (string.IsNullOrWhiteSpace(apiKey))
            throw new ArgumentException("API key cannot be empty", nameof(apiKey));

        _currentApiKey = apiKey;
        _currentToken = null; // Clear JWT token when setting API key
    }

    /// <inheritdoc />
    public void ClearAuthentication()
    {
        _currentToken = null;
        _currentApiKey = null;
    }

    /// <inheritdoc />
    public void ConfigureHttpClient(HttpClient httpClient)
    {
        // Clear existing authorization headers
        httpClient.DefaultRequestHeaders.Authorization = null;
        httpClient.DefaultRequestHeaders.Remove("X-API-Key");

        // Set current authentication
        if (!string.IsNullOrEmpty(_currentToken))
        {
            httpClient.DefaultRequestHeaders.Authorization = 
                new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", _currentToken);
        }
        else if (!string.IsNullOrEmpty(_currentApiKey))
        {
            httpClient.DefaultRequestHeaders.Add("X-API-Key", _currentApiKey);
        }
    }
}
