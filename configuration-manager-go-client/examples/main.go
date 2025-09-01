package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	configmanager "github.com/configuration-manager/go-client"
)

func main() {
	// Example 1: Basic client setup and authentication
	basicAuthenticationExample()

	// Example 2: Configuration management operations
	configurationManagementExample()

	// Example 3: File management operations
	fileManagementExample()

	// Example 4: User management operations (admin only)
	userManagementExample()

	// Example 5: Rules management
	rulesManagementExample()

	// Example 6: Settings and administration (admin only)
	settingsAdministrationExample()

	// Example 7: Error handling
	errorHandlingExample()
}

// Example 1: Basic client setup and authentication
func basicAuthenticationExample() {
	fmt.Println("=== Basic Authentication Example ===")

	// Option 1: Create client with API key
	client, err := configmanager.NewClientWithAPIKey("http://localhost:3002/api", "your-api-key")
	if err != nil {
		log.Printf("Failed to create client with API key: %v", err)
		return
	}

	// Option 2: Create client for login-based authentication
	loginClient, err := configmanager.NewClientForLogin("http://localhost:3002/api")
	if err != nil {
		log.Printf("Failed to create login client: %v", err)
		return
	}

	// Login with username and password
	ctx := context.Background()
	authResponse, err := loginClient.Auth.Login(ctx, "admin", "admin123")
	if err != nil {
		log.Printf("Login failed: %v", err)
		return
	}

	fmt.Printf("Logged in as: %s\n", authResponse.User.Username)

	// Option 3: Create client with JWT token
	jwtClient, err := configmanager.NewClientWithJWTToken("http://localhost:3002/api", authResponse.Token)
	if err != nil {
		log.Printf("Failed to create JWT client: %v", err)
		return
	}

	// Check if the service is healthy
	isHealthy, err := client.IsHealthy(ctx)
	if err != nil {
		log.Printf("Health check failed: %v", err)
		return
	}

	fmt.Printf("Service health: %t\n", isHealthy)
	fmt.Println()
}

// Example 2: Configuration management operations
func configurationManagementExample() {
	fmt.Println("=== Configuration Management Example ===")

	client, err := configmanager.NewClientWithAPIKey("http://localhost:3002/api", "your-api-key")
	if err != nil {
		log.Printf("Failed to create client: %v", err)
		return
	}

	ctx := context.Background()

	// Get all configurations
	configsResponse, err := client.Configurations.GetAll(ctx, &configmanager.GetConfigurationsOptions{
		Type:            configmanager.Ptr(configmanager.ConfigurationTypeComponent),
		IncludeArchived: configmanager.Ptr(false),
	})
	if err != nil {
		log.Printf("Failed to get configurations: %v", err)
		return
	}

	fmt.Printf("Found %d configurations\n", len(configsResponse.Configs))

	// Create a new configuration
	createRequest := &configmanager.CreateConfigurationRequest{
		Name: "My New Component",
		Type: configmanager.ConfigurationTypeComponent,
		Data: map[string]interface{}{
			"setting1": "value1",
			"setting2": 42,
		},
		Description: configmanager.Ptr("Example component configuration"),
	}

	newConfig, err := client.Configurations.Create(ctx, createRequest)
	if err != nil {
		log.Printf("Failed to create configuration: %v", err)
		return
	}

	fmt.Printf("Created configuration: %s\n", newConfig.Config.ID)

	// Get configuration with provenance
	resolvedConfig, err := client.Configurations.Get(ctx, newConfig.Config.ID, &configmanager.GetConfigurationOptions{
		Provenance: configmanager.Ptr(true),
	})
	if err != nil {
		log.Printf("Failed to get configuration: %v", err)
		return
	}

	fmt.Printf("Configuration data: %s\n", string(resolvedConfig.Data))

	// Get specific value from configuration
	valueResponse, err := client.Configurations.GetValue(ctx, newConfig.Config.ID, &configmanager.GetConfigurationValueOptions{
		Path: configmanager.Ptr("setting1"),
	})
	if err != nil {
		log.Printf("Failed to get configuration value: %v", err)
		return
	}

	fmt.Printf("Setting1 value: %s\n", string(valueResponse.Value))

	// Update configuration
	updateRequest := &configmanager.UpdateConfigurationRequest{
		Data: map[string]interface{}{
			"setting1": "updated_value",
			"setting3": "new_setting",
		},
		Description: configmanager.Ptr("Updated description"),
	}

	updatedConfig, err := client.Configurations.Update(ctx, newConfig.Config.ID, updateRequest)
	if err != nil {
		log.Printf("Failed to update configuration: %v", err)
		return
	}

	fmt.Printf("Updated configuration: %s\n", updatedConfig.Config.UpdatedAt.Format(time.RFC3339))
	fmt.Println()
}

