"""Models for Configuration Manager client.

This module contains all data models used by the Configuration Manager client,
including request/response models, enums, and data classes for all API operations.
"""

from .types import *
from .auth import *
from .configuration import *
from .files import *
from .users import *
from .rules import *
from .settings import *

__all__ = [
    # Common types
    "ConfigurationType",
    "ConfigurationStatus",
    "UserRole", 
    "RuleType",
    "StorageType",
    "APIErrorResponse",
    "FileMetadata",
    "FileObject",
    
    # Auth models
    "LoginRequest",
    "RegisterRequest", 
    "User",
    "AuthResponse",
    "CurrentUserResponse",
    "TokenRefreshResponse",
    
    # Configuration models
    "Configuration",
    "GetConfigurationsOptions",
    "ConfigurationListResponse",
    "CreateConfigurationRequest",
    "UpdateConfigurationRequest",
    "ConfigurationResponse",
    "ResolvedConfigurationResponse",
    "ConfigurationSummary",
    "GetConfigurationOptions",
    "ConfigurationValueResponse",
    "GetConfigurationValueOptions",
    "ConfigurationSource",
    "ChildrenConfigurationResponse",
    "GetChildConfigurationsOptions",
    "ComponentsResponse",
    "ComponentWithVersions",
    "RenameConfigurationRequest",
    "ArchiveConfigurationRequest",
    
    # File models
    "ReplaceFileRequest",
    "ReplaceFileResponse",
    "UpdatedConfigInfo",
    "FileInfoResponse",
    "FolderImportRequest",
    "FolderImportFile",
    "FolderImportResponse",
    "FolderImportStats",
    "FileDownloadResult",
    
    # User models
    "UsersListResponse",
    "UserResponse",
    "UpdateUserRoleRequest",
    "UserRoleUpdateResponse",
    "UserDeletionResponse",
    "UserSummary",
    "UserConfigurationsResponse",
    
    # Rules models
    "Rule",
    "RulesListResponse",
    "CreateRuleRequest",
    "UpdateRuleRequest",
    "RuleResponse",
    "ValidateRuleRequest",
    "RuleValidationResponse",
    "GetRulesOptions",
    "GetRulesForPathOptions",
    "NumericRuleConfig",
    "PatternRuleConfig",
    "CollectionRuleConfig",
    
    # Settings models
    "MongoDBSettings",
    "MongoDBOptions",
    "MongoDBSettingsResponse",
    "MongoDBStatus",
    "MongoDBTestRequest",
    "MongoDBTestResponse",
    "MongoDBTestDetails",
    "MigrationRequest",
    "MigrationResponse",
    "MigrationStats",
    "EmbeddedMongoInfo",
    "DataStatisticsResponse",
    "DataStatistics",
    "UserStatistics",
    "ConfigurationStatistics",
    "StorageStatistics",
    "CreateBackupRequest",
    "BackupInfo",
    "BackupListResponse",
    "RestoreRequest",
    "RestoreResponse",
    "StorageSettings",
    "StorageSettingsResponse",
    "StorageTestResponse",
    "StorageStatusResponse",
    "RevertToSQLiteRequest",
]
