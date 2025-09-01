"""File management service for Configuration Manager API."""

import os
from typing import Optional, Union, BinaryIO, List
from io import BytesIO

from ..http_client import HTTPClient
from ..models.files import (
    ReplaceFileRequest,
    ReplaceFileResponse,
    FileInfoResponse,
    FolderImportRequest,
    FolderImportResponse,
    FileDownloadResult,
    FolderImportFile,
)
from ..exceptions import ValidationError
from ..utils import from_dict, get_content_type, validate_file_size


class FileService:
    """File management service client."""

    def __init__(self, http_client: HTTPClient):
        """Initialize file service.
        
        Args:
            http_client: HTTP client instance
        """
        self.client = http_client

    def download(self, storage_key: str) -> FileDownloadResult:
        """Download a file by storage key.
        
        Args:
            storage_key: File storage key
            
        Returns:
            FileDownloadResult containing file data and metadata
            
        Raises:
            ValidationError: If storage_key is empty
        """
        if not storage_key:
            raise ValidationError("Storage key cannot be empty")

        response = self.client.download(f"/files/{storage_key}")

        # Get file information from headers
        content_type = response.headers.get("Content-Type", "application/octet-stream")
        content_length = int(response.headers.get("Content-Length", 0))

        # Try to get filename from Content-Disposition header
        file_name = storage_key
        content_disposition = response.headers.get("Content-Disposition")
        if content_disposition:
            import re
            match = re.search(r'filename[*]?=["\']?([^"\';]+)', content_disposition)
            if match:
                file_name = match.group(1)

        # Read all content into memory
        content = response.content

        return FileDownloadResult(
            content=content,
            file_name=file_name,
            content_type=content_type,
            content_length=content_length,
        )

    def get_info(self, storage_key: str) -> FileInfoResponse:
        """Get file metadata and download URL.
        
        Args:
            storage_key: File storage key
            
        Returns:
            FileInfoResponse containing file metadata
            
        Raises:
            ValidationError: If storage_key is empty
        """
        if not storage_key:
            raise ValidationError("Storage key cannot be empty")

        response = self.client.get(f"/files/{storage_key}/info")
        return from_dict(FileInfoResponse, response.json())

    def replace_file(self, request: ReplaceFileRequest) -> ReplaceFileResponse:
        """Replace a file in an existing configuration.
        
        Args:
            request: Replace file request
            
        Returns:
            ReplaceFileResponse containing operation result
            
        Raises:
            ValidationError: If request is invalid
        """
        if not request.config_id:
            raise ValidationError("Config ID cannot be empty")

        if not request.property_path:
            raise ValidationError("Property path cannot be empty")

        if not request.file:
            raise ValidationError("File cannot be empty")

        if not request.file_name:
            raise ValidationError("File name cannot be empty")

        # Read file data
        if hasattr(request.file, 'read'):
            # File-like object
            file_data = request.file.read()
        elif isinstance(request.file, bytes):
            file_data = request.file
        else:
            raise ValidationError("File must be bytes or file-like object")

        # Validate file size
        validate_file_size(file_data, self.client.max_file_size)

        # Determine content type
        content_type = request.content_type or get_content_type(request.file_name)

        # Prepare multipart data
        files = {
            'file': (request.file_name, BytesIO(file_data), content_type)
        }
        
        form_data = {
            'configId': request.config_id,
            'propertyPath': request.property_path,
        }

        response = self.client.post(
            "/file-management/replace",
            data=form_data,
            files=files
        )

        return from_dict(ReplaceFileResponse, response.json())

    def replace_file_from_path(
        self,
        config_id: str,
        property_path: str,
        file_path: str,
        content_type: Optional[str] = None,
    ) -> ReplaceFileResponse:
        """Replace a file using a file path.
        
        Args:
            config_id: Configuration ID
            property_path: Property path in configuration
            file_path: Path to file on disk
            content_type: Optional content type
            
        Returns:
            ReplaceFileResponse containing operation result
            
        Raises:
            ValidationError: If file doesn't exist or parameters are invalid
        """
        if not os.path.exists(file_path):
            raise ValidationError(f"File not found: {file_path}")

        with open(file_path, 'rb') as f:
            file_data = f.read()

        file_name = os.path.basename(file_path)
        if not content_type:
            content_type = get_content_type(file_name)

        request = ReplaceFileRequest(
            config_id=config_id,
            property_path=property_path,
            file=file_data,
            file_name=file_name,
            content_type=content_type,
        )

        return self.replace_file(request)

    def replace_file_from_bytes(
        self,
        config_id: str,
        property_path: str,
        file_data: bytes,
        file_name: str,
        content_type: Optional[str] = None,
    ) -> ReplaceFileResponse:
        """Replace a file using byte data.
        
        Args:
            config_id: Configuration ID
            property_path: Property path in configuration
            file_data: File data as bytes
            file_name: Name for the file
            content_type: Optional content type
            
        Returns:
            ReplaceFileResponse containing operation result
        """
        if not content_type:
            content_type = get_content_type(file_name)

        request = ReplaceFileRequest(
            config_id=config_id,
            property_path=property_path,
            file=file_data,
            file_name=file_name,
            content_type=content_type,
        )

        return self.replace_file(request)

    def import_folder(self, request: FolderImportRequest) -> FolderImportResponse:
        """Import a folder structure with files.
        
        Args:
            request: Folder import request
            
        Returns:
            FolderImportResponse containing operation result
            
        Raises:
            ValidationError: If request is invalid
        """
        if not request.files:
            raise ValidationError("Files list cannot be empty")

        # Prepare multipart data
        files = []
        form_data = {}

        for i, file_item in enumerate(request.files):
            if not file_item.file:
                continue

            # Read file data
            if hasattr(file_item.file, 'read'):
                file_data = file_item.file.read()
            elif isinstance(file_item.file, bytes):
                file_data = file_item.file
            else:
                continue

            # Validate file size
            try:
                validate_file_size(file_data, self.client.max_file_size)
            except ValidationError:
                continue  # Skip files that are too large

            # Determine content type
            content_type = file_item.content_type or get_content_type(file_item.file_name)

            files.append(('files', (file_item.file_name, BytesIO(file_data), content_type)))

        if not files:
            raise ValidationError("No valid files to upload")

        # Add optional form fields
        if request.folder_name:
            form_data['folderName'] = request.folder_name

        if request.relative_paths:
            for path in request.relative_paths:
                # Note: For multiple values with same key, we need to handle this properly
                if 'relativePaths' not in form_data:
                    form_data['relativePaths'] = []
                form_data['relativePaths'].append(path)

        response = self.client.post(
            "/folder-import",
            data=form_data,
            files=files
        )

        return from_dict(FolderImportResponse, response.json())

    def import_folder_from_paths(
        self,
        file_paths: List[str],
        folder_name: Optional[str] = None,
        relative_paths: Optional[List[str]] = None,
    ) -> FolderImportResponse:
        """Import folder from file paths.
        
        Args:
            file_paths: List of file paths to import
            folder_name: Optional folder name
            relative_paths: Optional relative paths for files
            
        Returns:
            FolderImportResponse containing operation result
        """
        files = []
        
        for i, file_path in enumerate(file_paths):
            if not os.path.exists(file_path):
                continue

            with open(file_path, 'rb') as f:
                file_data = f.read()

            file_name = os.path.basename(file_path)
            content_type = get_content_type(file_name)
            
            relative_path = None
            if relative_paths and i < len(relative_paths):
                relative_path = relative_paths[i]

            files.append(FolderImportFile(
                file=file_data,
                file_name=file_name,
                content_type=content_type,
                relative_path=relative_path,
            ))

        request = FolderImportRequest(
            files=files,
            folder_name=folder_name,
            relative_paths=relative_paths,
        )

        return self.import_folder(request)

    def save_to_file(self, download_result: FileDownloadResult, destination_path: str) -> None:
        """Save a downloaded file to disk.
        
        Args:
            download_result: File download result
            destination_path: Path where to save the file
            
        Raises:
            ValidationError: If parameters are invalid
        """
        if not destination_path:
            raise ValidationError("Destination path cannot be empty")

        # Create directory if it doesn't exist
        directory = os.path.dirname(destination_path)
        if directory and not os.path.exists(directory):
            os.makedirs(directory, exist_ok=True)

        # Write file data
        with open(destination_path, 'wb') as f:
            f.write(download_result.content)
