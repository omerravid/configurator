namespace ConfigurationManager.Client;

/// <summary>
/// Configuration options for the Configuration Manager client
/// </summary>
public class ConfigurationManagerClientOptions
{
    /// <summary>
    /// Base URL of the Configuration Manager API (e.g., "http://localhost:3002/api")
    /// </summary>
    public string BaseUrl { get; set; } = "http://localhost:3002/api";

    /// <summary>
    /// API Key for authentication (alternative to JWT token)
    /// </summary>
    public string? ApiKey { get; set; }

    /// <summary>
    /// JWT token for authentication (alternative to API key)
    /// </summary>
    public string? JwtToken { get; set; }

    /// <summary>
    /// Timeout for HTTP requests
    /// </summary>
    public TimeSpan Timeout { get; set; } = TimeSpan.FromSeconds(30);

    /// <summary>
    /// Maximum file size for uploads (default: 50MB)
    /// </summary>
    public long MaxFileSize { get; set; } = 50 * 1024 * 1024; // 50MB

    /// <summary>
    /// Whether to include detailed error information in exceptions
    /// </summary>
    public bool IncludeDetailedErrors { get; set; } = true;
}
