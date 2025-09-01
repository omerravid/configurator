package configmanager

import (
	"context"
	"fmt"
)

// MongoDB Settings Methods

// GetMongoDBSettings gets MongoDB connection settings and status (admin only)
func (s *SettingsService) GetMongoDBSettings(ctx context.Context) (*MongoDBSettingsResponse, error) {
	resp, err := s.client.Get(ctx, "/settings/mongodb")
	if err != nil {
		return nil, fmt.Errorf("get MongoDB settings request failed: %w", err)
	}
	defer s.client.CloseResponse(resp)

	var response MongoDBSettingsResponse
	if err := s.client.DecodeJSON(resp, &response); err != nil {
		return nil, fmt.Errorf("failed to decode MongoDB settings response: %w", err)
	}

	return &response, nil
}

// UpdateMongoDBSettings updates MongoDB connection settings (admin only)
func (s *SettingsService) UpdateMongoDBSettings(ctx context.Context, settings *MongoDBSettings) (*MigrationResponse, error) {
	if settings == nil {
		return nil, NewValidationError("MongoDB settings cannot be nil", 0)
	}

	if settings.ConnectionString == "" {
		return nil, NewValidationError("connection string cannot be empty", 0)
	}

	resp, err := s.client.Put(ctx, "/settings/mongodb", settings)
	if err != nil {
		return nil, fmt.Errorf("update MongoDB settings request failed: %w", err)
	}
	defer s.client.CloseResponse(resp)

	var response MigrationResponse
	if err := s.client.DecodeJSON(resp, &response); err != nil {
		return nil, fmt.Errorf("failed to decode update MongoDB settings response: %w", err)
	}

	return &response, nil
}

// TestMongoDBConnection tests MongoDB connection (admin only)
func (s *SettingsService) TestMongoDBConnection(ctx context.Context, request *MongoDBTestRequest) (*MongoDBTestResponse, error) {
	if request == nil {
		return nil, NewValidationError("MongoDB test request cannot be nil", 0)
	}

	if request.ConnectionString == "" {
		return nil, NewValidationError("connection string cannot be empty", 0)
	}

	resp, err := s.client.Post(ctx, "/settings/mongodb/test", request)
	if err != nil {
		return nil, fmt.Errorf("test MongoDB connection request failed: %w", err)
	}
	defer s.client.CloseResponse(resp)

	var response MongoDBTestResponse
	if err := s.client.DecodeJSON(resp, &response); err != nil {
		return nil, fmt.Errorf("failed to decode test MongoDB connection response: %w", err)
	}

	return &response, nil
}

// ConnectToMongoDB connects to MongoDB (admin only)
func (s *SettingsService) ConnectToMongoDB(ctx context.Context, settings *MongoDBSettings) (*MongoDBTestResponse, error) {
	if settings == nil {
		return nil, NewValidationError("MongoDB settings cannot be nil", 0)
	}

	resp, err := s.client.Post(ctx, "/settings/mongodb/connect", settings)
	if err != nil {
		return nil, fmt.Errorf("connect to MongoDB request failed: %w", err)
	}
	defer s.client.CloseResponse(resp)

	var response MongoDBTestResponse
	if err := s.client.DecodeJSON(resp, &response); err != nil {
		return nil, fmt.Errorf("failed to decode connect to MongoDB response: %w", err)
	}

	return &response, nil
}

// DisconnectFromMongoDB disconnects from MongoDB (admin only)
func (s *SettingsService) DisconnectFromMongoDB(ctx context.Context) (*MongoDBTestResponse, error) {
	resp, err := s.client.Post(ctx, "/settings/mongodb/disconnect", nil)
	if err != nil {
		return nil, fmt.Errorf("disconnect from MongoDB request failed: %w", err)
	}
	defer s.client.CloseResponse(resp)

	var response MongoDBTestResponse
	if err := s.client.DecodeJSON(resp, &response); err != nil {
		return nil, fmt.Errorf("failed to decode disconnect from MongoDB response: %w", err)
	}

	return &response, nil
}

