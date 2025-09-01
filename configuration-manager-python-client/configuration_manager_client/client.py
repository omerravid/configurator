"""Main Configuration Manager client orchestrator."""

from typing import Optional, Dict, Any

from .http_client import HTTPClient
from .services import (
    AuthService,
    ConfigurationService,
    FileService,
    UserService,
    RulesService,
    SettingsService,
)
from .exceptions import ValidationError
from .utils import from_dict
from .models.types import HealthResponse


class ClientOptions:
    """Configuration options for the Configuration Manager client."""

    def __init__(
        self,
        base_url: str,
        api_key: Optional[str] = None,
        jwt_token: Optional[str] = None,
        timeout: float = 30.0,
        max_file_size: int = 50 * 1024 * 1024,  # 50MB
        user_agent: str = "configuration-manager-python-client/2.0.0",
        verify_ssl: bool = True,
        max_retries: int = 3,
    ):
        """Initialize client options.
        
        Args:
            base_url: Base URL of the Configuration Manager API
            api_key: API key for authentication (optional)
            jwt_token: JWT token for authentication (optional)
            timeout: Request timeout in seconds
            max_file_size: Maximum file size for uploads
            user_agent: User agent string
            verify_ssl: Whether to verify SSL certificates
            max_retries: Maximum number of retries for failed requests
        """
        self.base_url = base_url
        self.api_key = api_key
        self.jwt_token = jwt_token
        self.timeout = timeout
        self.max_file_size = max_file_size
        self.user_agent = user_agent
        self.verify_ssl = verify_ssl
        self.max_retries = max_retries


class ConfigurationManagerClient:
    """Main Configuration Manager client providing access to all services."""

    def __init__(self, options: ClientOptions):
        """Initialize Configuration Manager client.
        
        Args:
            options: Client configuration options
            
        Raises:
            ValidationError: If options are invalid
        """
        if not options.base_url:
            raise ValidationError("Base URL is required")

        # Create HTTP client
        self._http_client = HTTPClient(
            base_url=options.base_url,
            api_key=options.api_key,
            jwt_token=options.jwt_token,
            timeout=options.timeout,
            max_file_size=options.max_file_size,
            user_agent=options.user_agent,
            verify_ssl=options.verify_ssl,
            max_retries=options.max_retries,
        )

        # Initialize service clients
        self.auth = AuthService(self._http_client)
        self.configurations = ConfigurationService(self._http_client)
        self.files = FileService(self._http_client)
        self.users = UserService(self._http_client)
        self.rules = RulesService(self._http_client)
        self.settings = SettingsService(self._http_client)

    @classmethod
    def create(
        self,
        base_url: str,
        api_key: Optional[str] = None,
        jwt_token: Optional[str] = None,
        **kwargs,
    ) -> "ConfigurationManagerClient":
        """Create a new Configuration Manager client.
        
        Args:
            base_url: Base URL of the Configuration Manager API
            api_key: API key for authentication (optional)
            jwt_token: JWT token for authentication (optional)
            **kwargs: Additional client options
            
        Returns:
            ConfigurationManagerClient instance
        """
        options = ClientOptions(
            base_url=base_url,
            api_key=api_key,
            jwt_token=jwt_token,
            **kwargs,
        )
        return cls(options)

    @classmethod
    def with_api_key(
        cls,
        base_url: str,
        api_key: str,
        **kwargs,
    ) -> "ConfigurationManagerClient":
        """Create a new client with API key authentication.
        
        Args:
            base_url: Base URL of the Configuration Manager API
            api_key: API key for authentication
            **kwargs: Additional client options
            
        Returns:
            ConfigurationManagerClient instance
        """
        if not api_key:
            raise ValidationError("API key cannot be empty")

        return cls.create(base_url=base_url, api_key=api_key, **kwargs)

    @classmethod
    def with_jwt_token(
        cls,
        base_url: str,
        jwt_token: str,
        **kwargs,
    ) -> "ConfigurationManagerClient":
        """Create a new client with JWT token authentication.
        
        Args:
            base_url: Base URL of the Configuration Manager API
            jwt_token: JWT token for authentication
            **kwargs: Additional client options
            
        Returns:
            ConfigurationManagerClient instance
        """
        if not jwt_token:
            raise ValidationError("JWT token cannot be empty")

        return cls.create(base_url=base_url, jwt_token=jwt_token, **kwargs)

    @classmethod
    def for_login(
        cls,
        base_url: str,
        **kwargs,
    ) -> "ConfigurationManagerClient":
        """Create a new client for login-based authentication.
        
        Args:
            base_url: Base URL of the Configuration Manager API
            **kwargs: Additional client options
            
        Returns:
            ConfigurationManagerClient instance
        """
        return cls.create(base_url=base_url, **kwargs)

    def is_healthy(self) -> bool:
        """Check if the Configuration Manager service is healthy.
        
        Returns:
            True if the service is healthy, False otherwise
        """
        try:
            response = self._http_client.get("/health")
            return response.status_code == 200
        except Exception:
            return False

    def get_health(self) -> HealthResponse:
        """Get detailed health information.
        
        Returns:
            HealthResponse containing health details
        """
        response = self._http_client.get("/health")
        return from_dict(HealthResponse, response.json())

    def set_jwt_token(self, token: str) -> None:
        """Update the JWT token for authentication.
        
        Args:
            token: New JWT token
        """
        self._http_client.set_jwt_token(token)

    def set_api_key(self, api_key: str) -> None:
        """Update the API key for authentication.
        
        Args:
            api_key: New API key
        """
        self._http_client.set_api_key(api_key)

    def close(self) -> None:
        """Close the HTTP client and cleanup resources."""
        self._http_client.close()

    def __enter__(self) -> "ConfigurationManagerClient":
        """Context manager entry."""
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        """Context manager exit."""
        self.close()


