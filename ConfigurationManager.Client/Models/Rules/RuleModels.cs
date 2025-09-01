namespace ConfigurationManager.Client.Models.Rules;

using ConfigurationManager.Client.Models.Common;

/// <summary>
/// Rule entity
/// </summary>
public class Rule
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("configurationId")]
    public string ConfigurationId { get; set; } = string.Empty;

    [JsonPropertyName("propertyPath")]
    public string PropertyPath { get; set; } = string.Empty;

    [JsonPropertyName("ruleType")]
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public RuleType RuleType { get; set; }

    [JsonPropertyName("ruleConfig")]
    public JsonElement RuleConfig { get; set; }

    [JsonPropertyName("errorMessage")]
    public string? ErrorMessage { get; set; }

    [JsonPropertyName("enabled")]
    public bool Enabled { get; set; } = true;

    [JsonPropertyName("created_at")]
    public DateTime CreatedAt { get; set; }

    [JsonPropertyName("updated_at")]
    public DateTime UpdatedAt { get; set; }
}

/// <summary>
/// Rules list response
/// </summary>
public class RulesListResponse
{
    [JsonPropertyName("rules")]
    public List<Rule> Rules { get; set; } = new();
}

/// <summary>
/// Create rule request
/// </summary>
public class CreateRuleRequest
{
    [JsonPropertyName("configurationId")]
    public string ConfigurationId { get; set; } = string.Empty;

    [JsonPropertyName("propertyPath")]
    public string PropertyPath { get; set; } = string.Empty;

    [JsonPropertyName("ruleType")]
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public RuleType RuleType { get; set; }

    [JsonPropertyName("ruleConfig")]
    public object RuleConfig { get; set; } = new();

    [JsonPropertyName("errorMessage")]
    public string? ErrorMessage { get; set; }

    [JsonPropertyName("enabled")]
    public bool Enabled { get; set; } = true;
}

/// <summary>
/// Update rule request
/// </summary>
public class UpdateRuleRequest
{
    [JsonPropertyName("propertyPath")]
    public string? PropertyPath { get; set; }

    [JsonPropertyName("ruleType")]
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public RuleType? RuleType { get; set; }

    [JsonPropertyName("ruleConfig")]
    public object? RuleConfig { get; set; }

    [JsonPropertyName("errorMessage")]
    public string? ErrorMessage { get; set; }

    [JsonPropertyName("enabled")]
    public bool? Enabled { get; set; }
}

/// <summary>
/// Rule response
/// </summary>
public class RuleResponse
{
    [JsonPropertyName("rule")]
    public Rule Rule { get; set; } = new();
}

/// <summary>
/// Rule validation request
/// </summary>
public class ValidateRuleRequest
{
    [JsonPropertyName("configurationId")]
    public string ConfigurationId { get; set; } = string.Empty;

    [JsonPropertyName("propertyPath")]
    public string PropertyPath { get; set; } = string.Empty;

    [JsonPropertyName("value")]
    public JsonElement Value { get; set; }
}

/// <summary>
/// Rule validation response
/// </summary>
public class RuleValidationResponse
{
    [JsonPropertyName("valid")]
    public bool Valid { get; set; }

    [JsonPropertyName("errors")]
    public List<string>? Errors { get; set; }

    [JsonPropertyName("warnings")]
    public List<string>? Warnings { get; set; }
}

/// <summary>
/// Numeric rule configuration
/// </summary>
public class NumericRuleConfig
{
    [JsonPropertyName("min")]
    public double? Min { get; set; }

    [JsonPropertyName("max")]
    public double? Max { get; set; }

    [JsonPropertyName("step")]
    public double? Step { get; set; }

    [JsonPropertyName("required")]
    public bool Required { get; set; }
}

/// <summary>
/// Pattern rule configuration
/// </summary>
public class PatternRuleConfig
{
    [JsonPropertyName("pattern")]
    public string Pattern { get; set; } = string.Empty;

    [JsonPropertyName("flags")]
    public string? Flags { get; set; }

    [JsonPropertyName("required")]
    public bool Required { get; set; }
}

/// <summary>
/// Collection rule configuration
/// </summary>
public class CollectionRuleConfig
{
    [JsonPropertyName("allowedValues")]
    public List<JsonElement>? AllowedValues { get; set; }

    [JsonPropertyName("minItems")]
    public int? MinItems { get; set; }

    [JsonPropertyName("maxItems")]
    public int? MaxItems { get; set; }

    [JsonPropertyName("uniqueItems")]
    public bool UniqueItems { get; set; }

    [JsonPropertyName("required")]
    public bool Required { get; set; }
}
