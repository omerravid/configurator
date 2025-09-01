namespace ConfigurationManager.Client.Services;

using ConfigurationManager.Client.Models.Settings;
using ConfigurationManager.Client.Models.Common;

/// <summary>
/// Settings and administration service client
/// </summary>
public interface ISettingsService
{
    // MongoDB Settings
    /// <summary>
    /// Get MongoDB connection settings and status (admin only)
    /// </summary>
    Task<MongoDbSettingsResponse> GetMongoDbSettingsAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Update MongoDB connection settings (admin only)
    /// </summary>
    Task<MigrationResponse> UpdateMongoDbSettingsAsync(
        MongoDbSettings settings,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Test MongoDB connection (admin only)
    /// </summary>
    Task<MongoDbTestResponse> TestMongoDbConnectionAsync(
        MongoDbTestRequest request,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Connect to MongoDB (admin only)
    /// </summary>
    Task<MongoDbTestResponse> ConnectToMongoDbAsync(
        MongoDbSettings settings,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Disconnect from MongoDB (admin only)
    /// </summary>
    Task<MongoDbTestResponse> DisconnectFromMongoDbAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Migrate data from SQLite to MongoDB (admin only)
    /// </summary>
    Task<MigrationResponse> MigrateToMongoDbAsync(
        MigrationRequest request,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Get MongoDB connection status (admin only)
    /// </summary>
    Task<MongoDbStatus> GetMongoDbStatusAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Migrate to embedded MongoDB (admin only)
    /// </summary>
    Task<MigrationResponse> MigrateToEmbeddedMongoDbAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Revert to SQLite from MongoDB (admin only)
    /// </summary>
    Task<MigrationResponse> RevertToSqliteAsync(
        RevertToSqliteRequest request,
        CancellationToken cancellationToken = default);

    // Data Management
    /// <summary>
    /// Get data statistics (admin only)
    /// </summary>
    Task<DataStatisticsResponse> GetDataStatisticsAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Create data backup (admin only)
    /// </summary>
    Task<MigrationResponse> CreateBackupAsync(
        CreateBackupRequest request,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// List available backups (admin only)
    /// </summary>
    Task<BackupListResponse> GetBackupsAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Restore from backup (admin only)
    /// </summary>
    Task<RestoreResponse> RestoreFromBackupAsync(
        RestoreRequest request,
        CancellationToken cancellationToken = default);

    // Storage Settings
    /// <summary>
    /// Get storage settings (admin only)
    /// </summary>
    Task<StorageSettingsResponse> GetStorageSettingsAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Update storage settings (admin only)
    /// </summary>
    Task<StorageTestResponse> UpdateStorageSettingsAsync(
        StorageSettings settings,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Test storage connection (admin only)
    /// </summary>
    Task<StorageTestResponse> TestStorageConnectionAsync(
        StorageSettings settings,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Get storage status (admin only)
    /// </summary>
    Task<StorageStatusResponse> GetStorageStatusAsync(CancellationToken cancellationToken = default);
}

/// <summary>
/// Implementation of settings and administration service
/// </summary>
public class SettingsService : BaseHttpService, ISettingsService
{
    public SettingsService(HttpClient httpClient, IOptions<ConfigurationManagerClientOptions> options, ILogger<SettingsService> logger)
        : base(httpClient, options, logger)
    {
    }

    #region MongoDB Settings

    /// <inheritdoc />
    public async Task<MongoDbSettingsResponse> GetMongoDbSettingsAsync(CancellationToken cancellationToken = default)
    {
        Logger.LogDebug("Getting MongoDB settings");

        return await GetAsync<MongoDbSettingsResponse>("settings/mongodb", cancellationToken);
    }

    /// <inheritdoc />
    public async Task<MigrationResponse> UpdateMongoDbSettingsAsync(
        MongoDbSettings settings,
        CancellationToken cancellationToken = default)
    {
        if (settings == null)
            throw new ArgumentNullException(nameof(settings));

        if (string.IsNullOrWhiteSpace(settings.ConnectionString))
            throw new ArgumentException("Connection string cannot be empty", nameof(settings));

        Logger.LogInformation("Updating MongoDB settings");

        return await PutAsync<MigrationResponse>("settings/mongodb", settings, cancellationToken);
    }

    /// <inheritdoc />
    public async Task<MongoDbTestResponse> TestMongoDbConnectionAsync(
        MongoDbTestRequest request,
        CancellationToken cancellationToken = default)
    {
        if (request == null)
            throw new ArgumentNullException(nameof(request));

        if (string.IsNullOrWhiteSpace(request.ConnectionString))
            throw new ArgumentException("Connection string cannot be empty", nameof(request));

        Logger.LogInformation("Testing MongoDB connection");

        return await PostAsync<MongoDbTestResponse>("settings/mongodb/test", request, cancellationToken);
    }

    /// <inheritdoc />
    public async Task<MongoDbTestResponse> ConnectToMongoDbAsync(
        MongoDbSettings settings,
        CancellationToken cancellationToken = default)
    {
        if (settings == null)
            throw new ArgumentNullException(nameof(settings));

        Logger.LogInformation("Connecting to MongoDB");

        return await PostAsync<MongoDbTestResponse>("settings/mongodb/connect", settings, cancellationToken);
    }

    /// <inheritdoc />
    public async Task<MongoDbTestResponse> DisconnectFromMongoDbAsync(CancellationToken cancellationToken = default)
    {
        Logger.LogInformation("Disconnecting from MongoDB");

        return await PostAsync<MongoDbTestResponse>("settings/mongodb/disconnect", cancellationToken: cancellationToken);
    }

    /// <inheritdoc />
    public async Task<MigrationResponse> MigrateToMongoDbAsync(
        MigrationRequest request,
        CancellationToken cancellationToken = default)
    {
        if (request == null)
            throw new ArgumentNullException(nameof(request));

        if (string.IsNullOrWhiteSpace(request.ConnectionString))
            throw new ArgumentException("Connection string cannot be empty", nameof(request));

        Logger.LogInformation("Migrating data to MongoDB");

        return await PostAsync<MigrationResponse>("settings/mongodb/migrate", request, cancellationToken);
    }

    /// <inheritdoc />
    public async Task<MongoDbStatus> GetMongoDbStatusAsync(CancellationToken cancellationToken = default)
    {
        Logger.LogDebug("Getting MongoDB status");

        return await GetAsync<MongoDbStatus>("settings/mongodb/status", cancellationToken);
    }

    /// <inheritdoc />
    public async Task<MigrationResponse> MigrateToEmbeddedMongoDbAsync(CancellationToken cancellationToken = default)
    {
        Logger.LogInformation("Migrating to embedded MongoDB");

        return await PostAsync<MigrationResponse>("settings/mongodb/migrate-embedded", cancellationToken: cancellationToken);
    }

    /// <inheritdoc />
    public async Task<MigrationResponse> RevertToSqliteAsync(
        RevertToSqliteRequest request,
        CancellationToken cancellationToken = default)
    {
        if (request == null)
            throw new ArgumentNullException(nameof(request));

        Logger.LogInformation("Reverting to SQLite, migrateData={MigrateData}", request.MigrateData);

        return await PostAsync<MigrationResponse>("settings/mongodb/revert-to-sqlite", request, cancellationToken);
    }

    #endregion

    #region Data Management

    /// <inheritdoc />
    public async Task<DataStatisticsResponse> GetDataStatisticsAsync(CancellationToken cancellationToken = default)
    {
        Logger.LogDebug("Getting data statistics");

        return await GetAsync<DataStatisticsResponse>("settings/data/status", cancellationToken);
    }

    /// <inheritdoc />
    public async Task<MigrationResponse> CreateBackupAsync(
        CreateBackupRequest request,
        CancellationToken cancellationToken = default)
    {
        if (request == null)
            throw new ArgumentNullException(nameof(request));

        Logger.LogInformation("Creating backup: {BackupName}", request.Name ?? "auto-generated");

        return await PostAsync<MigrationResponse>("settings/data/backup", request, cancellationToken);
    }

    /// <inheritdoc />
    public async Task<BackupListResponse> GetBackupsAsync(CancellationToken cancellationToken = default)
    {
        Logger.LogDebug("Getting backup list");

        return await GetAsync<BackupListResponse>("settings/data/backups", cancellationToken);
    }

    /// <inheritdoc />
    public async Task<RestoreResponse> RestoreFromBackupAsync(
        RestoreRequest request,
        CancellationToken cancellationToken = default)
    {
        if (request == null)
            throw new ArgumentNullException(nameof(request));

        if (string.IsNullOrWhiteSpace(request.BackupName))
            throw new ArgumentException("Backup name cannot be empty", nameof(request));

        Logger.LogInformation("Restoring from backup: {BackupName}", request.BackupName);

        return await PostAsync<RestoreResponse>("settings/data/restore", request, cancellationToken);
    }

    #endregion

    #region Storage Settings

    /// <inheritdoc />
    public async Task<StorageSettingsResponse> GetStorageSettingsAsync(CancellationToken cancellationToken = default)
    {
        Logger.LogDebug("Getting storage settings");

        return await GetAsync<StorageSettingsResponse>("settings/storage", cancellationToken);
    }

    /// <inheritdoc />
    public async Task<StorageTestResponse> UpdateStorageSettingsAsync(
        StorageSettings settings,
        CancellationToken cancellationToken = default)
    {
        if (settings == null)
            throw new ArgumentNullException(nameof(settings));

        // Validate S3 settings if storage type is S3
        if (settings.StorageType == StorageType.S3)
        {
            if (string.IsNullOrWhiteSpace(settings.S3BucketName))
                throw new ArgumentException("S3 bucket name is required for S3 storage", nameof(settings));

            if (string.IsNullOrWhiteSpace(settings.AwsRegion))
                throw new ArgumentException("AWS region is required for S3 storage", nameof(settings));

            if (string.IsNullOrWhiteSpace(settings.AwsAccessKeyId))
                throw new ArgumentException("AWS access key ID is required for S3 storage", nameof(settings));

            if (string.IsNullOrWhiteSpace(settings.AwsSecretAccessKey))
                throw new ArgumentException("AWS secret access key is required for S3 storage", nameof(settings));
        }

        Logger.LogInformation("Updating storage settings to {StorageType}", settings.StorageType);

        return await PutAsync<StorageTestResponse>("settings/storage", settings, cancellationToken);
    }

    /// <inheritdoc />
    public async Task<StorageTestResponse> TestStorageConnectionAsync(
        StorageSettings settings,
        CancellationToken cancellationToken = default)
    {
        if (settings == null)
            throw new ArgumentNullException(nameof(settings));

        Logger.LogInformation("Testing storage connection for {StorageType}", settings.StorageType);

        return await PostAsync<StorageTestResponse>("settings/storage/test", settings, cancellationToken);
    }

    /// <inheritdoc />
    public async Task<StorageStatusResponse> GetStorageStatusAsync(CancellationToken cancellationToken = default)
    {
        Logger.LogDebug("Getting storage status");

        return await GetAsync<StorageStatusResponse>("settings/storage/status", cancellationToken);
    }

    #endregion
}
