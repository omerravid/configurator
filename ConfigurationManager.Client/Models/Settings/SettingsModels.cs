namespace ConfigurationManager.Client.Models.Settings;

using ConfigurationManager.Client.Models.Common;

/// <summary>
/// MongoDB settings
/// </summary>
public class MongoDbSettings
{
    [JsonPropertyName("connectionString")]
    public string ConnectionString { get; set; } = string.Empty;

    [JsonPropertyName("options")]
    public MongoDbOptions? Options { get; set; }
}

/// <summary>
/// MongoDB connection options
/// </summary>
public class MongoDbOptions
{
    [JsonPropertyName("useNewUrlParser")]
    public bool UseNewUrlParser { get; set; } = true;

    [JsonPropertyName("useUnifiedTopology")]
    public bool UseUnifiedTopology { get; set; } = true;
}

/// <summary>
/// MongoDB settings response
/// </summary>
public class MongoDbSettingsResponse
{
    [JsonPropertyName("success")]
    public bool Success { get; set; }

    [JsonPropertyName("settings")]
    public MongoDbSettings? Settings { get; set; }

    [JsonPropertyName("status")]
    public MongoDbStatus? Status { get; set; }
}

/// <summary>
/// MongoDB connection status
/// </summary>
public class MongoDbStatus
{
    [JsonPropertyName("connected")]
    public bool Connected { get; set; }

    [JsonPropertyName("host")]
    public string? Host { get; set; }

    [JsonPropertyName("database")]
    public string? Database { get; set; }

    [JsonPropertyName("type")]
    public string? Type { get; set; }
}

/// <summary>
/// MongoDB connection test request
/// </summary>
public class MongoDbTestRequest
{
    [JsonPropertyName("connectionString")]
    public string ConnectionString { get; set; } = string.Empty;
}

/// <summary>
/// MongoDB connection test response
/// </summary>
public class MongoDbTestResponse
{
    [JsonPropertyName("success")]
    public bool Success { get; set; }

    [JsonPropertyName("message")]
    public string Message { get; set; } = string.Empty;

    [JsonPropertyName("details")]
    public MongoDbTestDetails? Details { get; set; }
}

/// <summary>
/// MongoDB connection test details
/// </summary>
public class MongoDbTestDetails
{
    [JsonPropertyName("host")]
    public string? Host { get; set; }

    [JsonPropertyName("database")]
    public string? Database { get; set; }

    [JsonPropertyName("connected")]
    public bool Connected { get; set; }

    [JsonPropertyName("latency")]
    public int? Latency { get; set; }
}

/// <summary>
/// Migration request
/// </summary>
public class MigrationRequest
{
    [JsonPropertyName("connectionString")]
    public string ConnectionString { get; set; } = string.Empty;

    [JsonPropertyName("createBackup")]
    public bool CreateBackup { get; set; } = true;
}

/// <summary>
/// Migration response
/// </summary>
public class MigrationResponse
{
    [JsonPropertyName("success")]
    public bool Success { get; set; }

    [JsonPropertyName("message")]
    public string Message { get; set; } = string.Empty;

    [JsonPropertyName("migrated")]
    public MigrationStats? Migrated { get; set; }

    [JsonPropertyName("backup")]
    public BackupInfo? Backup { get; set; }

    [JsonPropertyName("embeddedMongo")]
    public EmbeddedMongoInfo? EmbeddedMongo { get; set; }
}

/// <summary>
/// Migration statistics
/// </summary>
public class MigrationStats
{
    [JsonPropertyName("users")]
    public int Users { get; set; }

    [JsonPropertyName("configurations")]
    public int Configurations { get; set; }
}

/// <summary>
/// Embedded MongoDB information
/// </summary>
public class EmbeddedMongoInfo
{
    [JsonPropertyName("started")]
    public bool Started { get; set; }

    [JsonPropertyName("connectionString")]
    public string? ConnectionString { get; set; }
}

/// <summary>
/// Data statistics response
/// </summary>
public class DataStatisticsResponse
{
    [JsonPropertyName("success")]
    public bool Success { get; set; }

    [JsonPropertyName("statistics")]
    public DataStatistics? Statistics { get; set; }
}

/// <summary>
/// Data statistics
/// </summary>
public class DataStatistics
{
    [JsonPropertyName("users")]
    public UserStatistics Users { get; set; } = new();

    [JsonPropertyName("configurations")]
    public ConfigurationStatistics Configurations { get; set; } = new();

    [JsonPropertyName("storage")]
    public StorageStatistics Storage { get; set; } = new();
}

/// <summary>
/// User statistics
/// </summary>
public class UserStatistics
{
    [JsonPropertyName("total")]
    public int Total { get; set; }

    [JsonPropertyName("admins")]
    public int Admins { get; set; }