// MigrateToMongoDB migrates data from SQLite to MongoDB (admin only)
func (s *SettingsService) MigrateToMongoDB(ctx context.Context, request *MigrationRequest) (*MigrationResponse, error) {
	if request == nil {
		return nil, NewValidationError("migration request cannot be nil", 0)
	}

	if request.ConnectionString == "" {
		return nil, NewValidationError("connection string cannot be empty", 0)
	}

	resp, err := s.client.Post(ctx, "/settings/mongodb/migrate", request)
	if err != nil {
		return nil, fmt.Errorf("migrate to MongoDB request failed: %w", err)
	}
	defer s.client.CloseResponse(resp)

	var response MigrationResponse
	if err := s.client.DecodeJSON(resp, &response); err != nil {
		return nil, fmt.Errorf("failed to decode migrate to MongoDB response: %w", err)
	}

	return &response, nil
}

// GetMongoDBStatus gets MongoDB connection status (admin only)
func (s *SettingsService) GetMongoDBStatus(ctx context.Context) (*MongoDBStatus, error) {
	resp, err := s.client.Get(ctx, "/settings/mongodb/status")
	if err != nil {
		return nil, fmt.Errorf("get MongoDB status request failed: %w", err)
	}
	defer s.client.CloseResponse(resp)

	var response MongoDBStatus
	if err := s.client.DecodeJSON(resp, &response); err != nil {
		return nil, fmt.Errorf("failed to decode MongoDB status response: %w", err)
	}

	return &response, nil
}

// MigrateToEmbeddedMongoDB migrates to embedded MongoDB (admin only)
func (s *SettingsService) MigrateToEmbeddedMongoDB(ctx context.Context) (*MigrationResponse, error) {
	resp, err := s.client.Post(ctx, "/settings/mongodb/migrate-embedded", nil)
	if err != nil {
		return nil, fmt.Errorf("migrate to embedded MongoDB request failed: %w", err)
	}
	defer s.client.CloseResponse(resp)

	var response MigrationResponse
	if err := s.client.DecodeJSON(resp, &response); err != nil {
		return nil, fmt.Errorf("failed to decode migrate to embedded MongoDB response: %w", err)
	}

	return &response, nil
}

// RevertToSQLite reverts to SQLite from MongoDB (admin only)
func (s *SettingsService) RevertToSQLite(ctx context.Context, request *RevertToSQLiteRequest) (*MigrationResponse, error) {
	if request == nil {
		return nil, NewValidationError("revert to SQLite request cannot be nil", 0)
	}

	resp, err := s.client.Post(ctx, "/settings/mongodb/revert-to-sqlite", request)
	if err != nil {
		return nil, fmt.Errorf("revert to SQLite request failed: %w", err)
	}
	defer s.client.CloseResponse(resp)

	var response MigrationResponse
	if err := s.client.DecodeJSON(resp, &response); err != nil {
		return nil, fmt.Errorf("failed to decode revert to SQLite response: %w", err)
	}

	return &response, nil
}

// Data Management Methods

// GetDataStatistics gets data statistics (admin only)
func (s *SettingsService) GetDataStatistics(ctx context.Context) (*DataStatisticsResponse, error) {
	resp, err := s.client.Get(ctx, "/settings/data/status")
	if err != nil {
		return nil, fmt.Errorf("get data statistics request failed: %w", err)
	}
	defer s.client.CloseResponse(resp)

	var response DataStatisticsResponse
	if err := s.client.DecodeJSON(resp, &response); err != nil {
		return nil, fmt.Errorf("failed to decode data statistics response: %w", err)
	}

	return &response, nil
}

// CreateBackup creates data backup (admin only)
func (s *SettingsService) CreateBackup(ctx context.Context, request *CreateBackupRequest) (*MigrationResponse, error) {
	if request == nil {
		return nil, NewValidationError("create backup request cannot be nil", 0)
	}

	resp, err := s.client.Post(ctx, "/settings/data/backup", request)
	if err != nil {
		return nil, fmt.Errorf("create backup request failed: %w", err)
	}
	defer s.client.CloseResponse(resp)

	var response MigrationResponse
	if err := s.client.DecodeJSON(resp, &response); err != nil {
		return nil, fmt.Errorf("failed to decode create backup response: %w", err)
	}

	return &response, nil
}

// GetBackups lists available backups (admin only)
func (s *SettingsService) GetBackups(ctx context.Context) (*BackupListResponse, error) {
	resp, err := s.client.Get(ctx, "/settings/data/backups")
	if err != nil {
		return nil, fmt.Errorf("get backups request failed: %w", err)
	}
	defer s.client.CloseResponse(resp)

	var response BackupListResponse
	if err := s.client.DecodeJSON(resp, &response); err != nil {
		return nil, fmt.Errorf("failed to decode backups response: %w", err)
	}

	return &response, nil
}