// Example 3: File management operations
func fileManagementExample() {
	fmt.Println("=== File Management Example ===")

	client, err := configmanager.NewClientWithAPIKey("http://localhost:3002/api", "your-api-key")
	if err != nil {
		log.Printf("Failed to create client: %v", err)
		return
	}

	ctx := context.Background()

	// Replace file in configuration using file path
	replaceResponse, err := client.Files.ReplaceFileFromPath(ctx, "config-id-123", "documents.manual", "/path/to/manual.pdf")
	if err != nil {
		log.Printf("Failed to replace file: %v", err)
		return
	}

	if replaceResponse.Success {
		fmt.Printf("File replaced: %s\n", replaceResponse.FileObject.Metadata.OriginalName)
	}

	// Replace file using file content
	fileContent := strings.NewReader("This is a test file content")
	replaceRequest := &configmanager.ReplaceFileRequest{
		ConfigID:     "config-id-123",
		PropertyPath: "documents.readme",
		File:         fileContent,
		FileName:     "readme.txt",
		ContentType:  "text/plain",
	}

	replaceResponse2, err := client.Files.ReplaceFile(ctx, replaceRequest)
	if err != nil {
		log.Printf("Failed to replace file: %v", err)
		return
	}

	fmt.Printf("File replacement success: %t\n", replaceResponse2.Success)

	// Download file
	downloadResult, err := client.Files.Download(ctx, "storage-key-123")
	if err != nil {
		log.Printf("Failed to download file: %v", err)
		return
	}

	// Save downloaded file
	err = client.Files.SaveToFile(downloadResult, "/downloads/downloaded-file.pdf")
	if err != nil {
		log.Printf("Failed to save file: %v", err)
		return
	}

	fmt.Printf("File downloaded: %s\n", downloadResult.FileName)

	// Get file information
	fileInfo, err := client.Files.GetInfo(ctx, "storage-key-123")
	if err != nil {
		log.Printf("Failed to get file info: %v", err)
		return
	}

	fmt.Printf("File size: %d bytes\n", fileInfo.Metadata.Size)

	// Import folder structure
	folderRequest := &configmanager.FolderImportRequest{
		FolderName: configmanager.Ptr("project-assets"),
		Files: []configmanager.FolderImportFile{
			{
				File:         strings.NewReader(`{"version": "1.0"}`),
				FileName:     "config.json",
				ContentType:  "application/json",
				RelativePath: "config/config.json",
			},
			{
				File:         strings.NewReader("Binary file content"),
				FileName:     "logo.png",
				ContentType:  "image/png",
				RelativePath: "assets/logo.png",
			},
		},
	}

	importResponse, err := client.Files.ImportFolder(ctx, folderRequest)
	if err != nil {
		log.Printf("Failed to import folder: %v", err)
		return
	}

	fmt.Printf("Imported %d files\n", importResponse.Stats.TotalFiles)
	fmt.Println()
}

// Example 4: User management operations (admin only)
func userManagementExample() {
	fmt.Println("=== User Management Example ===")

	client, err := configmanager.NewClientWithAPIKey("http://localhost:3002/api", "your-admin-api-key")
	if err != nil {
		log.Printf("Failed to create client: %v", err)
		return
	}

	ctx := context.Background()

	// Get all users
	usersResponse, err := client.Users.GetAll(ctx)
	if err != nil {
		log.Printf("Failed to get users: %v", err)
		return
	}

	fmt.Printf("Found %d users\n", len(usersResponse.Users))

	// Get specific user
	userResponse, err := client.Users.Get(ctx, "user-id-123")
	if err != nil {
		log.Printf("Failed to get user: %v", err)
		return
	}

	fmt.Printf("User: %s\n", userResponse.User.Username)

	// Update user role
	roleUpdateResponse, err := client.Users.UpdateRole(ctx, "user-id-123", "ADMIN")
	if err != nil {
		log.Printf("Failed to update user role: %v", err)
		return
	}

	fmt.Printf("Updated user role: %s\n", roleUpdateResponse.User.Role)

	// Get user's configurations
	userConfigs, err := client.Users.GetConfigurations(ctx, "user-id-123")
	if err != nil {
		log.Printf("Failed to get user configurations: %v", err)
		return
	}

	fmt.Printf("User has %d configurations\n", len(userConfigs.Configurations))

	// Delete user (be careful!)
	// deletionResponse, err := client.Users.Delete(ctx, "user-id-123")
	// if err != nil {
	//     log.Printf("Failed to delete user: %v", err)
	//     return
	// }
	// fmt.Printf("Deleted user: %s\n", deletionResponse.DeletedUser.Username)
	fmt.Println()
}

