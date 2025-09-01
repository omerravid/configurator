"""Common types and enums for Configuration Manager client."""

from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Optional, Any, Dict, List


class ConfigurationType(Enum):
    """Configuration types."""
    PRODUCT = "PRODUCT"
    INSTANCE = "INSTANCE"
    USER = "USER"
    COMPONENT = "COMPONENT"
    VERSION = "VERSION"


class ConfigurationStatus(Enum):
    """Configuration status."""
    DRAFT = "DRAFT"
    COMMITTED = "COMMITTED"


class UserRole(Enum):
    """User roles."""
    ADMIN = "ADMIN"
    USER = "USER"


class RuleType(Enum):
    """Rule types for validation."""
    NUMERIC = "numeric"
    PATTERN = "pattern"
    COLLECTION = "collection"


class StorageType(Enum):
    """Storage types."""
    EMBEDDED = "embedded"
    S3 = "s3"


@dataclass
class APIErrorResponse:
    """Standard API error response."""
    error: str
    details: Optional[str] = None
    code: Optional[str] = None


@dataclass
class APIResponse:
    """Standard success response."""
    success: bool
    message: Optional[str] = None
    data: Optional[Any] = None


@dataclass
class PaginationInfo:
    """Pagination information."""
    page: int
    page_size: int
    total: int
    total_pages: int


@dataclass
class FileMetadata:
    """File metadata."""
    storage_key: str
    original_name: str
    mime_type: str
    size: int
    storage_type: str
    uploaded_at: datetime


@dataclass
class FileObject:
    """File object as stored in configurations."""
    type: str  # Always "_file"
    metadata: FileMetadata
    link: str

    def __post_init__(self):
        """Set default type."""
        if not self.type:
            self.type = "file"


@dataclass
class HealthResponse:
    """Health check response."""
    status: str
    timestamp: datetime
