"""Custom exceptions for Configuration Manager client."""

from datetime import datetime
from typing import Optional, Dict, Any

import requests


class ConfigurationManagerError(Exception):
    """Base exception for Configuration Manager client."""

    def __init__(
        self,
        message: str,
        status_code: Optional[int] = None,
        error_code: Optional[str] = None,
        details: Optional[str] = None,
    ):
        self.message = message
        self.status_code = status_code
        self.error_code = error_code
        self.details = details
        super().__init__(message)

    def __str__(self) -> str:
        """String representation of the error."""
        if self.status_code:
            return f"Configuration Manager API error {self.status_code}: {self.message}"
        return f"Configuration Manager error: {self.message}"


class AuthenticationError(ConfigurationManagerError):
    """Authentication-related errors (401)."""

    def __init__(self, message: str, status_code: Optional[int] = None):
        super().__init__(message, status_code)


class AuthorizationError(ConfigurationManagerError):
    """Authorization-related errors (403)."""

    def __init__(self, message: str, status_code: Optional[int] = None):
        super().__init__(message, status_code)


class ValidationError(ConfigurationManagerError):
    """Validation-related errors (400)."""

    def __init__(self, message: str, status_code: Optional[int] = None):
        super().__init__(message, status_code)


class NotFoundError(ConfigurationManagerError):
    """Resource not found errors (404)."""

    def __init__(self, message: str, status_code: Optional[int] = None):
        super().__init__(message, status_code)


class ConflictError(ConfigurationManagerError):
    """Conflict errors, e.g., duplicate names (409)."""

    def __init__(self, message: str, status_code: Optional[int] = None):
        super().__init__(message, status_code)


class RateLimitError(ConfigurationManagerError):
    """Rate limiting errors (429)."""

    def __init__(
        self,
        message: str,
        status_code: Optional[int] = None,
        retry_after: Optional[datetime] = None,
    ):
        super().__init__(message, status_code)
        self.retry_after = retry_after


class APIError(ConfigurationManagerError):
    """General API communication errors."""

    def __init__(
        self,
        message: str,
        status_code: Optional[int] = None,
        error_response: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(message, status_code)
        self.error_response = error_response


class NetworkError(ConfigurationManagerError):
    """Network-level errors."""

    def __init__(self, message: str, cause: Optional[Exception] = None):
        super().__init__(message)
        self.cause = cause
        self.__cause__ = cause


class TimeoutError(ConfigurationManagerError):
    """Timeout errors."""

    def __init__(self, message: str, timeout: Optional[float] = None):
        super().__init__(message)
        self.timeout = timeout


class HTTPError(ConfigurationManagerError):
    """HTTP-level errors."""

    def __init__(
        self,
        message: str,
        request: Optional[requests.Request] = None,
        response: Optional[requests.Response] = None,
    ):
        status_code = response.status_code if response else None
        super().__init__(message, status_code)
        self.request = request
        self.response = response


def create_error_from_response(response: requests.Response) -> ConfigurationManagerError:
    """Create appropriate error from HTTP response."""
    try:
        error_data = response.json()
        message = error_data.get("error", f"HTTP {response.status_code} error")
        details = error_data.get("details")
        error_code = error_data.get("code")
    except (ValueError, TypeError):
        # If response is not JSON or malformed
        message = f"HTTP {response.status_code} error"
        details = response.text if response.text else None
        error_code = None

    # Create specific error types based on status code
    status_code = response.status_code

    if status_code == 401:
        return AuthenticationError(message, status_code)
    elif status_code == 403:
        return AuthorizationError(message, status_code)
    elif status_code == 404:
        return NotFoundError(message, status_code)
    elif status_code == 400:
        return ValidationError(message, status_code)
    elif status_code == 409:
        return ConflictError(message, status_code)
    elif status_code == 429:
        # Default retry after 1 minute if not specified
        retry_after = datetime.now()
        try:
            import datetime as dt
            retry_after += dt.timedelta(minutes=1)
        except ImportError:
            pass
        return RateLimitError(message, status_code, retry_after)
    else:
        error_response = {
            "error": message,
            "details": details,
            "code": error_code,
        }
        return APIError(message, status_code, error_response)


def create_network_error(
    message: str, cause: Optional[Exception] = None
) -> NetworkError:
    """Create network error from exception."""
    return NetworkError(message, cause)


def create_timeout_error(message: str, timeout: Optional[float] = None) -> TimeoutError:
    """Create timeout error."""
    return TimeoutError(message, timeout)
