# Configuration Manager .NET Client

A comprehensive C# .NET 7 client library for the Configuration Manager service, providing full access to authentication, REST API operations, and file management capabilities.

## Features

- ✅ **Complete API Coverage**: All REST endpoints supported
- ✅ **Authentication**: JWT token and API key authentication
- ✅ **Configuration Management**: Full CRUD operations with inheritance and provenance
- ✅ **File Management**: Upload, download, and folder import capabilities
- ✅ **User Management**: User administration and role management
- ✅ **Rules Engine**: Validation rules management
- ✅ **Settings & Admin**: System configuration and data migration
- ✅ **Error Handling**: Comprehensive exception types and error reporting
- ✅ **Dependency Injection**: Full DI container support
- ✅ **Async/Await**: Modern asynchronous programming patterns
- ✅ **Strongly Typed**: Complete DTOs for all API models

## Installation

Add the package reference to your project:

```xml
<PackageReference Include="ConfigurationManager.Client" Version="2.0.0" />
```

Or via NuGet Package Manager:

```bash
Install-Package ConfigurationManager.Client
```

## Quick Start

### Basic Usage

```csharp
using ConfigurationManager.Client;

// Create client with API key
using var client = ConfigurationManagerClientFactory.CreateWithApiKey(
    "http://localhost:3002/api", 
    "your-api-key");

// Check service health
var isHealthy = await client.IsHealthyAsync();

// Get all configurations
var configs = await client.Configurations.GetConfigurationsAsync();
```

### Login-based Authentication

```csharp
// Create client for login
using var client = ConfigurationManagerClientFactory.CreateForLogin("http://localhost:3002/api");

// Login with credentials
var authResponse = await client.Auth.LoginAsync("admin", "admin123");
Console.WriteLine($"Logged in as: {authResponse.User.Username}");

// The client is now authenticated and ready to use
var configs = await client.Configurations.GetConfigurationsAsync();
```

### Dependency Injection

```csharp
// In Startup.cs or Program.cs
services.AddConfigurationManagerClient(options =>
{
    options.BaseUrl = "http://localhost:3002/api";
    options.ApiKey = "your-api-key";
    options.Timeout = TimeSpan.FromSeconds(30);
});

// In your service or controller
public class MyService
{
    private readonly IConfigurationManagerClient _client;
    
    public MyService(IConfigurationManagerClient client)
    {
        _client = client;
    }
    
    public async Task<string> GetConfigValueAsync(string configId, string path)
    {
        var value = await _client.Configurations.GetConfigurationValueAsync(configId, path, minimal: true);
        return value.Value.ToString();
    }
}
```

## API Reference

### Authentication Service

```csharp
// Login
var authResponse = await client.Auth.LoginAsync("username", "password");

// Register new user
var registerResponse = await client.Auth.RegisterAsync("newuser", "password", "USER");

// Get current user
var currentUser = await client.Auth.GetCurrentUserAsync();

// Refresh token
var refreshResponse = await client.Auth.RefreshTokenAsync();

// Update token
client.Auth.SetJwtToken("new-jwt-token");
```

### Configuration Service

```csharp
// Get all configurations
var configs = await client.Configurations.GetConfigurationsAsync(
    type: ConfigurationType.COMPONENT,
    status: ConfigurationStatus.COMMITTED);

// Get specific configuration with provenance
var config = await client.Configurations.GetConfigurationAsync(
    "config-id", 
    includeProvenance: true);

// Create new configuration
var createRequest = new CreateConfigurationRequest
{
    Name = "My Component",
    Type = ConfigurationType.COMPONENT,
    Data = new { setting1 = "value1", setting2 = 42 }
};
var newConfig = await client.Configurations.CreateConfigurationAsync(createRequest);

// Update configuration
var updateRequest = new UpdateConfigurationRequest
{
    Data = new { setting1 = "updated_value" }
};
var updated = await client.Configurations.UpdateConfigurationAsync("config-id", updateRequest);

// Get configuration value at specific path
var value = await client.Configurations.GetConfigurationValueAsync(
    "config-id", 
    path: "setting1", 
    minimal: true);

// Get child configurations
var children = await client.Configurations.GetChildConfigurationsAsync("config-id");

// Admin operations
await client.Configurations.ArchiveConfigurationAsync("config-id");
await client.Configurations.RestoreConfigurationAsync("config-id");
```

### File Service

```csharp
// Download file
var downloadResult = await client.Files.DownloadFileAsync("storage-key");
await client.Files.SaveFileAsync(downloadResult, @"C:\downloads\file.pdf");

// Replace file in configuration (from file path)
var replaceResponse = await client.Files.ReplaceFileAsync(
    configId: "config-id",
    propertyPath: "documents.manual",
    filePath: @"C:\path\to\manual.pdf");

// Replace file (from byte array)
var fileData = File.ReadAllBytes(@"C:\path\to\image.png");
await client.Files.ReplaceFileAsync(
    configId: "config-id",
    propertyPath: "images.logo",
    fileData: fileData,
    fileName: "logo.png");

// Import folder structure
var folderRequest = new FolderImportRequest
{
    Files = new List<FolderImportFile>
    {
        new FolderImportFile
        {
            FileStream = File.OpenRead(@"C:\project\config.json"),
            FileName = "config.json",
            RelativePath = "config/config.json"
        }
    }
};
var importResponse = await client.Files.ImportFolderAsync(folderRequest);

// Get file information
var fileInfo = await client.Files.GetFileInfoAsync("storage-key");
```

