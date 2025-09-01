"""Configuration Manager Python Client.

A comprehensive Python client library for the Configuration Manager service,
providing full access to authentication, REST API operations, and file management.

This client library supports all Configuration Manager REST API operations including:
- Authentication (JWT and API key)
- Configuration management with inheritance and provenance
- File uploads, downloads, and folder imports
- User management and administration
- Validation rules management
- System settings and data migration

Example usage:
    >>> from configuration_manager_client import ConfigurationManagerClient
    >>> 
    >>> # Create client with API key
    >>> client = ConfigurationManagerClient.with_api_key(
    ...     "http://localhost:3002/api", 
    ...     "your-api-key"
    ... )
    >>> 
    >>> # Login-based authentication
    >>> client = ConfigurationManagerClient("http://localhost:3002/api")
    >>> auth_response = client.auth.login("admin", "admin123")
    >>> 
    >>> # Get configurations
    >>> configs = client.configurations.get_all(type="COMPONENT")
"""

from .client import ConfigurationManagerClient
from .models import *
from .exceptions import *

# Version information
try:
    from ._version import version as __version__
except ImportError:
    __version__ = "2.0.0"

__all__ = [
    "ConfigurationManagerClient",
    # Models
    "ConfigurationType",
    "ConfigurationStatus", 
    "UserRole",
    "RuleType",
    "StorageType",
    "Configuration",
    "User",
    "Rule",
    # Exceptions
    "ConfigurationManagerError",
    "AuthenticationError",
    "AuthorizationError",
    "ValidationError",
    "NotFoundError",
    "ConflictError",
    "RateLimitError",
    "APIError",
    "NetworkError",
    "TimeoutError",
]

# Package metadata
__title__ = "configuration-manager-client"
__description__ = "Python client library for Configuration Manager service"
__url__ = "https://github.com/configuration-manager/python-client"
__author__ = "Configuration Manager Team"
__author_email__ = "team@configurationmanager.com"
__license__ = "MIT"
__copyright__ = "Copyright 2024 Configuration Manager Team"
