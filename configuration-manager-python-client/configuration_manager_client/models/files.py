"""File management models for Configuration Manager client."""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, Any, Dict, List, BinaryIO, Union
from io import BytesIO

from .types import FileMetadata, FileObject


@dataclass
class ReplaceFileRequest:
    """File replacement request."""
    config_id: str
    property_path: str
    file: Union[BinaryIO, BytesIO, bytes]
    file_name: str
    content_type: Optional[str] = None


@dataclass
class UpdatedConfigInfo:
    """Updated configuration info."""
    id: str
    updated_at: datetime


@dataclass
class ReplaceFileResponse:
    """File replacement response."""
    success: bool
    message: str
    file_object: Optional[FileObject] = None
    config: Optional[UpdatedConfigInfo] = None
    error: Optional[str] = None


@dataclass
class FileInfoResponse:
    """File info response."""
    metadata: FileMetadata
    download_url: str


@dataclass
class FolderImportFile:
    """File for folder import."""
    file: Union[BinaryIO, BytesIO, bytes]
    file_name: str
    content_type: Optional[str] = None
    relative_path: Optional[str] = None


@dataclass
class FolderImportRequest:
    """Folder import request."""
    files: List[FolderImportFile]
    folder_name: Optional[str] = None
    relative_paths: Optional[List[str]] = None


@dataclass
class FolderImportStats:
    """Folder import statistics."""
    total_files: int
    json_files: int
    binary_files: int
    errors: int
    error_details: Optional[List[str]] = None


@dataclass
class FolderImportResponse:
    """Folder import response."""
    success: bool
    message: str
    data: Dict[str, Any]
    stats: FolderImportStats


@dataclass
class FileDownloadResult:
    """File download result."""
    content: bytes
    file_name: str
    content_type: str
    content_length: int