    [JsonPropertyName("regularUsers")]
    public int RegularUsers { get; set; }
}

/// <summary>
/// Configuration statistics
/// </summary>
public class ConfigurationStatistics
{
    [JsonPropertyName("total")]
    public int Total { get; set; }

    [JsonPropertyName("byType")]
    public Dictionary<string, int> ByType { get; set; } = new();

    [JsonPropertyName("byStatus")]
    public Dictionary<string, int> ByStatus { get; set; } = new();

    [JsonPropertyName("archived")]
    public int Archived { get; set; }
}

/// <summary>
/// Storage statistics
/// </summary>
public class StorageStatistics
{
    [JsonPropertyName("type")]
    public string Type { get; set; } = string.Empty;

    [JsonPropertyName("totalFiles")]
    public int TotalFiles { get; set; }

    [JsonPropertyName("totalSize")]
    public long TotalSize { get; set; }
}

/// <summary>
/// Backup creation request
/// </summary>
public class CreateBackupRequest
{
    [JsonPropertyName("name")]
    public string? Name { get; set; }
}

/// <summary>
/// Backup info
/// </summary>
public class BackupInfo
{
    [JsonPropertyName("filename")]
    public string Filename { get; set; } = string.Empty;

    [JsonPropertyName("timestamp")]
    public DateTime Timestamp { get; set; }

    [JsonPropertyName("size")]
    public long Size { get; set; }

    [JsonPropertyName("type")]
    public string? Type { get; set; }

    [JsonPropertyName("created")]
    public bool? Created { get; set; }

    [JsonPropertyName("included")]
    public MigrationStats? Included { get; set; }
}

/// <summary>
/// Backup list response
/// </summary>
public class BackupListResponse
{
    [JsonPropertyName("success")]
    public bool Success { get; set; }

    [JsonPropertyName("backups")]
    public List<BackupInfo> Backups { get; set; } = new();
}

/// <summary>
/// Restore request
/// </summary>
public class RestoreRequest
{
    [JsonPropertyName("backupName")]
    public string BackupName { get; set; } = string.Empty;

    [JsonPropertyName("createBackup")]
    public bool CreateBackup { get; set; } = true;
}

/// <summary>
/// Restore response
/// </summary>
public class RestoreResponse
{
    [JsonPropertyName("success")]
    public bool Success { get; set; }

    [JsonPropertyName("message")]
    public string Message { get; set; } = string.Empty;

    [JsonPropertyName("restored")]
    public MigrationStats? Restored { get; set; }

    [JsonPropertyName("preRestoreBackup")]
    public BackupInfo? PreRestoreBackup { get; set; }
}

/// <summary>
/// Storage settings
/// </summary>
public class StorageSettings
{
    [JsonPropertyName("storageType")]
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public StorageType StorageType { get; set; }

    [JsonPropertyName("s3BucketName")]
    public string? S3BucketName { get; set; }

    [JsonPropertyName("awsRegion")]
    public string? AwsRegion { get; set; }

    [JsonPropertyName("awsAccessKeyId")]
    public string? AwsAccessKeyId { get; set; }

    [JsonPropertyName("awsSecretAccessKey")]
    public string? AwsSecretAccessKey { get; set; }
}

/// <summary>
/// Storage settings response
/// </summary>
public class StorageSettingsResponse
{
    [JsonPropertyName("success")]
    public bool Success { get; set; }

    [JsonPropertyName("storageType")]
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public StorageType StorageType { get; set; }

    [JsonPropertyName("s3BucketName")]
    public string? S3BucketName { get; set; }

    [JsonPropertyName("s3Region")]
    public string? S3Region { get; set; }

    [JsonPropertyName("isConfigured")]
    public bool? IsConfigured { get; set; }
}

/// <summary>
/// Storage test response
/// </summary>
public class StorageTestResponse
{
    [JsonPropertyName("success")]
    public bool Success { get; set; }

    [JsonPropertyName("message")]
    public string Message { get; set; } = string.Empty;

    [JsonPropertyName("details")]
    public JsonElement? Details { get; set; }
}

/// <summary>
/// Storage status response
/// </summary>
public class StorageStatusResponse
{
    [JsonPropertyName("success")]
    public bool Success { get; set; }

    [JsonPropertyName("config")]
    public StorageSettingsResponse? Config { get; set; }

    [JsonPropertyName("connectionTest")]
    public StorageTestResponse? ConnectionTest { get; set; }

    [JsonPropertyName("isConfigured")]
    public bool IsConfigured { get; set; }
}

/// <summary>
/// Revert to SQLite request
/// </summary>
public class RevertToSqliteRequest
{
    [JsonPropertyName("migrateData")]
    public bool MigrateData { get; set; } = true;
}
