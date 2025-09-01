// Package configmanager provides a comprehensive Go client for the Configuration Manager service.
//
// This client library supports all Configuration Manager REST API operations including:
//   - Authentication (JWT and API key)
//   - Configuration management with inheritance and provenance
//   - File uploads, downloads, and folder imports
//   - User management and administration
//   - Validation rules management
//   - System settings and data migration
//
// Example usage:
//
//	// Create client with API key
//	client := configmanager.NewClientWithAPIKey("http://localhost:3002/api", "your-api-key")
//
//	// Login-based authentication
//	client := configmanager.NewClient("http://localhost:3002/api")
//	auth, err := client.Auth.Login(ctx, "admin", "admin123")
//	if err != nil {
//		log.Fatal(err)
//	}
//
//	// Get configurations
//	configs, err := client.Configurations.GetAll(ctx, &configmanager.GetConfigurationsOptions{
//		Type: configmanager.Ptr(configmanager.ConfigurationTypeComponent),
//	})
package configmanager

import (
	"context"
	"fmt"
	"net/http"
	"time"
)

// Client is the main Configuration Manager client that provides access to all services.
type Client struct {
	// Auth provides authentication operations
	Auth *AuthService

	// Configurations provides configuration management operations
	Configurations *ConfigurationService

	// Files provides file management operations
	Files *FileService

	// Users provides user management operations
	Users *UserService

	// Rules provides validation rules operations
	Rules *RulesService

	// Settings provides settings and administration operations
	Settings *SettingsService

	// httpClient is the underlying HTTP client
	httpClient *HTTPClient
}

// ClientOptions configures the Configuration Manager client.
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

// NewClient creates a new Configuration Manager client with the specified options.
func NewClient(options *ClientOptions) (*Client, error) {
	if options == nil {
		return nil, fmt.Errorf("client options cannot be nil")
	}

	if options.BaseURL == "" {
		return nil, fmt.Errorf("base URL is required")
	}

	// Set defaults
	if options.Timeout == 0 {
		options.Timeout = 30 * time.Second
	}

	if options.MaxFileSize == 0 {
		options.MaxFileSize = 50 * 1024 * 1024 // 50MB
	}

	if options.UserAgent == "" {
		options.UserAgent = "configuration-manager-go-client/2.0.0"
	}

	// Create HTTP client
	httpClient := NewHTTPClient(options)

	// Create service clients
	client := &Client{
		httpClient:     httpClient,
		Auth:           NewAuthService(httpClient),
		Configurations: NewConfigurationService(httpClient),
		Files:          NewFileService(httpClient),
		Users:          NewUserService(httpClient),
		Rules:          NewRulesService(httpClient),
		Settings:       NewSettingsService(httpClient),
	}

	return client, nil
}

// NewClientWithAPIKey creates a new client with API key authentication.
func NewClientWithAPIKey(baseURL, apiKey string) (*Client, error) {
	return NewClient(&ClientOptions{
		BaseURL: baseURL,
		APIKey:  apiKey,
	})
}

// NewClientWithJWTToken creates a new client with JWT token authentication.
func NewClientWithJWTToken(baseURL, jwtToken string) (*Client, error) {
	return NewClient(&ClientOptions{
		BaseURL:  baseURL,
		JWTToken: jwtToken,
	})
}

// NewClientForLogin creates a new client for login-based authentication.
func NewClientForLogin(baseURL string) (*Client, error) {
	return NewClient(&ClientOptions{
		BaseURL: baseURL,
	})
}

// SetJWTToken updates the JWT token for authentication.
func (c *Client) SetJWTToken(token string) {
	c.httpClient.SetJWTToken(token)
}

// SetAPIKey updates the API key for authentication.
func (c *Client) SetAPIKey(apiKey string) {
	c.httpClient.SetAPIKey(apiKey)
}

// IsHealthy checks if the Configuration Manager service is healthy.
func (c *Client) IsHealthy(ctx context.Context) (bool, error) {
	resp, err := c.httpClient.Get(ctx, "/health")
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()

	return resp.StatusCode == http.StatusOK, nil
}

// Ptr returns a pointer to the given value. Useful for setting optional fields.
func Ptr[T any](v T) *T {
	return &v
}