### User Service (Admin)

```csharp
// Get all users
var users = await client.Users.GetUsersAsync();

// Get specific user
var user = await client.Users.GetUserAsync("user-id");

// Update user role
await client.Users.UpdateUserRoleAsync("user-id", "ADMIN");

// Get user's configurations
var userConfigs = await client.Users.GetUserConfigurationsAsync("user-id");

// Delete user
await client.Users.DeleteUserAsync("user-id");
```

### Rules Service

```csharp
// Get rules for configuration
var rules = await client.Rules.GetRulesAsync("config-id");

// Create validation rule
var createRuleRequest = new CreateRuleRequest
{
    ConfigurationId = "config-id",
    PropertyPath = "settings.maxValue",
    RuleType = RuleType.Numeric,
    RuleConfig = new NumericRuleConfig { Min = 0, Max = 100 }
};
var rule = await client.Rules.CreateRuleAsync(createRuleRequest);

// Validate value against rules
var validateRequest = new ValidateRuleRequest
{
    ConfigurationId = "config-id",
    PropertyPath = "settings.maxValue",
    Value = JsonSerializer.SerializeToElement(150)
};
var validation = await client.Rules.ValidateValueAsync(validateRequest);
```

### Settings Service (Admin)

```csharp
// Get data statistics
var stats = await client.Settings.GetDataStatisticsAsync();

// Create backup
var backupRequest = new CreateBackupRequest { Name = "manual-backup" };
var backup = await client.Settings.CreateBackupAsync(backupRequest);

// List backups
var backups = await client.Settings.GetBackupsAsync();

// MongoDB operations
var mongoSettings = await client.Settings.GetMongoDbSettingsAsync();
var testResult = await client.Settings.TestMongoDbConnectionAsync(new MongoDbTestRequest
{
    ConnectionString = "mongodb://localhost:27017/configdb"
});

// Storage settings
var storageSettings = await client.Settings.GetStorageSettingsAsync();
```

## Error Handling

The library provides specific exception types for different error scenarios:

```csharp
try
{
    var config = await client.Configurations.GetConfigurationAsync("non-existent-id");
}
catch (NotFoundException ex)
{
    // Handle 404 errors
    Console.WriteLine($"Configuration not found: {ex.Message}");
}
catch (AuthenticationException ex)
{
    // Handle 401 errors
    Console.WriteLine($"Authentication failed: {ex.Message}");
}
catch (AuthorizationException ex)
{
    // Handle 403 errors
    Console.WriteLine($"Access denied: {ex.Message}");
}
catch (ValidationException ex)
{
    // Handle 400 validation errors
    Console.WriteLine($"Validation error: {ex.Message}");
}
catch (ConflictException ex)
{
    // Handle 409 conflicts
    Console.WriteLine($"Conflict: {ex.Message}");
}
catch (RateLimitException ex)
{
    // Handle 429 rate limiting
    Console.WriteLine($"Rate limited. Retry after: {ex.RetryAfter}");
}
catch (ApiException ex)
{
    // Handle other API errors
    Console.WriteLine($"API error: {ex.Message} (Status: {ex.StatusCode})");
}
```

## Configuration

### Client Options

```csharp
var client = new ConfigurationManagerClient(options =>
{
    options.BaseUrl = "http://localhost:3002/api";
    options.ApiKey = "your-api-key";
    options.JwtToken = "your-jwt-token";
    options.Timeout = TimeSpan.FromSeconds(30);
    options.MaxFileSize = 50 * 1024 * 1024; // 50MB
    options.IncludeDetailedErrors = true;
});
```

### Configuration from appsettings.json

```json
{
  "ConfigurationManagerClient": {
    "BaseUrl": "http://localhost:3002/api",
    "ApiKey": "your-api-key",
    "Timeout": "00:00:30",
    "MaxFileSize": 52428800
  }
}
```

```csharp
services.AddConfigurationManagerClient(configuration, "ConfigurationManagerClient");
```

## Factory Methods

```csharp
// With API key
var client = ConfigurationManagerClientFactory.CreateWithApiKey(baseUrl, apiKey);

// With JWT token
var client = ConfigurationManagerClientFactory.CreateWithJwtToken(baseUrl, jwtToken);

// For login-based authentication
var client = ConfigurationManagerClientFactory.CreateForLogin(baseUrl);

// With custom configuration
var client = ConfigurationManagerClientFactory.Create(options => {
    options.BaseUrl = baseUrl;
    options.ApiKey = apiKey;
    options.Timeout = TimeSpan.FromMinutes(5);
});
```

## Requirements

- .NET 7.0 or later
- Configuration Manager service running and accessible

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions, please contact the Configuration Manager team or create an issue in the project repository.
