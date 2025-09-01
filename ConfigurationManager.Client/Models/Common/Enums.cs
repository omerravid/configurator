namespace ConfigurationManager.Client.Models.Common;

/// <summary>
/// Configuration types
/// </summary>
public enum ConfigurationType
{
    PRODUCT,
    INSTANCE,
    USER,
    COMPONENT,
    VERSION
}

/// <summary>
/// Configuration status
/// </summary>
public enum ConfigurationStatus
{
    DRAFT,
    COMMITTED
}

/// <summary>
/// User roles
/// </summary>
public enum UserRole
{
    ADMIN,
    USER
}

/// <summary>
/// Rule types for validation
/// </summary>
public enum RuleType
{
    [JsonPropertyName("numeric")]
    Numeric,
    [JsonPropertyName("pattern")]
    Pattern,
    [JsonPropertyName("collection")]
    Collection
}

/// <summary>
/// Storage types for file management
/// </summary>
public enum StorageType
{
    [JsonPropertyName("embedded")]
    Embedded,
    [JsonPropertyName("s3")]
    S3
}
