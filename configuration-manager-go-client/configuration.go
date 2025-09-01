package configmanager

import (
	"encoding/json"
	"time"
)

// Configuration represents a configuration entity
type Configuration struct {
	ID          string              `json:"id"`
	Name        string              `json:"name"`
	Type        ConfigurationType   `json:"type"`
	ParentID    *string             `json:"parent_id"`
	Data        json.RawMessage     `json:"data"`
	CreatedBy   string              `json:"created_by"`
	Description *string             `json:"description"`
	Status      ConfigurationStatus `json:"status"`
	Archived    bool                `json:"archived"`
	CreatedAt   time.Time           `json:"created_at"`
	UpdatedAt   time.Time           `json:"updated_at"`
}

// GetConfigurationsOptions represents options for getting configurations
type GetConfigurationsOptions struct {
	Type            *ConfigurationType   `json:"type,omitempty"`
	Status          *ConfigurationStatus `json:"status,omitempty"`
	IncludeArchived *bool                `json:"includeArchived,omitempty"`
}

// ConfigurationListResponse represents configuration list response
type ConfigurationListResponse struct {
	Configs []Configuration `json:"configs"`
}

// CreateConfigurationRequest represents create configuration request
type CreateConfigurationRequest struct {
	Name        string            `json:"name"`
	Type        ConfigurationType `json:"type"`
	ParentID    *string           `json:"parent_id,omitempty"`
	Data        interface{}       `json:"data"`
	Description *string           `json:"description,omitempty"`
}

// UpdateConfigurationRequest represents update configuration request
type UpdateConfigurationRequest struct {
	Data        interface{} `json:"data,omitempty"`
	Description *string     `json:"description,omitempty"`
}

// ConfigurationResponse represents configuration response with message
type ConfigurationResponse struct {
	Config  Configuration `json:"config"`
	Message *string       `json:"message,omitempty"`
}

// ResolvedConfigurationResponse represents resolved configuration response
type ResolvedConfigurationResponse struct {
	Config           Configuration          `json:"config"`
	Data             json.RawMessage        `json:"data"`
	InheritanceChain []ConfigurationSummary `json:"inheritance_chain,omitempty"`
}

// ConfigurationSummary represents configuration summary for inheritance chain
type ConfigurationSummary struct {
	ID   string            `json:"id"`
	Name string            `json:"name"`
	Type ConfigurationType `json:"type"`
}

// GetConfigurationOptions represents options for getting a configuration
type GetConfigurationOptions struct {
	Provenance *bool `json:"provenance,omitempty"`
	Raw        *bool `json:"raw,omitempty"`
}

// ConfigurationValueResponse represents configuration value response
type ConfigurationValueResponse struct {
	Value  json.RawMessage        `json:"value"`
	Path   *string                `json:"path,omitempty"`
	Source *ConfigurationSource   `json:"source,omitempty"`
	Config *ConfigurationSummary  `json:"config,omitempty"`
	Data   *json.RawMessage       `json:"data,omitempty"`
}

// GetConfigurationValueOptions represents options for getting configuration value
type GetConfigurationValueOptions struct {
	Path    *string `json:"path,omitempty"`
	Minimal *bool   `json:"minimal,omitempty"`
}

// ConfigurationSource represents configuration source information
type ConfigurationSource struct {
	ID        string             `json:"id"`
	Name      string             `json:"name"`
	Type      ConfigurationType  `json:"type"`
	CreatedBy *string            `json:"createdBy,omitempty"`
	CreatedAt *time.Time         `json:"createdAt,omitempty"`
}

// ChildrenConfigurationResponse represents children configurations response
type ChildrenConfigurationResponse struct {
	Children []Configuration `json:"children"`
	Count    int             `json:"count"`
}

// GetChildConfigurationsOptions represents options for getting child configurations
type GetChildConfigurationsOptions struct {
	IncludeArchived *bool `json:"includeArchived,omitempty"`
}

// ComponentsResponse represents components with versions response
type ComponentsResponse struct {
	Components []ComponentWithVersions `json:"components"`
}

// ComponentWithVersions represents a component with its versions
type ComponentWithVersions struct {
	ID          string              `json:"id"`
	Name        string              `json:"name"`
	Type        ConfigurationType   `json:"type"`
	Description *string             `json:"description"`
	Status      ConfigurationStatus `json:"status"`
	CreatedBy   string              `json:"created_by"`
	CreatedAt   time.Time           `json:"created_at"`
	Versions    []Configuration     `json:"versions"`
}

// RenameConfigurationRequest represents rename configuration request
type RenameConfigurationRequest struct {
	Name string `json:"name"`
}

// ArchiveConfigurationRequest represents archive configuration request
type ArchiveConfigurationRequest struct {
	ArchiveChildren *bool `json:"archiveChildren,omitempty"`
}

// ConfigurationService provides configuration management operations
type ConfigurationService struct {
	client *HTTPClient
}

// NewConfigurationService creates a new configuration service
func NewConfigurationService(client *HTTPClient) *ConfigurationService {
	return &ConfigurationService{client: client}
}