// Example 5: Rules management
func rulesManagementExample() {
	fmt.Println("=== Rules Management Example ===")

	client, err := configmanager.NewClientWithAPIKey("http://localhost:3002/api", "your-api-key")
	if err != nil {
		log.Printf("Failed to create client: %v", err)
		return
	}

	ctx := context.Background()

	// Get rules for configuration
	rules, err := client.Rules.GetAll(ctx, &configmanager.GetRulesOptions{
		ConfigurationID: "config-id-123",
	})
	if err != nil {
		log.Printf("Failed to get rules: %v", err)
		return
	}

	fmt.Printf("Found %d rules\n", len(rules.Rules))

	// Create validation rule
	createRuleRequest := &configmanager.CreateRuleRequest{
		ConfigurationID: "config-id-123",
		PropertyPath:    "settings.maxValue",
		RuleType:        configmanager.RuleTypeNumeric,
		RuleConfig: &configmanager.NumericRuleConfig{
			Min:      configmanager.Ptr(0.0),
			Max:      configmanager.Ptr(100.0),
			Required: true,
		},
		ErrorMessage: configmanager.Ptr("Value must be between 0 and 100"),
	}

	rule, err := client.Rules.Create(ctx, createRuleRequest)
	if err != nil {
		log.Printf("Failed to create rule: %v", err)
		return
	}

	fmt.Printf("Created rule: %s\n", rule.Rule.ID)

	// Validate value against rules
	valueToValidate := json.RawMessage("150") // This should fail validation
	validateRequest := &configmanager.ValidateRuleRequest{
		ConfigurationID: "config-id-123",
		PropertyPath:    "settings.maxValue",
		Value:           valueToValidate,
	}

	validation, err := client.Rules.Validate(ctx, validateRequest)
	if err != nil {
		log.Printf("Failed to validate value: %v", err)
		return
	}

	fmt.Printf("Validation result - Valid: %t\n", validation.Valid)
	if !validation.Valid && len(validation.Errors) > 0 {
		fmt.Printf("Validation errors: %v\n", validation.Errors)
	}
	fmt.Println()
}

// Example 6: Settings and administration (admin only)
func settingsAdministrationExample() {
	fmt.Println("=== Settings Administration Example ===")

	client, err := configmanager.NewClientWithAPIKey("http://localhost:3002/api", "your-admin-api-key")
	if err != nil {
		log.Printf("Failed to create client: %v", err)
		return
	}

	ctx := context.Background()

	// Get data statistics
	statsResponse, err := client.Settings.GetDataStatistics(ctx)
	if err != nil {
		log.Printf("Failed to get data statistics: %v", err)
		return
	}

	if statsResponse.Statistics != nil {
		fmt.Printf("Total configurations: %d\n", statsResponse.Statistics.Configurations.Total)
		fmt.Printf("Total users: %d\n", statsResponse.Statistics.Users.Total)
	}

	// Create backup
	backupRequest := &configmanager.CreateBackupRequest{
		Name: configmanager.Ptr("manual-backup-2024"),
	}

	backupResponse, err := client.Settings.CreateBackup(ctx, backupRequest)
	if err != nil {
		log.Printf("Failed to create backup: %v", err)
		return
	}

	if backupResponse.Backup != nil {
		fmt.Printf("Backup created: %s\n", backupResponse.Backup.Filename)
	}

	// List backups
	backupsResponse, err := client.Settings.GetBackups(ctx)
	if err != nil {
		log.Printf("Failed to list backups: %v", err)
		return
	}

	fmt.Printf("Available backups: %d\n", len(backupsResponse.Backups))

	// Get MongoDB settings
	mongoSettings, err := client.Settings.GetMongoDBSettings(ctx)
	if err != nil {
		log.Printf("Failed to get MongoDB settings: %v", err)
		return
	}

	if mongoSettings.Status != nil {
		fmt.Printf("MongoDB connected: %t\n", mongoSettings.Status.Connected)
	}

	// Get storage settings
	storageSettings, err := client.Settings.GetStorageSettings(ctx)
	if err != nil {
		log.Printf("Failed to get storage settings: %v", err)
		return
	}

	fmt.Printf("Storage type: %s\n", storageSettings.StorageType)
	fmt.Println()
}

