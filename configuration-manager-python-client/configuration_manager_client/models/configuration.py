"""Configuration models for Configuration Manager client."""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, Any, Dict, List

from .types import ConfigurationType, ConfigurationStatus


@dataclass
class Configuration:
    """Configuration entity."""
    id: str
    name: str
    type: ConfigurationType
    parent_id: Optional[str]
    data: Dict[str, Any]
    created_by: str
    description: Optional[str]
    status: ConfigurationStatus
    archived: bool
    created_at: datetime
    updated_at: datetime


@dataclass
class GetConfigurationsOptions:
    """Options for getting configurations."""
    type: Optional[ConfigurationType] = None
    status: Optional[ConfigurationStatus] = None
    include_archived: Optional[bool] = None


@dataclass
class ConfigurationListResponse:
    """Configuration list response."""
    configs: List[Configuration]


@dataclass
class CreateConfigurationRequest:
    """Create configuration request."""
    name: str
    type: ConfigurationType
    data: Dict[str, Any]
    parent_id: Optional[str] = None
    description: Optional[str] = None


@dataclass
class UpdateConfigurationRequest:
    """Update configuration request."""
    data: Optional[Dict[str, Any]] = None
    description: Optional[str] = None


@dataclass
class ConfigurationResponse:
    """Configuration response with message."""
    config: Configuration
    message: Optional[str] = None


@dataclass
class ConfigurationSummary:
    """Configuration summary for inheritance chain."""
    id: str
    name: str
    type: ConfigurationType


@dataclass
class ResolvedConfigurationResponse:
    """Resolved configuration response."""
    config: Configuration
    data: Dict[str, Any]
    inheritance_chain: Optional[List[ConfigurationSummary]] = None


@dataclass
class GetConfigurationOptions:
    """Options for getting a configuration."""
    provenance: Optional[bool] = None
    raw: Optional[bool] = None


@dataclass
class ConfigurationSource:
    """Configuration source information."""
    id: str
    name: str
    type: ConfigurationType
    created_by: Optional[str] = None
    created_at: Optional[datetime] = None


@dataclass
class ConfigurationValueResponse:
    """Configuration value response."""
    value: Any
    path: Optional[str] = None
    source: Optional[ConfigurationSource] = None
    config: Optional[ConfigurationSummary] = None
    data: Optional[Dict[str, Any]] = None


@dataclass
class GetConfigurationValueOptions:
    """Options for getting configuration value."""
    path: Optional[str] = None
    minimal: Optional[bool] = None


@dataclass
class ChildrenConfigurationResponse:
    """Children configurations response."""
    children: List[Configuration]
    count: int


@dataclass
class GetChildConfigurationsOptions:
    """Options for getting child configurations."""
    include_archived: Optional[bool] = None


@dataclass
class ComponentWithVersions:
    """Component with its versions."""
    id: str
    name: str
    type: ConfigurationType
    description: Optional[str]
    status: ConfigurationStatus
    created_by: str
    created_at: datetime
    versions: List[Configuration] = field(default_factory=list)


@dataclass
class ComponentsResponse:
    """Components with versions response."""
    components: List[ComponentWithVersions]


@dataclass
class RenameConfigurationRequest:
    """Rename configuration request."""
    name: str


@dataclass
class ArchiveConfigurationRequest:
    """Archive configuration request."""
    archive_children: Optional[bool] = None
