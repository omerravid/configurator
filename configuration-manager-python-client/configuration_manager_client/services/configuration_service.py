"""Configuration management service for Configuration Manager API."""

from typing import Optional
from urllib.parse import quote

from ..http_client import HTTPClient
from ..models.configuration import (
    GetConfigurationsOptions,
    ConfigurationListResponse,
    CreateConfigurationRequest,
    UpdateConfigurationRequest,
    ConfigurationResponse,
    ResolvedConfigurationResponse,
    GetConfigurationOptions,
    ConfigurationValueResponse,
    GetConfigurationValueOptions,
    ChildrenConfigurationResponse,
    GetChildConfigurationsOptions,
    ComponentsResponse,
    RenameConfigurationRequest,
    ArchiveConfigurationRequest,
)
from ..exceptions import ValidationError
from ..utils import from_dict, build_query_params


class ConfigurationService:
    """Configuration management service client."""

    def __init__(self, http_client: HTTPClient):
        """Initialize configuration service.
        
        Args:
            http_client: HTTP client instance
        """
        self.client = http_client

    def get_all(
        self, 
        options: Optional[GetConfigurationsOptions] = None
    ) -> ConfigurationListResponse:
        """Get all configurations with optional filtering.
        
        Args:
            options: Filtering options
            
        Returns:
            ConfigurationListResponse containing list of configurations
        """
        params = {}
        if options:
            if options.type:
                params["type"] = options.type.value
            if options.status:
                params["status"] = options.status.value
            if options.include_archived is not None:
                params["includeArchived"] = "true" if options.include_archived else "false"

        response = self.client.get("/configs", params=params)
        return from_dict(ConfigurationListResponse, response.json())

    def get(
        self, 
        config_id: str, 
        options: Optional[GetConfigurationOptions] = None
    ) -> ResolvedConfigurationResponse:
        """Get a specific configuration by ID.
        
        Args:
            config_id: Configuration ID
            options: Options for getting configuration
            
        Returns:
            ResolvedConfigurationResponse containing configuration data
            
        Raises:
            ValidationError: If config_id is empty
        """
        if not config_id:
            raise ValidationError("Configuration ID cannot be empty")

        params = {}
        if options:
            if options.provenance:
                params["provenance"] = "true"
            if options.raw:
                params["raw"] = "true"

        response = self.client.get(f"/configs/{config_id}", params=params)
        return from_dict(ResolvedConfigurationResponse, response.json())

    def create(self, request: CreateConfigurationRequest) -> ConfigurationResponse:
        """Create a new configuration.
        
        Args:
            request: Create configuration request
            
        Returns:
            ConfigurationResponse containing created configuration
            
        Raises:
            ValidationError: If request is invalid
        """
        if not request.name:
            raise ValidationError("Configuration name cannot be empty")

        data = {
            "name": request.name,
            "type": request.type.value,
            "data": request.data,
        }
        
        if request.parent_id:
            data["parent_id"] = request.parent_id
            
        if request.description:
            data["description"] = request.description

        response = self.client.post("/configs", json_data=data)
        return from_dict(ConfigurationResponse, response.json())

    def update(
        self, 
        config_id: str, 
        request: UpdateConfigurationRequest
    ) -> ConfigurationResponse:
        """Update an existing configuration.
        
        Args:
            config_id: Configuration ID
            request: Update configuration request
            
        Returns:
            ConfigurationResponse containing updated configuration
            
        Raises:
            ValidationError: If config_id is empty
        """
        if not config_id:
            raise ValidationError("Configuration ID cannot be empty")

        data = {}
        if request.data is not None:
            data["data"] = request.data
        if request.description is not None:
            data["description"] = request.description

        response = self.client.put(f"/configs/{config_id}", json_data=data)
        return from_dict(ConfigurationResponse, response.json())

    def delete(self, config_id: str) -> ConfigurationResponse:
        """Delete a configuration.
        
        Args:
            config_id: Configuration ID
            
        Returns:
            ConfigurationResponse containing deletion confirmation
            
        Raises:
            ValidationError: If config_id is empty
        """
        if not config_id:
            raise ValidationError("Configuration ID cannot be empty")

        response = self.client.delete(f"/configs/{config_id}")
        return from_dict(ConfigurationResponse, response.json())

    def get_value(
        self, 
        config_id: str, 
        options: Optional[GetConfigurationValueOptions] = None
    ) -> ConfigurationValueResponse:
        """Get configuration data at a specific path.
        
        Args:
            config_id: Configuration ID
            options: Options for getting configuration value
            
        Returns:
            ConfigurationValueResponse containing value data
            
        Raises:
            ValidationError: If config_id is empty
        """
        if not config_id:
            raise ValidationError("Configuration ID cannot be empty")

        params = {}
        if options:
            if options.path:
                params["path"] = options.path
            if options.minimal:
                params["minimal"] = "true"

        response = self.client.get(f"/configs/{config_id}/data", params=params)
        return from_dict(ConfigurationValueResponse, response.json())

    def commit(self, config_id: str) -> ConfigurationResponse:
        """Commit a draft configuration.
        
        Args:
            config_id: Configuration ID
            
        Returns:
            ConfigurationResponse containing commit confirmation
            
        Raises:
            ValidationError: If config_id is empty
        """
        if not config_id:
            raise ValidationError("Configuration ID cannot be empty")

        response = self.client.post(f"/configs/{config_id}/commit")
        return from_dict(ConfigurationResponse, response.json())

    def get_children(
        self, 
        config_id: str, 
        options: Optional[GetChildConfigurationsOptions] = None
    ) -> ChildrenConfigurationResponse:
        """Get child configurations.
        
        Args:
            config_id: Configuration ID
            options: Options for getting child configurations
            
        Returns:
            ChildrenConfigurationResponse containing child configurations
            
        Raises:
            ValidationError: If config_id is empty
        """
        if not config_id:
            raise ValidationError("Configuration ID cannot be empty")

        params = {}
        if options and options.include_archived:
            params["includeArchived"] = "true"

        response = self.client.get(f"/configs/{config_id}/children", params=params)
        return from_dict(ChildrenConfigurationResponse, response.json())

    def get_components(self) -> ComponentsResponse:
        """Get all components with their versions.
        
        Returns:
            ComponentsResponse containing components and versions
        """
        response = self.client.get("/configs/components")
        return from_dict(ComponentsResponse, response.json())

    def rename(self, config_id: str, new_name: str) -> ConfigurationResponse:
        """Rename a configuration (admin only).
        
        Args:
            config_id: Configuration ID
            new_name: New configuration name
            
        Returns:
            ConfigurationResponse containing renamed configuration
            
        Raises:
            ValidationError: If config_id or new_name is empty
        """
        if not config_id:
            raise ValidationError("Configuration ID cannot be empty")

        if not new_name:
            raise ValidationError("New name cannot be empty")

        data = {"name": new_name}
        response = self.client.put(f"/configs/{config_id}/rename", json_data=data)
        return from_dict(ConfigurationResponse, response.json())

    def archive(
        self, 
        config_id: str, 
        archive_children: Optional[bool] = None
    ) -> ConfigurationResponse:
        """Archive a configuration (admin only).
        
        Args:
            config_id: Configuration ID
            archive_children: Whether to archive child configurations
            
        Returns:
            ConfigurationResponse containing archive confirmation
            
        Raises:
            ValidationError: If config_id is empty
        """
        if not config_id:
            raise ValidationError("Configuration ID cannot be empty")

        data = {}
        if archive_children is not None:
            data["archiveChildren"] = archive_children

        response = self.client.post(f"/configs/{config_id}/archive", json_data=data)
        return from_dict(ConfigurationResponse, response.json())

    def restore(self, config_id: str) -> ConfigurationResponse:
        """Restore an archived configuration (admin only).
        
        Args:
            config_id: Configuration ID
            
        Returns:
            ConfigurationResponse containing restore confirmation
            
        Raises:
            ValidationError: If config_id is empty
        """
        if not config_id:
            raise ValidationError("Configuration ID cannot be empty")

        response = self.client.post(f"/configs/{config_id}/restore")
        return from_dict(ConfigurationResponse, response.json())
