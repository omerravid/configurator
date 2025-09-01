namespace ConfigurationManager.Client.Services;

using ConfigurationManager.Client.Models.Configuration;
using ConfigurationManager.Client.Models.Common;
using System.Text;
using System.Web;

/// <summary>
/// Configuration management service client
/// </summary>
public interface IConfigurationService
{
    /// <summary>
    /// Get all configurations with optional filtering
    /// </summary>
    Task<ConfigurationListResponse> GetConfigurationsAsync(
        ConfigurationType? type = null,
        ConfigurationStatus? status = null,
        bool includeArchived = false,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Get a specific configuration by ID
    /// </summary>
    Task<ResolvedConfigurationResponse> GetConfigurationAsync(
        string id,
        bool includeProvenance = false,
        bool raw = false,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Create a new configuration
    /// </summary>
    Task<ConfigurationResponse> CreateConfigurationAsync(
        CreateConfigurationRequest request,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Update an existing configuration
    /// </summary>
    Task<ConfigurationResponse> UpdateConfigurationAsync(
        string id,
        UpdateConfigurationRequest request,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Delete a configuration
    /// </summary>
    Task<ConfigurationResponse> DeleteConfigurationAsync(
        string id,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Get configuration data at a specific path
    /// </summary>
    Task<ConfigurationValueResponse> GetConfigurationValueAsync(
        string id,
        string? path = null,
        bool minimal = false,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Get configuration data at a specific path by configuration name
    /// </summary>
    Task<ConfigurationValueResponse> GetConfigurationValueByNameAsync(
        string configurationName,
        string? path = null,
        bool minimal = false,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Commit a draft configuration
    /// </summary>
    Task<ConfigurationResponse> CommitConfigurationAsync(
        string id,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Get child configurations
    /// </summary>
    Task<ChildrenConfigurationResponse> GetChildConfigurationsAsync(
        string id,
        bool includeArchived = false,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Get all components with their versions
    /// </summary>
    Task<ComponentsResponse> GetComponentsAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Rename a configuration (admin only)
    /// </summary>
    Task<ConfigurationResponse> RenameConfigurationAsync(
        string id,
        string newName,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Archive a configuration (admin only)
    /// </summary>
    Task<ConfigurationResponse> ArchiveConfigurationAsync(
        string id,
        bool archiveChildren = true,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Restore an archived configuration (admin only)
    /// </summary>
    Task<ConfigurationResponse> RestoreConfigurationAsync(
        string id,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// Implementation of configuration management service
/// </summary>
public class ConfigurationService : BaseHttpService, IConfigurationService
{
    public ConfigurationService(HttpClient httpClient, IOptions<ConfigurationManagerClientOptions> options, ILogger<ConfigurationService> logger, IAuthenticationManager authManager)
        : base(httpClient, options, logger, authManager)
    {
    }

    /// <inheritdoc />
    public async Task<ConfigurationListResponse> GetConfigurationsAsync(
        ConfigurationType? type = null,
        ConfigurationStatus? status = null,
        bool includeArchived = false,
        CancellationToken cancellationToken = default)
    {
        var queryParams = new List<string>();

        if (type.HasValue)
            queryParams.Add($"type={type.Value}");

        if (status.HasValue)
            queryParams.Add($"status={status.Value}");

        if (includeArchived)
            queryParams.Add("includeArchived=true");

        var endpoint = "configs";
        if (queryParams.Count > 0)
            endpoint += "?" + string.Join("&", queryParams);

        Logger.LogDebug("Getting configurations with filters: type={Type}, status={Status}, includeArchived={IncludeArchived}", 
            type, status, includeArchived);

        return await GetAsync<ConfigurationListResponse>(endpoint, cancellationToken);
    }

    /// <inheritdoc />
    public async Task<ResolvedConfigurationResponse> GetConfigurationAsync(
        string id,
        bool includeProvenance = false,
        bool raw = false,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(id))
            throw new ArgumentException("Configuration ID cannot be empty", nameof(id));

        var queryParams = new List<string>();

        if (includeProvenance)
            queryParams.Add("provenance=true");

        if (raw)
            queryParams.Add("raw=true");

        var endpoint = $"configs/{id}";
        if (queryParams.Count > 0)
            endpoint += "?" + string.Join("&", queryParams);

        Logger.LogDebug("Getting configuration: {Id} with provenance={Provenance}, raw={Raw}", 
            id, includeProvenance, raw);

        return await GetAsync<ResolvedConfigurationResponse>(endpoint, cancellationToken);
    }

    /// <inheritdoc />
    public async Task<ConfigurationResponse> CreateConfigurationAsync(
        CreateConfigurationRequest request,
        CancellationToken cancellationToken = default)
    {
        if (request == null)
            throw new ArgumentNullException(nameof(request));

        if (string.IsNullOrWhiteSpace(request.Name))
            throw new ArgumentException("Configuration name cannot be empty", nameof(request));

        Logger.LogInformation("Creating configuration: {Name} of type {Type}", request.Name, request.Type);

        return await PostAsync<ConfigurationResponse>("configs", request, cancellationToken);
    }

    /// <inheritdoc />
    public async Task<ConfigurationResponse> UpdateConfigurationAsync(
        string id,
        UpdateConfigurationRequest request,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(id))
            throw new ArgumentException("Configuration ID cannot be empty", nameof(id));

        if (request == null)
            throw new ArgumentNullException(nameof(request));

        Logger.LogInformation("Updating configuration: {Id}", id);

        return await PutAsync<ConfigurationResponse>($"configs/{id}", request, cancellationToken);
    }

    /// <inheritdoc />
    public async Task<ConfigurationResponse> DeleteConfigurationAsync(
        string id,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(id))
            throw new ArgumentException("Configuration ID cannot be empty", nameof(id));

        Logger.LogInformation("Deleting configuration: {Id}", id);

        return await DeleteAsync<ConfigurationResponse>($"configs/{id}", cancellationToken);
    }

    /// <inheritdoc />
    public async Task<ConfigurationValueResponse> GetConfigurationValueAsync(
        string id,
        string? path = null,
        bool minimal = false,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(id))
            throw new ArgumentException("Configuration ID cannot be empty", nameof(id));

        var queryParams = new List<string>();

        if (!string.IsNullOrWhiteSpace(path))
            queryParams.Add($"path={Uri.EscapeDataString(path)}");

        if (minimal)
            queryParams.Add("minimal=true");

        var endpoint = $"configs/{id}/data";
        if (queryParams.Count > 0)
            endpoint += "?" + string.Join("&", queryParams);

        Logger.LogDebug("Getting configuration value: {Id} at path={Path}, minimal={Minimal}", 
            id, path, minimal);

        return await GetAsync<ConfigurationValueResponse>(endpoint, cancellationToken);
    }

    /// <inheritdoc />
    public async Task<ConfigurationValueResponse> GetConfigurationValueByNameAsync(
        string configurationName,
        string? path = null,
        bool minimal = false,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(configurationName))
            throw new ArgumentException("Configuration name cannot be empty", nameof(configurationName));

        var queryParams = new List<string>();

        if (!string.IsNullOrWhiteSpace(path))
            queryParams.Add($"path={Uri.EscapeDataString(path)}");

        if (minimal)
            queryParams.Add("minimal=true");

        var endpoint = $"configs/by-name/{Uri.EscapeDataString(configurationName)}/data";
        if (queryParams.Count > 0)
            endpoint += "?" + string.Join("&", queryParams);

        Logger.LogDebug("Getting configuration value by name: {Name} at path={Path}, minimal={Minimal}",
            configurationName, path, minimal);

        return await GetAsync<ConfigurationValueResponse>(endpoint, cancellationToken);
    }

    /// <inheritdoc />
    public async Task<ConfigurationResponse> CommitConfigurationAsync(
        string id,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(id))
            throw new ArgumentException("Configuration ID cannot be empty", nameof(id));

        Logger.LogInformation("Committing configuration: {Id}", id);

        return await PostAsync<ConfigurationResponse>($"configs/{id}/commit", cancellationToken: cancellationToken);
    }

    /// <inheritdoc />
    public async Task<ChildrenConfigurationResponse> GetChildConfigurationsAsync(
        string id,
        bool includeArchived = false,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(id))
            throw new ArgumentException("Configuration ID cannot be empty", nameof(id));

        var endpoint = $"configs/{id}/children";
        if (includeArchived)
            endpoint += "?includeArchived=true";

        Logger.LogDebug("Getting child configurations for: {Id}, includeArchived={IncludeArchived}", 
            id, includeArchived);

        return await GetAsync<ChildrenConfigurationResponse>(endpoint, cancellationToken);
    }

    /// <inheritdoc />
    public async Task<ComponentsResponse> GetComponentsAsync(CancellationToken cancellationToken = default)
    {
        Logger.LogDebug("Getting all components with versions");

        return await GetAsync<ComponentsResponse>("configs/components", cancellationToken);
    }

    /// <inheritdoc />
    public async Task<ConfigurationResponse> RenameConfigurationAsync(
        string id,
        string newName,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(id))
            throw new ArgumentException("Configuration ID cannot be empty", nameof(id));

        if (string.IsNullOrWhiteSpace(newName))
            throw new ArgumentException("New name cannot be empty", nameof(newName));

        var request = new RenameConfigurationRequest { Name = newName };

        Logger.LogInformation("Renaming configuration: {Id} to {NewName}", id, newName);

        return await PutAsync<ConfigurationResponse>($"configs/{id}/rename", request, cancellationToken);
    }

    /// <inheritdoc />
    public async Task<ConfigurationResponse> ArchiveConfigurationAsync(
        string id,
        bool archiveChildren = true,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(id))
            throw new ArgumentException("Configuration ID cannot be empty", nameof(id));

        var request = new ArchiveConfigurationRequest { ArchiveChildren = archiveChildren };

        Logger.LogInformation("Archiving configuration: {Id}, archiveChildren={ArchiveChildren}", 
            id, archiveChildren);

        return await PostAsync<ConfigurationResponse>($"configs/{id}/archive", request, cancellationToken);
    }

    /// <inheritdoc />
    public async Task<ConfigurationResponse> RestoreConfigurationAsync(
        string id,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(id))
            throw new ArgumentException("Configuration ID cannot be empty", nameof(id));

        Logger.LogInformation("Restoring configuration: {Id}", id);

        return await PostAsync<ConfigurationResponse>($"configs/{id}/restore", cancellationToken: cancellationToken);
    }
}
