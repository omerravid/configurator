package configmanager

import (
	"encoding/json"
	"time"
)

// MongoDBSettings represents MongoDB configuration settings
type MongoDBSettings struct {
	ConnectionString string            `json:"connectionString"`
	Options          *MongoDBOptions   `json:"options,omitempty"`
}

// MongoDBOptions represents MongoDB connection options
type MongoDBOptions struct {
	UseNewURLParser     bool `json:"useNewUrlParser"`
	UseUnifiedTopology  bool `json:"useUnifiedTopology"`
}

// MongoDBSettingsResponse represents MongoDB settings response
type MongoDBSettingsResponse struct {
	Success  bool            `json:"success"`
	Settings *MongoDBSettings `json:"settings,omitempty"`
	Status   *MongoDBStatus   `json:"status,omitempty"`
}

// MongoDBStatus represents MongoDB connection status
type MongoDBStatus struct {
	Connected bool    `json:"connected"`
	Host      *string `json:"host,omitempty"`
	Database  *string `json:"database,omitempty"`
	Type      *string `json:"type,omitempty"`
}

// MongoDBTestRequest represents MongoDB connection test request
type MongoDBTestRequest struct {
	ConnectionString string `json:"connectionString"`
}

// MongoDBTestResponse represents MongoDB connection test response
type MongoDBTestResponse struct {
	Success bool                 `json:"success"`
	Message string               `json:"message"`
	Details *MongoDBTestDetails  `json:"details,omitempty"`
}

// MongoDBTestDetails represents MongoDB connection test details
type MongoDBTestDetails struct {
	Host      *string `json:"host,omitempty"`
	Database  *string `json:"database,omitempty"`
	Connected bool    `json:"connected"`
	Latency   *int    `json:"latency,omitempty"`
}

// MigrationRequest represents migration request
type MigrationRequest struct {
	ConnectionString string `json:"connectionString"`
	CreateBackup     *bool  `json:"createBackup,omitempty"`
}

// MigrationResponse represents migration response
type MigrationResponse struct {
	Success       bool                 `json:"success"`
	Message       string               `json:"message"`
	Migrated      *MigrationStats      `json:"migrated,omitempty"`
	Backup        *BackupInfo          `json:"backup,omitempty"`
	EmbeddedMongo *EmbeddedMongoInfo   `json:"embeddedMongo,omitempty"`
}

// MigrationStats represents migration statistics
type MigrationStats struct {
	Users          int `json:"users"`
	Configurations int `json:"configurations"`
}

// EmbeddedMongoInfo represents embedded MongoDB information
type EmbeddedMongoInfo struct {
	Started          bool    `json:"started"`
	ConnectionString *string `json:"connectionString,omitempty"`
}

// DataStatisticsResponse represents data statistics response
type DataStatisticsResponse struct {
	Success    bool             `json:"success"`
	Statistics *DataStatistics  `json:"statistics,omitempty"`
}

// DataStatistics represents data statistics
type DataStatistics struct {
	Users          UserStatistics          `json:"users"`
	Configurations ConfigurationStatistics `json:"configurations"`
	Storage        StorageStatistics       `json:"storage"`
}

// UserStatistics represents user statistics
type UserStatistics struct {
	Total        int `json:"total"`
	Admins       int `json:"admins"`
	RegularUsers int `json:"regularUsers"`
}

// ConfigurationStatistics represents configuration statistics
type ConfigurationStatistics struct {
	Total    int            `json:"total"`
	ByType   map[string]int `json:"byType"`
	ByStatus map[string]int `json:"byStatus"`
	Archived int            `json:"archived"`
}

// StorageStatistics represents storage statistics
type StorageStatistics struct {
	Type       string `json:"type"`
	TotalFiles int    `json:"totalFiles"`
	TotalSize  int64  `json:"totalSize"`
}

// CreateBackupRequest represents backup creation request
type CreateBackupRequest struct {
	Name *string `json:"name,omitempty"`
}

// BackupInfo represents backup information
type BackupInfo struct {
	Filename  string           `json:"filename"`
	Timestamp time.Time        `json:"timestamp"`
	Size      int64            `json:"size"`
	Type      *string          `json:"type,omitempty"`
	Created   *bool            `json:"created,omitempty"`
	Included  *MigrationStats  `json:"included,omitempty"`
}

// BackupListResponse represents backup list response
type BackupListResponse struct {
	Success bool         `json:"success"`
	Backups []BackupInfo `json:"backups"`
}

// RestoreRequest represents restore request
type RestoreRequest struct {
	BackupName   string `json:"backupName"`
	CreateBackup *bool  `json:"createBackup,omitempty"`
}

// RestoreResponse represents restore response
type RestoreResponse struct {
	Success           bool             `json:"success"`
	Message           string           `json:"message"`
	Restored          *MigrationStats  `json:"restored,omitempty"`
	PreRestoreBackup  *BackupInfo      `json:"preRestoreBackup,omitempty"`
}

// StorageSettings represents storage configuration settings
type StorageSettings struct {
	StorageType        StorageType `json:"storageType"`
	S3BucketName       *string     `json:"s3BucketName,omitempty"`
	AWSRegion          *string     `json:"awsRegion,omitempty"`
	AWSAccessKeyID     *string     `json:"awsAccessKeyId,omitempty"`
	AWSSecretAccessKey *string     `json:"awsSecretAccessKey,omitempty"`
}

// StorageSettingsResponse represents storage settings response
type StorageSettingsResponse struct {
	Success      bool         `json:"success"`
	StorageType  StorageType  `json:"storageType"`
	S3BucketName *string      `json:"s3BucketName,omitempty"`
	S3Region     *string      `json:"s3Region,omitempty"`
	IsConfigured *bool        `json:"isConfigured,omitempty"`
}

// StorageTestResponse represents storage test response
type StorageTestResponse struct {
	Success bool             `json:"success"`
	Message string           `json:"message"`
	Details *json.RawMessage `json:"details,omitempty"`
}

// StorageStatusResponse represents storage status response
type StorageStatusResponse struct {
	Success        bool                     `json:"success"`
	Config         *StorageSettingsResponse `json:"config,omitempty"`
	ConnectionTest *StorageTestResponse     `json:"connectionTest,omitempty"`
	IsConfigured   bool                     `json:"isConfigured"`
}

// RevertToSQLiteRequest represents revert to SQLite request
type RevertToSQLiteRequest struct {
	MigrateData *bool `json:"migrateData,omitempty"`
}

// SettingsService provides settings and administration operations
type SettingsService struct {
	client *HTTPClient
}

// NewSettingsService creates a new settings service
func NewSettingsService(client *HTTPClient) *SettingsService {
	return &SettingsService{client: client}
}
