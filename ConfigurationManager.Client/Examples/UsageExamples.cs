namespace ConfigurationManager.Client.Examples;

using ConfigurationManager.Client.Models.Configuration;
using ConfigurationManager.Client.Models.Files;
using ConfigurationManager.Client.Models.Common;
using ConfigurationManager.Client.Exceptions;
using ConfigurationManager.Client.Extensions;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Configuration;

/// <summary>
/// Usage examples for the Configuration Manager client
/// </summary>
public static class UsageExamples
{
    /// <summary>
    /// Example: Basic client setup and authentication
    /// </summary>
    public static async Task BasicAuthenticationExample()
    {
        // Option 1: Create client with API key
        using var client = ConfigurationManagerClientFactory.CreateWithApiKey(
            "http://localhost:3002/api", 
            "your-api-key");

        // Option 2: Create client for login-based authentication
        using var loginClient = ConfigurationManagerClientFactory.CreateForLogin("http://localhost:3002/api");

        // Login with username and password
        var authResponse = await loginClient.Auth.LoginAsync("admin", "admin123");

        // JWT token is automatically set for all services after login
        Console.WriteLine($"Logged in as: {authResponse.User.Username}");

        // Option 3: Create client with JWT token
        using var jwtClient = ConfigurationManagerClientFactory.CreateWithJwtToken(
            "http://localhost:3002/api", 
            authResponse.Token);

        // Check if the service is healthy
        var isHealthy = await client.IsHealthyAsync();
        Console.WriteLine($"Service health: {isHealthy}");
    }

    /// <summary>
    /// Example: Configuration management operations
    /// </summary>
    public static async Task ConfigurationManagementExample()
    {
        using var client = ConfigurationManagerClientFactory.CreateWithApiKey(
            "http://localhost:3002/api", 
            "your-api-key");

        // Get all configurations
        var configsResponse = await client.Configurations.GetConfigurationsAsync();
        Console.WriteLine($"Found {configsResponse.Configs.Count} configurations");

        // Create a new configuration
        var createRequest = new CreateConfigurationRequest
        {
            Name = "My New Component",
            Type = ConfigurationType.COMPONENT,
            Data = new { setting1 = "value1", setting2 = 42 },
            Description = "Example component configuration"
        };

        var newConfig = await client.Configurations.CreateConfigurationAsync(createRequest);
        Console.WriteLine($"Created configuration: {newConfig.Config.Id}");

        // Get configuration with provenance
        var resolvedConfig = await client.Configurations.GetConfigurationAsync(
            newConfig.Config.Id, 
            includeProvenance: true);

        Console.WriteLine($"Configuration data: {resolvedConfig.Data}");

        // Get specific value from configuration by ID
        var valueResponse = await client.Configurations.GetConfigurationValueAsync(
            newConfig.Config.Id,
            path: "setting1");

        Console.WriteLine($"Setting1 value: {valueResponse.Value}");

        // Get specific value from configuration by name
        var valueByNameResponse = await client.Configurations.GetConfigurationValueByNameAsync(
            "My New Component",
            path: "setting1");

        Console.WriteLine($"Setting1 value by name: {valueByNameResponse.Value}");

        // Update configuration
        var updateRequest = new UpdateConfigurationRequest
        {
            Data = new { setting1 = "updated_value", setting3 = "new_setting" },
            Description = "Updated description"
        };

        var updatedConfig = await client.Configurations.UpdateConfigurationAsync(
            newConfig.Config.Id, 
            updateRequest);

        Console.WriteLine($"Updated configuration: {updatedConfig.Config.UpdatedAt}");
    }

    /// <summary>
    /// Example: File management operations
    /// </summary>
    public static async Task FileManagementExample()
    {
        using var client = ConfigurationManagerClientFactory.CreateWithApiKey(
            "http://localhost:3002/api", 
            "your-api-key");

        // Replace file in configuration using file path
        var replaceResponse = await client.Files.ReplaceFileAsync(
            configId: "config-id-123",
            propertyPath: "documents.manual",
            filePath: @"C:\path\to\manual.pdf");

        Console.WriteLine($"File replaced: {replaceResponse.FileObject?.Metadata.OriginalName}");

        // Replace file using byte array
        var fileData = File.ReadAllBytes(@"C:\path\to\image.png");
        var replaceResponse2 = await client.Files.ReplaceFileAsync(
            configId: "config-id-123",
            propertyPath: "images.logo",
            fileData: fileData,
            fileName: "logo.png",
            contentType: "image/png");

        Console.WriteLine($"Image file replaced: {replaceResponse2.Success}");

        // Download file
        var downloadResult = await client.Files.DownloadFileAsync("storage-key-123");
        
        // Save downloaded file
        await client.Files.SaveFileAsync(downloadResult, @"C:\downloads\downloaded-file.pdf");
        Console.WriteLine($"File downloaded: {downloadResult.FileName}");

        // Get file information
        var fileInfo = await client.Files.GetFileInfoAsync("storage-key-123");
        Console.WriteLine($"File size: {fileInfo.Metadata.Size} bytes");

        // Import folder structure
        var folderRequest = new FolderImportRequest
        {
            FolderName = "project-assets",
            Files = new List<FolderImportFile>
            {
                new FolderImportFile
                {
                    FileStream = File.OpenRead(@"C:\project\config.json"),
                    FileName = "config.json",
                    ContentType = "application/json",
                    RelativePath = "config/config.json"
                },
                new FolderImportFile
                {
                    FileStream = File.OpenRead(@"C:\project\logo.png"),
                    FileName = "logo.png",
                    ContentType = "image/png",
                    RelativePath = "assets/logo.png"
                }
            }
        };

        var importResponse = await client.Files.ImportFolderAsync(folderRequest);
        Console.WriteLine($"Imported {importResponse.Stats.TotalFiles} files");
    }

