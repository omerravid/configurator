namespace ConfigurationManager.Client.Models.Configuration;

using ConfigurationManager.Client.Models.Common;

/// <summary>
/// Configuration entity
/// </summary>
public class Configuration
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("type")]
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public ConfigurationType Type { get; set; }

    [JsonPropertyName("parent_id")]
    public string? ParentId { get; set; }

    [JsonPropertyName("data")]
    public JsonElement Data { get; set; }

    [JsonPropertyName("created_by")]
    public string CreatedBy { get; set; } = string.Empty;

    [JsonPropertyName("description")]
    public string? Description { get; set; }

    [JsonPropertyName("status")]
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public ConfigurationStatus Status { get; set; }

    [JsonPropertyName("archived")]
    public bool Archived { get; set; }

    [JsonPropertyName("created_at")]
    public DateTime CreatedAt { get; set; }

    [JsonPropertyName("updated_at")]
    public DateTime UpdatedAt { get; set; }
}

/// <summary>
/// Configuration list response
/// </summary>
public class ConfigurationListResponse
{
    [JsonPropertyName("configs")]
    public List<Configuration> Configs { get; set; } = new();
}

/// <summary>
/// Create configuration request
/// </summary>
public class CreateConfigurationRequest
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("type")]
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public ConfigurationType Type { get; set; }

    [JsonPropertyName("parent_id")]
    public string? ParentId { get; set; }

    [JsonPropertyName("data")]
    public object Data { get; set; } = new();

    [JsonPropertyName("description")]
    public string? Description { get; set; }
}

/// <summary>
/// Update configuration request
/// </summary>
public class UpdateConfigurationRequest
{
    [JsonPropertyName("data")]
    public object? Data { get; set; }

    [JsonPropertyName("description")]
    public string? Description { get; set; }
}

/// <summary>
/// Configuration response with creation info
/// </summary>
public class ConfigurationResponse
{
    [JsonPropertyName("config")]
    public Configuration Config { get; set; } = new();

    [JsonPropertyName("message")]
    public string? Message { get; set; }
}

/// <summary>
/// Resolved configuration response
/// </summary>
public class ResolvedConfigurationResponse
{
    [JsonPropertyName("config")]
    public Configuration Config { get; set; } = new();

    [JsonPropertyName("data")]
    public JsonElement Data { get; set; }

    [JsonPropertyName("inheritance_chain")]
    public List<ConfigurationSummary>? InheritanceChain { get; set; }
}

/// <summary>
/// Configuration summary for inheritance chain
/// </summary>
public class ConfigurationSummary
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("type")]
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public ConfigurationType Type { get; set; }
}

/// <summary>
/// Configuration value response
/// </summary>
public class ConfigurationValueResponse
{
    [JsonPropertyName("value")]
    public JsonElement Value { get; set; }

    [JsonPropertyName("path")]
    public string? Path { get; set; }

    [JsonPropertyName("source")]
    public ConfigurationSource? Source { get; set; }

    [JsonPropertyName("config")]
    public ConfigurationSummary? Config { get; set; }

    [JsonPropertyName("data")]
    public JsonElement? Data { get; set; }
}

/// <summary>
/// Configuration source information
/// </summary>
public class ConfigurationSource
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("type")]
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public ConfigurationType Type { get; set; }

    [JsonPropertyName("createdBy")]
    public string? CreatedBy { get; set; }

    [JsonPropertyName("createdAt")]
    public DateTime? CreatedAt { get; set; }
}

/// <summary>
/// Children configurations response
/// </summary>
public class ChildrenConfigurationResponse
{
    [JsonPropertyName("children")]
    public List<Configuration> Children { get; set; } = new();

    [JsonPropertyName("count")]
    public int Count { get; set; }
}

/// <summary>
/// Components with versions response
/// </summary>
public class ComponentsResponse
{
    [JsonPropertyName("components")]
    public List<ComponentWithVersions> Components { get; set; } = new();
}

/// <summary>
/// Component with its versions
/// </summary>
public class ComponentWithVersions
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("type")]
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public ConfigurationType Type { get; set; }

    [JsonPropertyName("description")]
    public string? Description { get; set; }

    [JsonPropertyName("status")]
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public ConfigurationStatus Status { get; set; }

    [JsonPropertyName("created_by")]
    public string CreatedBy { get; set; } = string.Empty;

    [JsonPropertyName("created_at")]
    public DateTime CreatedAt { get; set; }

    [JsonPropertyName("versions")]
    public List<Configuration> Versions { get; set; } = new();
}

/// <summary>
/// Rename configuration request
/// </summary>
public class RenameConfigurationRequest
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;
}

/// <summary>
/// Archive configuration request
/// </summary>
public class ArchiveConfigurationRequest
{
    [JsonPropertyName("archiveChildren")]
    public bool ArchiveChildren { get; set; } = true;
}
