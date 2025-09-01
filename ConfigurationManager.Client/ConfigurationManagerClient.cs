namespace ConfigurationManager.Client;

using ConfigurationManager.Client.Services;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

/// <summary>
/// Main Configuration Manager client that provides access to all services
/// </summary>
public interface IConfigurationManagerClient : IDisposable
{
    /// <summary>
    /// Authentication service for login, registration, and token management
    /// </summary>
    IAuthService Auth { get; }

    /// <summary>
    /// Configuration management service for CRUD operations on configurations
    /// </summary>
    IConfigurationService Configurations { get; }

    /// <summary>
    /// File management service for file uploads, downloads, and folder imports
    /// </summary>
    IFileService Files { get; }

    /// <summary>
    /// User management service for user administration
    /// </summary>
    IUserService Users { get; }

    /// <summary>
    /// Rules management service for validation rules
    /// </summary>
    IRulesService Rules { get; }

    /// <summary>
    /// Settings and administration service for system configuration
    /// </summary>
    ISettingsService Settings { get; }

    /// <summary>
    /// Check if the service is healthy
    /// </summary>
    Task<bool> IsHealthyAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Update the JWT token for authentication
    /// </summary>
    void SetJwtToken(string token);

    /// <summary>
    /// Update client options
    /// </summary>
    void UpdateOptions(Action<ConfigurationManagerClientOptions> configure);
}

/// <summary>
/// Implementation of the main Configuration Manager client
/// </summary>
public class ConfigurationManagerClient : IConfigurationManagerClient
{
    private readonly HttpClient _httpClient;
    private readonly IServiceProvider _serviceProvider;
    private bool _disposed;

    /// <inheritdoc />
    public IAuthService Auth { get; }

    /// <inheritdoc />
    public IConfigurationService Configurations { get; }

    /// <inheritdoc />
    public IFileService Files { get; }

    /// <inheritdoc />
    public IUserService Users { get; }

    /// <inheritdoc />
    public IRulesService Rules { get; }

    /// <inheritdoc />
    public ISettingsService Settings { get; }

    /// <summary>
    /// Create a new Configuration Manager client with the specified options
    /// </summary>
    /// <param name="options">Client configuration options</param>
    public ConfigurationManagerClient(ConfigurationManagerClientOptions options)
    {
        if (options == null)
            throw new ArgumentNullException(nameof(options));

        if (string.IsNullOrWhiteSpace(options.BaseUrl))
            throw new ArgumentException("Base URL cannot be empty", nameof(options));

        // Create service collection and configure services
        var services = new ServiceCollection();
        ConfigureServices(services, options);

        _serviceProvider = services.BuildServiceProvider();

        // Get HttpClient instance
        _httpClient = _serviceProvider.GetRequiredService<HttpClient>();

        // Initialize all services
        Auth = _serviceProvider.GetRequiredService<IAuthService>();
        Configurations = _serviceProvider.GetRequiredService<IConfigurationService>();
        Files = _serviceProvider.GetRequiredService<IFileService>();
        Users = _serviceProvider.GetRequiredService<IUserService>();
        Rules = _serviceProvider.GetRequiredService<IRulesService>();
        Settings = _serviceProvider.GetRequiredService<ISettingsService>();
    }

    /// <summary>
    /// Create a new Configuration Manager client with configuration action
    /// </summary>
    /// <param name="configure">Configuration action</param>
    public ConfigurationManagerClient(Action<ConfigurationManagerClientOptions> configure)
    {
        if (configure == null)
            throw new ArgumentNullException(nameof(configure));

        var options = new ConfigurationManagerClientOptions();
        configure(options);

        // Delegate to main constructor
        var tempClient = new ConfigurationManagerClient(options);
        
        _httpClient = tempClient._httpClient;
        _serviceProvider = tempClient._serviceProvider;
        Auth = tempClient.Auth;
        Configurations = tempClient.Configurations;
        Files = tempClient.Files;
        Users = tempClient.Users;
        Rules = tempClient.Rules;
        Settings = tempClient.Settings;
    }

    /// <summary>
    /// Create a new Configuration Manager client with default options for the specified base URL
    /// </summary>
    /// <param name="baseUrl">Base URL of the Configuration Manager API</param>
    /// <param name="apiKey">Optional API key for authentication</param>
    /// <param name="jwtToken">Optional JWT token for authentication</param>
    public ConfigurationManagerClient(string baseUrl, string? apiKey = null, string? jwtToken = null)
        : this(options =>
        {
            options.BaseUrl = baseUrl;
            options.ApiKey = apiKey;
            options.JwtToken = jwtToken;
        })
    {
    }

