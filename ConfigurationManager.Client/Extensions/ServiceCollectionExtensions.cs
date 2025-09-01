namespace ConfigurationManager.Client.Extensions;

using ConfigurationManager.Client.Services;
using Microsoft.Extensions.Configuration;

/// <summary>
/// Extension methods for configuring Configuration Manager client in dependency injection
/// </summary>
public static class ServiceCollectionExtensions
{
    /// <summary>
    /// Add Configuration Manager client to the service collection
    /// </summary>
    /// <param name="services">Service collection</param>
    /// <param name="configure">Configuration action</param>
    /// <returns>Service collection for chaining</returns>
    public static IServiceCollection AddConfigurationManagerClient(
        this IServiceCollection services,
        Action<ConfigurationManagerClientOptions> configure)
    {
        if (services == null)
            throw new ArgumentNullException(nameof(services));

        if (configure == null)
            throw new ArgumentNullException(nameof(configure));

        // Configure options
        services.Configure(configure);

        // Add HttpClient for each service
        services.AddHttpClient<IAuthService, AuthService>();
        services.AddHttpClient<IConfigurationService, ConfigurationService>();
        services.AddHttpClient<IFileService, FileService>();
        services.AddHttpClient<IUserService, UserService>();
        services.AddHttpClient<IRulesService, RulesService>();
        services.AddHttpClient<ISettingsService, SettingsService>();

        // Register services
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IConfigurationService, ConfigurationService>();
        services.AddScoped<IFileService, FileService>();
        services.AddScoped<IUserService, UserService>();
        services.AddScoped<IRulesService, RulesService>();
        services.AddScoped<ISettingsService, SettingsService>();

        // Register main client
        services.AddScoped<IConfigurationManagerClient>(serviceProvider =>
        {
            var options = serviceProvider.GetRequiredService<IOptions<ConfigurationManagerClientOptions>>().Value;
            return new ConfigurationManagerClient(options);
        });

        return services;
    }

    /// <summary>
    /// Add Configuration Manager client with API key authentication
    /// </summary>
    /// <param name="services">Service collection</param>
    /// <param name="baseUrl">Base URL of the Configuration Manager API</param>
    /// <param name="apiKey">API key for authentication</param>
    /// <returns>Service collection for chaining</returns>
    public static IServiceCollection AddConfigurationManagerClient(
        this IServiceCollection services,
        string baseUrl,
        string apiKey)
    {
        return services.AddConfigurationManagerClient(options =>
        {
            options.BaseUrl = baseUrl;
            options.ApiKey = apiKey;
        });
    }

    /// <summary>
    /// Add Configuration Manager client with JWT token authentication
    /// </summary>
    /// <param name="services">Service collection</param>
    /// <param name="baseUrl">Base URL of the Configuration Manager API</param>
    /// <param name="jwtToken">JWT token for authentication</param>
    /// <returns>Service collection for chaining</returns>
    public static IServiceCollection AddConfigurationManagerClientWithJwtToken(
        this IServiceCollection services,
        string baseUrl,
        string jwtToken)
    {
        return services.AddConfigurationManagerClient(options =>
        {
            options.BaseUrl = baseUrl;
            options.JwtToken = jwtToken;
        });
    }

    /// <summary>
    /// Add Configuration Manager client for login-based authentication
    /// </summary>
    /// <param name="services">Service collection</param>
    /// <param name="baseUrl">Base URL of the Configuration Manager API</param>
    /// <returns>Service collection for chaining</returns>
    public static IServiceCollection AddConfigurationManagerClientForLogin(
        this IServiceCollection services,
        string baseUrl)
    {
        return services.AddConfigurationManagerClient(options =>
        {
            options.BaseUrl = baseUrl;
        });
    }

    /// <summary>
    /// Add Configuration Manager client from configuration section
    /// </summary>
    /// <param name="services">Service collection</param>
    /// <param name="configuration">Configuration instance</param>
    /// <param name="sectionName">Configuration section name (default: "ConfigurationManagerClient")</param>
    /// <returns>Service collection for chaining</returns>
    public static IServiceCollection AddConfigurationManagerClient(
        this IServiceCollection services,
        Microsoft.Extensions.Configuration.IConfiguration configuration,
        string sectionName = "ConfigurationManagerClient")
    {
        if (services == null)
            throw new ArgumentNullException(nameof(services));

        if (configuration == null)
            throw new ArgumentNullException(nameof(configuration));

        // Bind configuration section to options
        services.Configure<ConfigurationManagerClientOptions>(
            configuration.GetSection(sectionName));

        return services.AddConfigurationManagerClient(_ => { });
    }
}