// Example 7: Error handling
func errorHandlingExample() {
	fmt.Println("=== Error Handling Example ===")

	client, err := configmanager.NewClientWithAPIKey("http://localhost:3002/api", "your-api-key")
	if err != nil {
		log.Printf("Failed to create client: %v", err)
		return
	}

	ctx := context.Background()

	// This will trigger various types of errors
	_, err = client.Configurations.Get(ctx, "non-existent-id", nil)
	if err != nil {
		switch e := err.(type) {
		case *configmanager.NotFoundError:
			fmt.Printf("Configuration not found: %s\n", e.Message)
		case *configmanager.AuthenticationError:
			fmt.Printf("Authentication failed: %s\n", e.Message)
		case *configmanager.AuthorizationError:
			fmt.Printf("Access denied: %s\n", e.Message)
		case *configmanager.ValidationError:
			fmt.Printf("Validation error: %s\n", e.Message)
		case *configmanager.ConflictError:
			fmt.Printf("Conflict: %s\n", e.Message)
		case *configmanager.RateLimitError:
			fmt.Printf("Rate limited. Retry after: %v\n", e.RetryAfter)
		case *configmanager.APIError:
			fmt.Printf("API error: %s (Status: %d)\n", e.Message, e.StatusCode)
			if e.ErrorResponse != nil {
				fmt.Printf("Error details: %s\n", e.ErrorResponse.Details)
			}
		case *configmanager.NetworkError:
			fmt.Printf("Network error: %s\n", e.Message)
		case *configmanager.TimeoutError:
			fmt.Printf("Timeout error: %s (Timeout: %v)\n", e.Message, e.Timeout)
		default:
			fmt.Printf("Unknown error: %v\n", err)
		}
	}
	fmt.Println()
}

// Helper function to demonstrate client configuration options
func customClientExample() {
	fmt.Println("=== Custom Client Configuration Example ===")

	// Create client with custom options
	client, err := configmanager.NewClient(&configmanager.ClientOptions{
		BaseURL:     "http://localhost:3002/api",
		APIKey:      "your-api-key",
		Timeout:     30 * time.Second,
		MaxFileSize: 100 * 1024 * 1024, // 100MB
		UserAgent:   "my-application/1.0",
	})
	if err != nil {
		log.Printf("Failed to create custom client: %v", err)
		return
	}

	ctx := context.Background()
	isHealthy, err := client.IsHealthy(ctx)
	if err != nil {
		log.Printf("Health check failed: %v", err)
		return
	}

	fmt.Printf("Service health with custom client: %t\n", isHealthy)
}

// Helper function for demonstrating advanced file operations
func advancedFileOperationsExample() {
	fmt.Println("=== Advanced File Operations Example ===")

	client, err := configmanager.NewClientWithAPIKey("http://localhost:3002/api", "your-api-key")
	if err != nil {
		log.Printf("Failed to create client: %v", err)
		return
	}

	ctx := context.Background()

	// Create a temporary file for testing
	tempFile, err := os.CreateTemp("", "test-upload-*.txt")
	if err != nil {
		log.Printf("Failed to create temp file: %v", err)
		return
	}
	defer os.Remove(tempFile.Name())

	// Write some content to the temp file
	content := "This is a test file for upload"
	if _, err := tempFile.WriteString(content); err != nil {
		log.Printf("Failed to write to temp file: %v", err)
		return
	}
	tempFile.Close()

	// Upload the file
	replaceResponse, err := client.Files.ReplaceFileFromPath(ctx, "config-id-123", "documents.test", tempFile.Name())
	if err != nil {
		log.Printf("Failed to upload file: %v", err)
		return
	}

	fmt.Printf("File upload success: %t\n", replaceResponse.Success)

	// Download and verify the content
	if replaceResponse.FileObject != nil {
		storageKey := replaceResponse.FileObject.Metadata.StorageKey
		downloadResult, err := client.Files.Download(ctx, storageKey)
		if err != nil {
			log.Printf("Failed to download file: %v", err)
			return
		}
		defer downloadResult.Content.Close()

		// Read the downloaded content
		downloadedContent := make([]byte, len(content))
		n, err := downloadResult.Content.Read(downloadedContent)
		if err != nil && err.Error() != "EOF" {
			log.Printf("Failed to read downloaded content: %v", err)
			return
		}

		fmt.Printf("Downloaded content matches: %t\n", string(downloadedContent[:n]) == content)
	}
	fmt.Println()
}
