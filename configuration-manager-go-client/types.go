package configmanager

import (
	"encoding/json"
	"time"
)

// Configuration types
type ConfigurationType string

const (
	ConfigurationTypeProduct   ConfigurationType = "PRODUCT"
	ConfigurationTypeInstance  ConfigurationType = "INSTANCE"
	ConfigurationTypeUser      ConfigurationType = "USER"
	ConfigurationTypeComponent ConfigurationType = "COMPONENT"
	ConfigurationTypeVersion   ConfigurationType = "VERSION"
)

// Configuration status
type ConfigurationStatus string

const (
	ConfigurationStatusDraft     ConfigurationStatus = "DRAFT"
	ConfigurationStatusCommitted ConfigurationStatus = "COMMITTED"
)

// User roles
type UserRole string

const (
	UserRoleAdmin UserRole = "ADMIN"
	UserRoleUser  UserRole = "USER"
)

// Rule types for validation
type RuleType string

const (
	RuleTypeNumeric    RuleType = "numeric"
	RuleTypePattern    RuleType = "pattern"
	RuleTypeCollection RuleType = "collection"
)

// Storage types
type StorageType string

const (
	StorageTypeEmbedded StorageType = "embedded"
	StorageTypeS3       StorageType = "s3"
)

// APIErrorResponse represents standard API error response
type APIErrorResponse struct {
	Error   string `json:"error"`
	Details string `json:"details,omitempty"`
	Code    string `json:"code,omitempty"`
}

// APIResponse represents standard success response
type APIResponse[T any] struct {
	Success bool   `json:"success"`
	Message string `json:"message,omitempty"`
	Data    T      `json:"data,omitempty"`
}

// PaginationInfo represents pagination information
type PaginationInfo struct {
	Page       int `json:"page"`
	PageSize   int `json:"pageSize"`
	Total      int `json:"total"`
	TotalPages int `json:"totalPages"`
}

// FileMetadata represents file metadata
type FileMetadata struct {
	StorageKey   string    `json:"storageKey"`
	OriginalName string    `json:"originalName"`
	MimeType     string    `json:"mimeType"`
	Size         int64     `json:"size"`
	StorageType  string    `json:"storageType"`
	UploadedAt   time.Time `json:"uploaded_at"`
}

// FileObject represents a file object as stored in configurations
type FileObject struct {
	Type     string        `json:"_type"`
	Metadata *FileMetadata `json:"_metadata"`
	Link     string        `json:"_link"`
}

// HealthResponse represents health check response
type HealthResponse struct {
	Status    string    `json:"status"`
	Timestamp time.Time `json:"timestamp"`
}