# Convenience factory functions for backward compatibility and ease of use

def create_client(
    base_url: str,
    api_key: Optional[str] = None,
    jwt_token: Optional[str] = None,
    **kwargs,
) -> ConfigurationManagerClient:
    """Create a new Configuration Manager client.
    
    Args:
        base_url: Base URL of the Configuration Manager API
        api_key: API key for authentication (optional)
        jwt_token: JWT token for authentication (optional)
        **kwargs: Additional client options
        
    Returns:
        ConfigurationManagerClient instance
    """
    return ConfigurationManagerClient.create(
        base_url=base_url,
        api_key=api_key,
        jwt_token=jwt_token,
        **kwargs,
    )


def create_client_with_api_key(
    base_url: str,
    api_key: str,
    **kwargs,
) -> ConfigurationManagerClient:
    """Create a new client with API key authentication.
    
    Args:
        base_url: Base URL of the Configuration Manager API
        api_key: API key for authentication
        **kwargs: Additional client options
        
    Returns:
        ConfigurationManagerClient instance
    """
    return ConfigurationManagerClient.with_api_key(base_url, api_key, **kwargs)


def create_client_with_jwt_token(
    base_url: str,
    jwt_token: str,
    **kwargs,
) -> ConfigurationManagerClient:
    """Create a new client with JWT token authentication.
    
    Args:
        base_url: Base URL of the Configuration Manager API
        jwt_token: JWT token for authentication
        **kwargs: Additional client options
        
    Returns:
        ConfigurationManagerClient instance
    """
    return ConfigurationManagerClient.with_jwt_token(base_url, jwt_token, **kwargs)


def create_client_for_login(
    base_url: str,
    **kwargs,
) -> ConfigurationManagerClient:
    """Create a new client for login-based authentication.
    
    Args:
        base_url: Base URL of the Configuration Manager API
        **kwargs: Additional client options
        
    Returns:
        ConfigurationManagerClient instance
    """
    return ConfigurationManagerClient.for_login(base_url, **kwargs)