// RestoreFromBackup restores from backup (admin only)
func (s *SettingsService) RestoreFromBackup(ctx context.Context, request *RestoreRequest) (*RestoreResponse, error) {
	if request == nil {
		return nil, NewValidationError("restore request cannot be nil", 0)
	}

	if request.BackupName == "" {
		return nil, NewValidationError("backup name cannot be empty", 0)
	}

	resp, err := s.client.Post(ctx, "/settings/data/restore", request)
	if err != nil {
		return nil, fmt.Errorf("restore from backup request failed: %w", err)
	}
	defer s.client.CloseResponse(resp)

	var response RestoreResponse
	if err := s.client.DecodeJSON(resp, &response); err != nil {
		return nil, fmt.Errorf("failed to decode restore from backup response: %w", err)
	}

	return &response, nil
}

// Storage Settings Methods

// GetStorageSettings gets storage settings (admin only)
func (s *SettingsService) GetStorageSettings(ctx context.Context) (*StorageSettingsResponse, error) {
	resp, err := s.client.Get(ctx, "/settings/storage")
	if err != nil {
		return nil, fmt.Errorf("get storage settings request failed: %w", err)
	}
	defer s.client.CloseResponse(resp)

	var response StorageSettingsResponse
	if err := s.client.DecodeJSON(resp, &response); err != nil {
		return nil, fmt.Errorf("failed to decode storage settings response: %w", err)
	}

	return &response, nil
}

// UpdateStorageSettings updates storage settings (admin only)
func (s *SettingsService) UpdateStorageSettings(ctx context.Context, settings *StorageSettings) (*StorageTestResponse, error) {
	if settings == nil {
		return nil, NewValidationError("storage settings cannot be nil", 0)
	}

	// Validate S3 settings if storage type is S3
	if settings.StorageType == StorageTypeS3 {
		if settings.S3BucketName == nil || *settings.S3BucketName == "" {
			return nil, NewValidationError("S3 bucket name is required for S3 storage", 0)
		}

		if settings.AWSRegion == nil || *settings.AWSRegion == "" {
			return nil, NewValidationError("AWS region is required for S3 storage", 0)
		}

		if settings.AWSAccessKeyID == nil || *settings.AWSAccessKeyID == "" {
			return nil, NewValidationError("AWS access key ID is required for S3 storage", 0)
		}

		if settings.AWSSecretAccessKey == nil || *settings.AWSSecretAccessKey == "" {
			return nil, NewValidationError("AWS secret access key is required for S3 storage", 0)
		}
	}

	resp, err := s.client.Put(ctx, "/settings/storage", settings)
	if err != nil {
		return nil, fmt.Errorf("update storage settings request failed: %w", err)
	}
	defer s.client.CloseResponse(resp)

	var response StorageTestResponse
	if err := s.client.DecodeJSON(resp, &response); err != nil {
		return nil, fmt.Errorf("failed to decode update storage settings response: %w", err)
	}

	return &response, nil
}

// TestStorageConnection tests storage connection (admin only)
func (s *SettingsService) TestStorageConnection(ctx context.Context, settings *StorageSettings) (*StorageTestResponse, error) {
	if settings == nil {
		return nil, NewValidationError("storage settings cannot be nil", 0)
	}

	resp, err := s.client.Post(ctx, "/settings/storage/test", settings)
	if err != nil {
		return nil, fmt.Errorf("test storage connection request failed: %w", err)
	}
	defer s.client.CloseResponse(resp)

	var response StorageTestResponse
	if err := s.client.DecodeJSON(resp, &response); err != nil {
		return nil, fmt.Errorf("failed to decode test storage connection response: %w", err)
	}

	return &response, nil
}

// GetStorageStatus gets storage status (admin only)
func (s *SettingsService) GetStorageStatus(ctx context.Context) (*StorageStatusResponse, error) {
	resp, err := s.client.Get(ctx, "/settings/storage/status")
	if err != nil {
		return nil, fmt.Errorf("get storage status request failed: %w", err)
	}
	defer s.client.CloseResponse(resp)

	var response StorageStatusResponse
	if err := s.client.DecodeJSON(resp, &response); err != nil {
		return nil, fmt.Errorf("failed to decode storage status response: %w", err)
	}

	return &response, nil
}