    /// <summary>
    /// Configure dependency injection services
    /// </summary>
    private static void ConfigureServices(IServiceCollection services, ConfigurationManagerClientOptions options)
    {
        // Configure options
        services.Configure<ConfigurationManagerClientOptions>(opt =>
        {
            opt.BaseUrl = options.BaseUrl;
            opt.ApiKey = options.ApiKey;
            opt.JwtToken = options.JwtToken;
            opt.Timeout = options.Timeout;
            opt.MaxFileSize = options.MaxFileSize;
            opt.IncludeDetailedErrors = options.IncludeDetailedErrors;
        });

        // Configure logging
        services.AddLogging(builder =>
        {
            builder.AddConsole();
            builder.SetMinimumLevel(LogLevel.Information);
        });

        // Configure HttpClient
        services.AddHttpClient<IAuthService, AuthService>();
        services.AddHttpClient<IConfigurationService, ConfigurationService>();
        services.AddHttpClient<IFileService, FileService>();
        services.AddHttpClient<IUserService, UserService>();
        services.AddHttpClient<IRulesService, RulesService>();
        services.AddHttpClient<ISettingsService, SettingsService>();

        // Register services
        services.AddTransient<IAuthService, AuthService>();
        services.AddTransient<IConfigurationService, ConfigurationService>();
        services.AddTransient<IFileService, FileService>();
        services.AddTransient<IUserService, UserService>();
        services.AddTransient<IRulesService, RulesService>();
        services.AddTransient<ISettingsService, SettingsService>();
    }

    /// <inheritdoc />
    public async Task<bool> IsHealthyAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            using var response = await _httpClient.GetAsync("/health", cancellationToken);
            return response.IsSuccessStatusCode;
        }
        catch (Exception)
        {
            return false;
        }
    }

    /// <inheritdoc />
    public void SetJwtToken(string token)
    {
        if (string.IsNullOrWhiteSpace(token))
            throw new ArgumentException("Token cannot be empty", nameof(token));

        Auth.SetJwtToken(token);
    }

    /// <inheritdoc />
    public void UpdateOptions(Action<ConfigurationManagerClientOptions> configure)
    {
        if (configure == null)
            throw new ArgumentNullException(nameof(configure));

        var optionsMonitor = _serviceProvider.GetService<IOptionsMonitor<ConfigurationManagerClientOptions>>();
        if (optionsMonitor != null)
        {
            var currentOptions = optionsMonitor.CurrentValue;
            configure(currentOptions);
        }
    }

    /// <inheritdoc />
    public void Dispose()
    {
        Dispose(true);
        GC.SuppressFinalize(this);
    }

    /// <summary>
    /// Protected implementation of Dispose pattern
    /// </summary>
    protected virtual void Dispose(bool disposing)
    {
        if (!_disposed && disposing)
        {
            _httpClient?.Dispose();
            (_serviceProvider as IDisposable)?.Dispose();
            _disposed = true;
        }
    }
}

/// <summary>
/// Static factory methods for creating Configuration Manager clients
/// </summary>
public static class ConfigurationManagerClientFactory
{
    /// <summary>
    /// Create a client with API key authentication
    /// </summary>
    /// <param name="baseUrl">Base URL of the Configuration Manager API</param>
    /// <param name="apiKey">API key for authentication</param>
    /// <returns>Configured client instance</returns>
    public static IConfigurationManagerClient CreateWithApiKey(string baseUrl, string apiKey)
    {
        if (string.IsNullOrWhiteSpace(baseUrl))
            throw new ArgumentException("Base URL cannot be empty", nameof(baseUrl));

        if (string.IsNullOrWhiteSpace(apiKey))
            throw new ArgumentException("API key cannot be empty", nameof(apiKey));

        return new ConfigurationManagerClient(options =>
        {
            options.BaseUrl = baseUrl;
            options.ApiKey = apiKey;
        });
    }

    /// <summary>
    /// Create a client with JWT token authentication
    /// </summary>
    /// <param name="baseUrl">Base URL of the Configuration Manager API</param>
    /// <param name="jwtToken">JWT token for authentication</param>
    /// <returns>Configured client instance</returns>
    public static IConfigurationManagerClient CreateWithJwtToken(string baseUrl, string jwtToken)
    {
        if (string.IsNullOrWhiteSpace(baseUrl))
            throw new ArgumentException("Base URL cannot be empty", nameof(baseUrl));

        if (string.IsNullOrWhiteSpace(jwtToken))
            throw new ArgumentException("JWT token cannot be empty", nameof(jwtToken));

        return new ConfigurationManagerClient(options =>
        {
            options.BaseUrl = baseUrl;
            options.JwtToken = jwtToken;
        });
    }

    /// <summary>
    /// Create a client for login-based authentication
    /// </summary>
    /// <param name="baseUrl">Base URL of the Configuration Manager API</param>
    /// <returns>Configured client instance</returns>
    public static IConfigurationManagerClient CreateForLogin(string baseUrl)
    {
        if (string.IsNullOrWhiteSpace(baseUrl))
            throw new ArgumentException("Base URL cannot be empty", nameof(baseUrl));

        return new ConfigurationManagerClient(options =>
        {
            options.BaseUrl = baseUrl;
        });
    }

    /// <summary>
    /// Create a client with custom configuration
    /// </summary>
    /// <param name="configure">Configuration action</param>
    /// <returns>Configured client instance</returns>
    public static IConfigurationManagerClient Create(Action<ConfigurationManagerClientOptions> configure)
    {
        return new ConfigurationManagerClient(configure);
    }
}
