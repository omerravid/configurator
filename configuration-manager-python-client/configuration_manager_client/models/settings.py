"""Settings management models for Configuration Manager client."""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, Any, Dict, List

from .types import StorageType


@dataclass
class MongoDBOptions:
    """MongoDB connection options."""
    use_new_url_parser: bool = True
    use_unified_topology: bool = True


@dataclass
class MongoDBSettings:
    """MongoDB configuration settings."""
    connection_string: str
    options: Optional[MongoDBOptions] = None


@dataclass
class MongoDBStatus:
    """MongoDB connection status."""
    connected: bool
    host: Optional[str] = None
    database: Optional[str] = None
    type: Optional[str] = None


@dataclass
class MongoDBSettingsResponse:
    """MongoDB settings response."""
    success: bool
    settings: Optional[MongoDBSettings] = None
    status: Optional[MongoDBStatus] = None


@dataclass
class MongoDBTestRequest:
    """MongoDB connection test request."""
    connection_string: str


@dataclass
class MongoDBTestDetails:
    """MongoDB connection test details."""
    host: Optional[str] = None
    database: Optional[str] = None
    connected: bool = False
    latency: Optional[int] = None


@dataclass
class MongoDBTestResponse:
    """MongoDB connection test response."""
    success: bool
    message: str
    details: Optional[MongoDBTestDetails] = None


@dataclass
class MigrationStats:
    """Migration statistics."""
    users: int
    configurations: int


@dataclass
class EmbeddedMongoInfo:
    """Embedded MongoDB information."""
    started: bool
    connection_string: Optional[str] = None


@dataclass
class BackupInfo:
    """Backup information."""
    filename: str
    timestamp: datetime
    size: int
    type: Optional[str] = None
    created: Optional[bool] = None
    included: Optional[MigrationStats] = None


@dataclass
class MigrationRequest:
    """Migration request."""
    connection_string: str
    create_backup: Optional[bool] = None


@dataclass
class MigrationResponse:
    """Migration response."""
    success: bool
    message: str
    migrated: Optional[MigrationStats] = None
    backup: Optional[BackupInfo] = None
    embedded_mongo: Optional[EmbeddedMongoInfo] = None


@dataclass
class UserStatistics:
    """User statistics."""
    total: int
    admins: int
    regular_users: int


@dataclass
class ConfigurationStatistics:
    """Configuration statistics."""
    total: int
    by_type: Dict[str, int] = field(default_factory=dict)
    by_status: Dict[str, int] = field(default_factory=dict)
    archived: int = 0


@dataclass
class StorageStatistics:
    """Storage statistics."""
    type: str
    total_files: int
    total_size: int


@dataclass
class DataStatistics:
    """Data statistics."""
    users: UserStatistics
    configurations: ConfigurationStatistics
    storage: StorageStatistics


@dataclass
class DataStatisticsResponse:
    """Data statistics response."""
    success: bool
    statistics: Optional[DataStatistics] = None


@dataclass
class CreateBackupRequest:
    """Backup creation request."""
    name: Optional[str] = None


@dataclass
class BackupListResponse:
    """Backup list response."""
    success: bool
    backups: List[BackupInfo] = field(default_factory=list)


@dataclass
class RestoreRequest:
    """Restore request."""
    backup_name: str
    create_backup: Optional[bool] = None


@dataclass
class RestoreResponse:
    """Restore response."""
    success: bool
    message: str
    restored: Optional[MigrationStats] = None
    pre_restore_backup: Optional[BackupInfo] = None


@dataclass
class StorageSettings:
    """Storage configuration settings."""
    storage_type: StorageType
    s3_bucket_name: Optional[str] = None
    aws_region: Optional[str] = None
    aws_access_key_id: Optional[str] = None
    aws_secret_access_key: Optional[str] = None


@dataclass
class StorageSettingsResponse:
    """Storage settings response."""
    success: bool
    storage_type: StorageType
    s3_bucket_name: Optional[str] = None
    s3_region: Optional[str] = None
    is_configured: Optional[bool] = None


@dataclass
class StorageTestResponse:
    """Storage test response."""
    success: bool
    message: str
    details: Optional[Dict[str, Any]] = None


@dataclass
class StorageStatusResponse:
    """Storage status response."""
    success: bool
    config: Optional[StorageSettingsResponse] = None
    connection_test: Optional[StorageTestResponse] = None
    is_configured: bool = False


@dataclass
class RevertToSQLiteRequest:
    """Revert to SQLite request."""
    migrate_data: Optional[bool] = None
