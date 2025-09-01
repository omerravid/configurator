namespace ConfigurationManager.Client.Services;

using ConfigurationManager.Client.Models.Rules;
using System.Web;

/// <summary>
/// Rules management service client
/// </summary>
public interface IRulesService
{
    /// <summary>
    /// Get rules for a configuration
    /// </summary>
    Task<RulesListResponse> GetRulesAsync(
        string configurationId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Create a new rule
    /// </summary>
    Task<RuleResponse> CreateRuleAsync(
        CreateRuleRequest request,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Get a specific rule by ID
    /// </summary>
    Task<RuleResponse> GetRuleAsync(string id, CancellationToken cancellationToken = default);

    /// <summary>
    /// Update an existing rule
    /// </summary>
    Task<RuleResponse> UpdateRuleAsync(
        string id,
        UpdateRuleRequest request,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Delete a rule
    /// </summary>
    Task DeleteRuleAsync(string id, CancellationToken cancellationToken = default);

    /// <summary>
    /// Validate a value against rules
    /// </summary>
    Task<RuleValidationResponse> ValidateValueAsync(
        ValidateRuleRequest request,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Get rules for a specific configuration and path
    /// </summary>
    Task<RulesListResponse> GetRulesForPathAsync(
        string configId,
        string path,
        bool includeInherited = true,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// Implementation of rules management service
/// </summary>
public class RulesService : BaseHttpService, IRulesService
{
    public RulesService(HttpClient httpClient, IOptions<ConfigurationManagerClientOptions> options, ILogger<RulesService> logger, IAuthenticationManager authManager)
        : base(httpClient, options, logger, authManager)
    {
    }

    /// <inheritdoc />
    public async Task<RulesListResponse> GetRulesAsync(
        string configurationId,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(configurationId))
            throw new ArgumentException("Configuration ID cannot be empty", nameof(configurationId));

        var endpoint = $"rules?configurationId={Uri.EscapeDataString(configurationId)}";

        Logger.LogDebug("Getting rules for configuration: {ConfigurationId}", configurationId);

        return await GetAsync<RulesListResponse>(endpoint, cancellationToken);
    }

    /// <inheritdoc />
    public async Task<RuleResponse> CreateRuleAsync(
        CreateRuleRequest request,
        CancellationToken cancellationToken = default)
    {
        if (request == null)
            throw new ArgumentNullException(nameof(request));

        if (string.IsNullOrWhiteSpace(request.ConfigurationId))
            throw new ArgumentException("Configuration ID cannot be empty", nameof(request));

        if (string.IsNullOrWhiteSpace(request.PropertyPath))
            throw new ArgumentException("Property path cannot be empty", nameof(request));

        Logger.LogInformation("Creating rule for configuration {ConfigurationId} at path {PropertyPath}", 
            request.ConfigurationId, request.PropertyPath);

        return await PostAsync<RuleResponse>("rules", request, cancellationToken);
    }

    /// <inheritdoc />
    public async Task<RuleResponse> GetRuleAsync(string id, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(id))
            throw new ArgumentException("Rule ID cannot be empty", nameof(id));

        Logger.LogDebug("Getting rule: {RuleId}", id);

        return await GetAsync<RuleResponse>($"rules/{id}", cancellationToken);
    }

    /// <inheritdoc />
    public async Task<RuleResponse> UpdateRuleAsync(
        string id,
        UpdateRuleRequest request,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(id))
            throw new ArgumentException("Rule ID cannot be empty", nameof(id));

        if (request == null)
            throw new ArgumentNullException(nameof(request));

        Logger.LogInformation("Updating rule: {RuleId}", id);

        return await PutAsync<RuleResponse>($"rules/{id}", request, cancellationToken);
    }

    /// <inheritdoc />
    public async Task DeleteRuleAsync(string id, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(id))
            throw new ArgumentException("Rule ID cannot be empty", nameof(id));

        Logger.LogInformation("Deleting rule: {RuleId}", id);

        await DeleteAsync<object>($"rules/{id}", cancellationToken);
    }

    /// <inheritdoc />
    public async Task<RuleValidationResponse> ValidateValueAsync(
        ValidateRuleRequest request,
        CancellationToken cancellationToken = default)
    {
        if (request == null)
            throw new ArgumentNullException(nameof(request));

        if (string.IsNullOrWhiteSpace(request.ConfigurationId))
            throw new ArgumentException("Configuration ID cannot be empty", nameof(request));

        if (string.IsNullOrWhiteSpace(request.PropertyPath))
            throw new ArgumentException("Property path cannot be empty", nameof(request));

        Logger.LogDebug("Validating value for configuration {ConfigurationId} at path {PropertyPath}", 
            request.ConfigurationId, request.PropertyPath);

        return await PostAsync<RuleValidationResponse>("rules/validate", request, cancellationToken);
    }

    /// <inheritdoc />
    public async Task<RulesListResponse> GetRulesForPathAsync(
        string configId,
        string path,
        bool includeInherited = true,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(configId))
            throw new ArgumentException("Configuration ID cannot be empty", nameof(configId));

        if (string.IsNullOrWhiteSpace(path))
            throw new ArgumentException("Path cannot be empty", nameof(path));

        var encodedPath = Uri.EscapeDataString(path);
        var endpoint = $"rules/configuration/{configId}/path/{encodedPath}";

        if (!includeInherited)
            endpoint += "?includeInherited=false";

        Logger.LogDebug("Getting rules for configuration {ConfigId} at path {Path}, includeInherited={IncludeInherited}", 
            configId, path, includeInherited);

        return await GetAsync<RulesListResponse>(endpoint, cancellationToken);
    }
}