    /// <summary>
    /// Example: User management operations (admin only)
    /// </summary>
    public static async Task UserManagementExample()
    {
        using var client = ConfigurationManagerClientFactory.CreateWithApiKey(
            "http://localhost:3002/api", 
            "your-admin-api-key");

        // Get all users
        var usersResponse = await client.Users.GetUsersAsync();
        Console.WriteLine($"Found {usersResponse.Users.Count} users");

        // Get specific user
        var userResponse = await client.Users.GetUserAsync("user-id-123");
        Console.WriteLine($"User: {userResponse.User.Username}");

        // Update user role
        var roleUpdateResponse = await client.Users.UpdateUserRoleAsync("user-id-123", "ADMIN");
        Console.WriteLine($"Updated user role: {roleUpdateResponse.User.Role}");

        // Get user's configurations
        var userConfigs = await client.Users.GetUserConfigurationsAsync("user-id-123");
        Console.WriteLine($"User has {userConfigs.Configurations.Count} configurations");

        // Delete user (be careful!)
        // var deletionResponse = await client.Users.DeleteUserAsync("user-id-123");
        // Console.WriteLine($"Deleted user: {deletionResponse.DeletedUser.Username}");
    }

    /// <summary>
    /// Example: Settings and administration (admin only)
    /// </summary>
    public static async Task SettingsAdministrationExample()
    {
        using var client = ConfigurationManagerClientFactory.CreateWithApiKey(
            "http://localhost:3002/api", 
            "your-admin-api-key");

        // Get data statistics
        var statsResponse = await client.Settings.GetDataStatisticsAsync();
        Console.WriteLine($"Total configurations: {statsResponse.Statistics?.Configurations.Total}");
        Console.WriteLine($"Total users: {statsResponse.Statistics?.Users.Total}");

        // Create backup
        var backupRequest = new Models.Settings.CreateBackupRequest
        {
            Name = "manual-backup-2024"
        };

        var backupResponse = await client.Settings.CreateBackupAsync(backupRequest);
        Console.WriteLine($"Backup created: {backupResponse.Backup?.Filename}");

        // List backups
        var backupsResponse = await client.Settings.GetBackupsAsync();
        Console.WriteLine($"Available backups: {backupsResponse.Backups.Count}");

        // Get MongoDB settings
        var mongoSettings = await client.Settings.GetMongoDbSettingsAsync();
        Console.WriteLine($"MongoDB connected: {mongoSettings.Status?.Connected}");

        // Get storage settings
        var storageSettings = await client.Settings.GetStorageSettingsAsync();
        Console.WriteLine($"Storage type: {storageSettings.StorageType}");
    }

    /// <summary>
    /// Example: Dependency injection setup
    /// </summary>
    public static void DependencyInjectionExample()
    {
        // In your Startup.cs or Program.cs
        var services = new ServiceCollection();

        // Option 1: Add with configuration action
        services.AddConfigurationManagerClient(options =>
        {
            options.BaseUrl = "http://localhost:3002/api";
            options.ApiKey = "your-api-key";
            options.Timeout = TimeSpan.FromSeconds(30);
            options.MaxFileSize = 100 * 1024 * 1024; // 100MB
        });

        // Option 2: Add with API key
        services.AddConfigurationManagerClient("http://localhost:3002/api", "your-api-key");

        // Option 3: Add from configuration section
        var configuration = new Microsoft.Extensions.Configuration.ConfigurationBuilder()
            .AddJsonFile("appsettings.json")
            .Build();

        services.AddConfigurationManagerClient(configuration, "ConfigurationManagerClient");

        // Build service provider
        var serviceProvider = services.BuildServiceProvider();

        // Use the client
        var client = serviceProvider.GetRequiredService<IConfigurationManagerClient>();
    }

    /// <summary>
    /// Example: Error handling
    /// </summary>
    public static async Task ErrorHandlingExample()
    {
        using var client = ConfigurationManagerClientFactory.CreateWithApiKey(
            "http://localhost:3002/api", 
            "your-api-key");

        try
        {
            // This will throw NotFoundException if config doesn't exist
            var config = await client.Configurations.GetConfigurationAsync("non-existent-id");
        }
        catch (NotFoundException ex)
        {
            Console.WriteLine($"Configuration not found: {ex.Message}");
        }
        catch (AuthenticationException ex)
        {
            Console.WriteLine($"Authentication failed: {ex.Message}");
        }
        catch (AuthorizationException ex)
        {
            Console.WriteLine($"Access denied: {ex.Message}");
        }
        catch (ValidationException ex)
        {
            Console.WriteLine($"Validation error: {ex.Message}");
        }
        catch (ConflictException ex)
        {
            Console.WriteLine($"Conflict: {ex.Message}");
        }
        catch (RateLimitException ex)
        {
            Console.WriteLine($"Rate limited. Retry after: {ex.RetryAfter}");
        }
        catch (ApiException ex)
        {
            Console.WriteLine($"API error: {ex.Message} (Status: {ex.StatusCode})");
            if (ex.ErrorResponse != null)
            {
                Console.WriteLine($"Error details: {ex.ErrorResponse.Details}");
            }
        }
    }
}
