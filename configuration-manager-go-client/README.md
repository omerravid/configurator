# Configuration Manager Go Client

A comprehensive Go client library for the Configuration Manager service, providing full access to authentication, REST API operations, and file management capabilities.

## Features

- ✅ **Complete API Coverage**: All REST endpoints supported
- ✅ **Authentication**: JWT token and API key authentication  
- ✅ **Configuration Management**: Full CRUD operations with inheritance and provenance
- ✅ **File Management**: Upload, download, and folder import capabilities
- ✅ **User Management**: User administration and role management
- ✅ **Rules Engine**: Validation rules management
- ✅ **Settings & Admin**: System configuration and data migration
- ✅ **Error Handling**: Comprehensive error types with proper error wrapping
- ✅ **Context Support**: All operations support context.Context for cancellation and timeouts
- ✅ **Type Safety**: Strongly typed structs for all API models
- ✅ **Modern Go**: Uses Go 1.21+ features including generics

## Installation

```bash
go get github.com/configuration-manager/go-client
```

## Quick Start

### Basic Usage

```go
package main

import (
    "context"
    "fmt"
    "log"

    configmanager "github.com/configuration-manager/go-client"
)

func main() {
    // Create client with API key
    client, err := configmanager.NewClientWithAPIKey(
        "http://localhost:3002/api", 
        "your-api-key")
    if err != nil {
        log.Fatal(err)
    }

    ctx := context.Background()

    // Check service health
    isHealthy, err := client.IsHealthy(ctx)
    if err != nil {
        log.Fatal(err)
    }
    fmt.Printf("Service healthy: %t\n", isHealthy)

    // Get all configurations
    configs, err := client.Configurations.GetAll(ctx, &configmanager.GetConfigurationsOptions{
        Type: configmanager.Ptr(configmanager.ConfigurationTypeComponent),
    })
    if err != nil {
        log.Fatal(err)
    }
    fmt.Printf("Found %d configurations\n", len(configs.Configs))
}
```

### Login-based Authentication

```go
// Create client for login
client, err := configmanager.NewClientForLogin("http://localhost:3002/api")
if err != nil {
    log.Fatal(err)
}

// Login with credentials
ctx := context.Background()
authResponse, err := client.Auth.Login(ctx, "admin", "admin123")
if err != nil {
    log.Fatal(err)
}

fmt.Printf("Logged in as: %s\n", authResponse.User.Username)

// Client is now authenticated and ready to use
configs, err := client.Configurations.GetAll(ctx, nil)
if err != nil {
    log.Fatal(err)
}
```

### Custom Client Configuration

```go
client, err := configmanager.NewClient(&configmanager.ClientOptions{
    BaseURL:     "http://localhost:3002/api",
    APIKey:      "your-api-key",
    Timeout:     30 * time.Second,
    MaxFileSize: 100 * 1024 * 1024, // 100MB
    UserAgent:   "my-application/1.0",
})
if err != nil {
    log.Fatal(err)
}
```

## API Reference

### Authentication Service

```go
// Login
authResponse, err := client.Auth.Login(ctx, "username", "password")

// Register new user  
registerResponse, err := client.Auth.Register(ctx, "newuser", "password", configmanager.Ptr("USER"))

// Get current user
currentUser, err := client.Auth.GetCurrentUser(ctx)

// Refresh token
refreshResponse, err := client.Auth.RefreshToken(ctx)

// Update token
client.Auth.SetJWTToken("new-jwt-token")
```

### Configuration Service

```go
// Get all configurations
configs, err := client.Configurations.GetAll(ctx, &configmanager.GetConfigurationsOptions{
    Type:            configmanager.Ptr(configmanager.ConfigurationTypeComponent),
    Status:          configmanager.Ptr(configmanager.ConfigurationStatusCommitted),
    IncludeArchived: configmanager.Ptr(false),
})

// Get specific configuration with provenance
config, err := client.Configurations.Get(ctx, "config-id", &configmanager.GetConfigurationOptions{
    Provenance: configmanager.Ptr(true),
})

// Create new configuration
createRequest := &configmanager.CreateConfigurationRequest{
    Name: "My Component",
    Type: configmanager.ConfigurationTypeComponent,
    Data: map[string]interface{}{
        "setting1": "value1",
        "setting2": 42,
    },
}
newConfig, err := client.Configurations.Create(ctx, createRequest)

// Update configuration
updateRequest := &configmanager.UpdateConfigurationRequest{
    Data: map[string]interface{}{
        "setting1": "updated_value",
    },
}
updated, err := client.Configurations.Update(ctx, "config-id", updateRequest)

// Get configuration value at specific path
value, err := client.Configurations.GetValue(ctx, "config-id", &configmanager.GetConfigurationValueOptions{
    Path:    configmanager.Ptr("setting1"),
    Minimal: configmanager.Ptr(true),
})

// Get child configurations
children, err := client.Configurations.GetChildren(ctx, "config-id", &configmanager.GetChildConfigurationsOptions{
    IncludeArchived: configmanager.Ptr(false),
})

// Admin operations
err = client.Configurations.Archive(ctx, "config-id", configmanager.Ptr(true))
err = client.Configurations.Restore(ctx, "config-id")
```

