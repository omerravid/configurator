"""Settings and administration service for Configuration Manager API."""

from typing import Optional

from ..http_client import HTTPClient
from ..models.settings import (
    MongoDBSettings,
    MongoDBSettingsResponse,
    MongoDBTestRequest,
    MongoDBTestResponse,
    MongoDBStatus,
    MigrationRequest,
    MigrationResponse,
    DataStatisticsResponse,
    CreateBackupRequest,
    BackupListResponse,
    RestoreRequest,
    RestoreResponse,
    StorageSettings,
    StorageSettingsResponse,
    StorageTestResponse,
    StorageStatusResponse,
    RevertToSQLiteRequest,
)
from ..models.types import StorageType
from ..exceptions import ValidationError
from ..utils import from_dict


class SettingsService:
    """Settings and administration service client."""

    def __init__(self, http_client: HTTPClient):
        """Initialize settings service.
        
        Args:
            http_client: HTTP client instance
        """
        self.client = http_client

    # MongoDB Settings Methods

    def get_mongodb_settings(self) -> MongoDBSettingsResponse:
        """Get MongoDB connection settings and status (admin only).
        
        Returns:
            MongoDBSettingsResponse containing settings and status
        """
        response = self.client.get("/settings/mongodb")
        return from_dict(MongoDBSettingsResponse, response.json())

    def update_mongodb_settings(self, settings: MongoDBSettings) -> MigrationResponse:
        """Update MongoDB connection settings (admin only).
        
        Args:
            settings: MongoDB settings
            
        Returns:
            MigrationResponse containing update result
            
        Raises:
            ValidationError: If settings are invalid
        """
        if not settings.connection_string:
            raise ValidationError("Connection string cannot be empty")

        data = {
            "connectionString": settings.connection_string,
        }

        if settings.options:
            data["options"] = {
                "useNewUrlParser": settings.options.use_new_url_parser,
                "useUnifiedTopology": settings.options.use_unified_topology,
            }

        response = self.client.put("/settings/mongodb", json_data=data)
        return from_dict(MigrationResponse, response.json())

    def test_mongodb_connection(self, request: MongoDBTestRequest) -> MongoDBTestResponse:
        """Test MongoDB connection (admin only).
        
        Args:
            request: MongoDB test request
            
        Returns:
            MongoDBTestResponse containing test result
            
        Raises:
            ValidationError: If request is invalid
        """
        if not request.connection_string:
            raise ValidationError("Connection string cannot be empty")

        data = {"connectionString": request.connection_string}
        response = self.client.post("/settings/mongodb/test", json_data=data)
        return from_dict(MongoDBTestResponse, response.json())

    def connect_to_mongodb(self, settings: MongoDBSettings) -> MongoDBTestResponse:
        """Connect to MongoDB (admin only).
        
        Args:
            settings: MongoDB settings
            
        Returns:
            MongoDBTestResponse containing connection result
        """
        data = {
            "connectionString": settings.connection_string,
        }

        if settings.options:
            data["options"] = {
                "useNewUrlParser": settings.options.use_new_url_parser,
                "useUnifiedTopology": settings.options.use_unified_topology,
            }

        response = self.client.post("/settings/mongodb/connect", json_data=data)
        return from_dict(MongoDBTestResponse, response.json())

    def disconnect_from_mongodb(self) -> MongoDBTestResponse:
        """Disconnect from MongoDB (admin only).
        
        Returns:
            MongoDBTestResponse containing disconnection result
        """
        response = self.client.post("/settings/mongodb/disconnect")
        return from_dict(MongoDBTestResponse, response.json())

    def migrate_to_mongodb(self, request: MigrationRequest) -> MigrationResponse:
        """Migrate data from SQLite to MongoDB (admin only).
        
        Args:
            request: Migration request
            
        Returns:
            MigrationResponse containing migration result
            
        Raises:
            ValidationError: If request is invalid
        """
        if not request.connection_string:
            raise ValidationError("Connection string cannot be empty")

        data = {
            "connectionString": request.connection_string,
        }

        if request.create_backup is not None:
            data["createBackup"] = request.create_backup

        response = self.client.post("/settings/mongodb/migrate", json_data=data)
        return from_dict(MigrationResponse, response.json())

    def get_mongodb_status(self) -> MongoDBStatus:
        """Get MongoDB connection status (admin only).
        
        Returns:
            MongoDBStatus containing connection status
        """
        response = self.client.get("/settings/mongodb/status")
        return from_dict(MongoDBStatus, response.json())

    def migrate_to_embedded_mongodb(self) -> MigrationResponse:
        """Migrate to embedded MongoDB (admin only).
        
        Returns:
            MigrationResponse containing migration result
        """
        response = self.client.post("/settings/mongodb/migrate-embedded")
        return from_dict(MigrationResponse, response.json())

    def revert_to_sqlite(self, request: Optional[RevertToSQLiteRequest] = None) -> MigrationResponse:
        """Revert to SQLite from MongoDB (admin only).
        
        Args:
            request: Optional revert request
            
        Returns:
            MigrationResponse containing revert result
        """
        data = {}
        if request and request.migrate_data is not None:
            data["migrateData"] = request.migrate_data

        response = self.client.post("/settings/mongodb/revert-to-sqlite", json_data=data)
        return from_dict(MigrationResponse, response.json())

    # Data Management Methods

    def get_data_statistics(self) -> DataStatisticsResponse:
        """Get data statistics (admin only).
        
        Returns:
            DataStatisticsResponse containing system statistics
        """
        response = self.client.get("/settings/data/status")
        return from_dict(DataStatisticsResponse, response.json())

    def create_backup(self, request: Optional[CreateBackupRequest] = None) -> MigrationResponse:
        """Create data backup (admin only).
        
        Args:
            request: Optional backup request with name
            
        Returns:
            MigrationResponse containing backup result
        """
        data = {}
        if request and request.name:
            data["name"] = request.name

        response = self.client.post("/settings/data/backup", json_data=data)
        return from_dict(MigrationResponse, response.json())

    def get_backups(self) -> BackupListResponse:
        """List available backups (admin only).
        
        Returns:
            BackupListResponse containing list of backups
        """
        response = self.client.get("/settings/data/backups")
        return from_dict(BackupListResponse, response.json())

    def restore_from_backup(self, request: RestoreRequest) -> RestoreResponse:
        """Restore from backup (admin only).
        
        Args:
            request: Restore request
            
        Returns:
            RestoreResponse containing restore result
            
        Raises:
            ValidationError: If backup name is empty
        """
        if not request.backup_name:
            raise ValidationError("Backup name cannot be empty")

        data = {
            "backupName": request.backup_name,
        }

        if request.create_backup is not None:
            data["createBackup"] = request.create_backup

        response = self.client.post("/settings/data/restore", json_data=data)
        return from_dict(RestoreResponse, response.json())

    # Storage Settings Methods

    def get_storage_settings(self) -> StorageSettingsResponse:
        """Get storage settings (admin only).
        
        Returns:
            StorageSettingsResponse containing storage configuration
        """
        response = self.client.get("/settings/storage")
        return from_dict(StorageSettingsResponse, response.json())

    def update_storage_settings(self, settings: StorageSettings) -> StorageTestResponse:
        """Update storage settings (admin only).
        
        Args:
            settings: Storage settings
            
        Returns:
            StorageTestResponse containing update result
            
        Raises:
            ValidationError: If settings are invalid
        """
        # Validate S3 settings if storage type is S3
        if settings.storage_type == StorageType.S3:
            if not settings.s3_bucket_name:
                raise ValidationError("S3 bucket name is required for S3 storage")

            if not settings.aws_region:
                raise ValidationError("AWS region is required for S3 storage")

            if not settings.aws_access_key_id:
                raise ValidationError("AWS access key ID is required for S3 storage")

            if not settings.aws_secret_access_key:
                raise ValidationError("AWS secret access key is required for S3 storage")

        data = {
            "storageType": settings.storage_type.value,
        }

        if settings.s3_bucket_name:
            data["s3BucketName"] = settings.s3_bucket_name

        if settings.aws_region:
            data["awsRegion"] = settings.aws_region

        if settings.aws_access_key_id:
            data["awsAccessKeyId"] = settings.aws_access_key_id

        if settings.aws_secret_access_key:
            data["awsSecretAccessKey"] = settings.aws_secret_access_key

        response = self.client.put("/settings/storage", json_data=data)
        return from_dict(StorageTestResponse, response.json())

    def test_storage_connection(self, settings: StorageSettings) -> StorageTestResponse:
        """Test storage connection (admin only).
        
        Args:
            settings: Storage settings to test
            
        Returns:
            StorageTestResponse containing test result
        """
        data = {
            "storageType": settings.storage_type.value,
        }

        if settings.s3_bucket_name:
            data["s3BucketName"] = settings.s3_bucket_name

        if settings.aws_region:
            data["awsRegion"] = settings.aws_region

        if settings.aws_access_key_id:
            data["awsAccessKeyId"] = settings.aws_access_key_id

        if settings.aws_secret_access_key:
            data["awsSecretAccessKey"] = settings.aws_secret_access_key

        response = self.client.post("/settings/storage/test", json_data=data)
        return from_dict(StorageTestResponse, response.json())

    def get_storage_status(self) -> StorageStatusResponse:
        """Get storage status (admin only).
        
        Returns:
            StorageStatusResponse containing storage status
        """
        response = self.client.get("/settings/storage/status")
        return from_dict(StorageStatusResponse, response.json())