### File Service

```go
// Download file
downloadResult, err := client.Files.Download(ctx, "storage-key")
if err == nil {
    defer downloadResult.Content.Close()
    err = client.Files.SaveToFile(downloadResult, "/path/to/save/file.pdf")
}

// Replace file in configuration (from file path)
replaceResponse, err := client.Files.ReplaceFileFromPath(ctx, 
    "config-id", "documents.manual", "/path/to/manual.pdf")

// Replace file (from reader)
fileContent := strings.NewReader("File content")
replaceRequest := &configmanager.ReplaceFileRequest{
    ConfigID:     "config-id",
    PropertyPath: "documents.readme",
    File:         fileContent,
    FileName:     "readme.txt",
    ContentType:  "text/plain",
}
replaceResponse, err := client.Files.ReplaceFile(ctx, replaceRequest)

// Import folder structure
folderRequest := &configmanager.FolderImportRequest{
    Files: []configmanager.FolderImportFile{
        {
            File:         strings.NewReader(`{"version": "1.0"}`),
            FileName:     "config.json",
            ContentType:  "application/json",
            RelativePath: "config/config.json",
        },
    },
}
importResponse, err := client.Files.ImportFolder(ctx, folderRequest)

// Get file information
fileInfo, err := client.Files.GetInfo(ctx, "storage-key")
```

### User Service (Admin)

```go
// Get all users
users, err := client.Users.GetAll(ctx)

// Get specific user
user, err := client.Users.Get(ctx, "user-id")

// Update user role
roleUpdate, err := client.Users.UpdateRole(ctx, "user-id", "ADMIN")

// Get user's configurations
userConfigs, err := client.Users.GetConfigurations(ctx, "user-id")

// Delete user
deletion, err := client.Users.Delete(ctx, "user-id")
```

### Rules Service

```go
// Get rules for configuration
rules, err := client.Rules.GetAll(ctx, &configmanager.GetRulesOptions{
    ConfigurationID: "config-id",
})

// Create validation rule
createRuleRequest := &configmanager.CreateRuleRequest{
    ConfigurationID: "config-id",
    PropertyPath:    "settings.maxValue",
    RuleType:        configmanager.RuleTypeNumeric,
    RuleConfig: &configmanager.NumericRuleConfig{
        Min:      configmanager.Ptr(0.0),
        Max:      configmanager.Ptr(100.0),
        Required: true,
    },
}
rule, err := client.Rules.Create(ctx, createRuleRequest)

// Validate value against rules
valueToValidate := json.RawMessage("150")
validateRequest := &configmanager.ValidateRuleRequest{
    ConfigurationID: "config-id",
    PropertyPath:    "settings.maxValue",
    Value:           valueToValidate,
}
validation, err := client.Rules.Validate(ctx, validateRequest)
```

### Settings Service (Admin)

```go
// Get data statistics
stats, err := client.Settings.GetDataStatistics(ctx)

// Create backup
backupRequest := &configmanager.CreateBackupRequest{
    Name: configmanager.Ptr("manual-backup"),
}
backup, err := client.Settings.CreateBackup(ctx, backupRequest)

// List backups
backups, err := client.Settings.GetBackups(ctx)

// MongoDB operations
mongoSettings, err := client.Settings.GetMongoDBSettings(ctx)
testResult, err := client.Settings.TestMongoDBConnection(ctx, &configmanager.MongoDBTestRequest{
    ConnectionString: "mongodb://localhost:27017/configdb",
})

// Storage settings
storageSettings, err := client.Settings.GetStorageSettings(ctx)
```

## Error Handling

The library provides specific error types for different error scenarios:

```go
_, err := client.Configurations.Get(ctx, "non-existent-id", nil)
if err != nil {
    switch e := err.(type) {
    case *configmanager.NotFoundError:
        // Handle 404 errors
        fmt.Printf("Configuration not found: %s\n", e.Message)
    case *configmanager.AuthenticationError:
        // Handle 401 errors
        fmt.Printf("Authentication failed: %s\n", e.Message)
    case *configmanager.AuthorizationError:
        // Handle 403 errors
        fmt.Printf("Access denied: %s\n", e.Message)
    case *configmanager.ValidationError:
        // Handle 400 validation errors
        fmt.Printf("Validation error: %s\n", e.Message)
    case *configmanager.ConflictError:
        // Handle 409 conflicts
        fmt.Printf("Conflict: %s\n", e.Message)
    case *configmanager.RateLimitError:
        // Handle 429 rate limiting
        fmt.Printf("Rate limited. Retry after: %v\n", e.RetryAfter)
    case *configmanager.APIError:
        // Handle other API errors
        fmt.Printf("API error: %s (Status: %d)\n", e.Message, e.StatusCode)
    case *configmanager.NetworkError:
        // Handle network errors
        fmt.Printf("Network error: %s\n", e.Message)
    case *configmanager.TimeoutError:
        // Handle timeout errors
        fmt.Printf("Timeout: %s\n", e.Message)
    default:
        fmt.Printf("Unknown error: %v\n", err)
    }
}
```

## Factory Methods

```go
// With API key
client, err := configmanager.NewClientWithAPIKey(baseURL, apiKey)

// With JWT token
client, err := configmanager.NewClientWithJWTToken(baseURL, jwtToken)

// For login-based authentication
client, err := configmanager.NewClientForLogin(baseURL)

// With custom configuration
client, err := configmanager.NewClient(&configmanager.ClientOptions{
    BaseURL:     baseURL,
    APIKey:      apiKey,
    Timeout:     5 * time.Minute,
    MaxFileSize: 100 * 1024 * 1024,
})
```

## Helper Functions

The library provides a `Ptr` helper function for setting optional fields:

```go
// Instead of creating pointer variables
includeArchived := true
options := &configmanager.GetConfigurationsOptions{
    IncludeArchived: &includeArchived,
}

// Use the Ptr helper
options := &configmanager.GetConfigurationsOptions{
    IncludeArchived: configmanager.Ptr(true),
}
```

## Examples

See the [examples directory](examples/) for comprehensive examples including:

- Basic authentication and client setup
- Configuration management operations
- File upload and download operations  
- User administration
- Rules validation
- Settings and system administration
- Error handling patterns
- Advanced file operations

To run the examples:

```bash
go run examples/main.go
```

## Context Support

All service methods support `context.Context` for:

- **Cancellation**: Cancel long-running operations
- **Timeouts**: Set per-operation timeouts
- **Request propagation**: Pass request-scoped values

```go
// Set timeout for specific operation
ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
defer cancel()

config, err := client.Configurations.Get(ctx, "config-id", nil)

// Cancel operation
ctx, cancel := context.WithCancel(context.Background())
go func() {
    time.Sleep(5 * time.Second)
    cancel() // Cancel after 5 seconds
}()

result, err := client.Files.Download(ctx, "large-file-key")
```

## Configuration Options

### ClientOptions

```go
type ClientOptions struct {
    // BaseURL is the base URL of the Configuration Manager API (required)
    BaseURL string

    // APIKey for API key authentication (optional)
    APIKey string

    // JWTToken for JWT token authentication (optional)  
    JWTToken string

    // HTTPClient allows using a custom HTTP client (optional)
    HTTPClient *http.Client

    // Timeout for HTTP requests (default: 30 seconds)
    Timeout time.Duration

    // MaxFileSize for file uploads (default: 50MB)
    MaxFileSize int64

    // UserAgent for HTTP requests (optional)
    UserAgent string
}
```

## Requirements

- Go 1.21 or later
- Configuration Manager service running and accessible

## Testing

```bash
# Run tests
go test ./...

# Run tests with coverage
go test -cover ./...

# Run benchmarks
go test -bench=. ./...
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For issues and questions, please create an issue in the project repository or contact the Configuration Manager team.

## Changelog

### v2.0.0
- Initial release with complete API coverage
- Support for all Configuration Manager endpoints
- Comprehensive error handling
- File upload/download capabilities
- Context support throughout
- Type-safe API models
