"""Base HTTP client for Configuration Manager."""

import json
from typing import Optional, Dict, Any, Union, BinaryIO
from urllib.parse import urljoin, urlencode

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from .exceptions import (
    create_error_from_response,
    create_network_error,
    create_timeout_error,
)


class HTTPClient:
    """HTTP client with authentication for Configuration Manager API."""

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
        """Initialize HTTP client.
        
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
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.jwt_token = jwt_token
        self.timeout = timeout
        self.max_file_size = max_file_size
        self.user_agent = user_agent
        self.verify_ssl = verify_ssl

        # Create session with retry strategy
        self.session = requests.Session()
        
        # Configure retry strategy
        retry_strategy = Retry(
            total=max_retries,
            status_forcelist=[429, 500, 502, 503, 504],
            backoff_factor=1,
            raise_on_status=False,
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)

        # Set default headers
        self._update_headers()

    def _update_headers(self) -> None:
        """Update session headers with authentication and common headers."""
        self.session.headers.clear()
        
        # Set User-Agent
        if self.user_agent:
            self.session.headers["User-Agent"] = self.user_agent

        # Set authentication headers
        if self.jwt_token:
            self.session.headers["Authorization"] = f"Bearer {self.jwt_token}"
        elif self.api_key:
            self.session.headers["X-API-Key"] = self.api_key

        # Set common headers
        self.session.headers["Accept"] = "application/json"

    def set_jwt_token(self, token: str) -> None:
        """Update JWT token for authentication."""
        self.jwt_token = token
        self._update_headers()

    def set_api_key(self, api_key: str) -> None:
        """Update API key for authentication."""
        self.api_key = api_key
        self._update_headers()

    def _build_url(self, path: str) -> str:
        """Build full URL from path."""
        return urljoin(self.base_url, path.lstrip("/"))

    def _handle_response(self, response: requests.Response) -> requests.Response:
        """Handle response and raise appropriate exceptions for errors."""
        if response.status_code >= 400:
            raise create_error_from_response(response)
        return response

    def get(
        self,
        path: str,
        params: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> requests.Response:
        """Perform GET request."""
        url = self._build_url(path)
        
        try:
            response = self.session.get(
                url,
                params=params,
                headers=headers,
                timeout=self.timeout,
                verify=self.verify_ssl,
            )
            return self._handle_response(response)
        except requests.exceptions.Timeout:
            raise create_timeout_error(f"Request to {url} timed out", self.timeout)
        except requests.exceptions.RequestException as e:
            raise create_network_error(f"Request to {url} failed: {e}", e)

    def post(
        self,
        path: str,
        data: Optional[Union[Dict[str, Any], str, bytes]] = None,
        json_data: Optional[Dict[str, Any]] = None,
        files: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> requests.Response:
        """Perform POST request."""
        url = self._build_url(path)

        # Set content type for JSON if not uploading files
        if json_data is not None and files is None:
            if headers is None:
                headers = {}
            headers.setdefault("Content-Type", "application/json")

        try:
            response = self.session.post(
                url,
                data=data,
                json=json_data,
                files=files,
                headers=headers,
                timeout=self.timeout,
                verify=self.verify_ssl,
            )
            return self._handle_response(response)
        except requests.exceptions.Timeout:
            raise create_timeout_error(f"Request to {url} timed out", self.timeout)
        except requests.exceptions.RequestException as e:
            raise create_network_error(f"Request to {url} failed: {e}", e)

    def put(
        self,
        path: str,
        data: Optional[Union[Dict[str, Any], str, bytes]] = None,
        json_data: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> requests.Response:
        """Perform PUT request."""
        url = self._build_url(path)

        # Set content type for JSON
        if json_data is not None:
            if headers is None:
                headers = {}
            headers.setdefault("Content-Type", "application/json")

        try:
            response = self.session.put(
                url,
                data=data,
                json=json_data,
                headers=headers,
                timeout=self.timeout,
                verify=self.verify_ssl,
            )
            return self._handle_response(response)
        except requests.exceptions.Timeout:
            raise create_timeout_error(f"Request to {url} timed out", self.timeout)
        except requests.exceptions.RequestException as e:
            raise create_network_error(f"Request to {url} failed: {e}", e)

    def delete(
        self,
        path: str,
        headers: Optional[Dict[str, str]] = None,
    ) -> requests.Response:
        """Perform DELETE request."""
        url = self._build_url(path)

        try:
            response = self.session.delete(
                url,
                headers=headers,
                timeout=self.timeout,
                verify=self.verify_ssl,
            )
            return self._handle_response(response)
        except requests.exceptions.Timeout:
            raise create_timeout_error(f"Request to {url} timed out", self.timeout)
        except requests.exceptions.RequestException as e:
            raise create_network_error(f"Request to {url} failed: {e}", e)

    def download(
        self,
        path: str,
        headers: Optional[Dict[str, str]] = None,
    ) -> requests.Response:
        """Download file content."""
        url = self._build_url(path)

        try:
            response = self.session.get(
                url,
                headers=headers,
                timeout=self.timeout,
                verify=self.verify_ssl,
                stream=True,  # Stream for large files
            )
            return self._handle_response(response)
        except requests.exceptions.Timeout:
            raise create_timeout_error(f"Download from {url} timed out", self.timeout)
        except requests.exceptions.RequestException as e:
            raise create_network_error(f"Download from {url} failed: {e}", e)

    def close(self) -> None:
        """Close the HTTP session."""
        if self.session:
            self.session.close()

    def __enter__(self):
        """Context manager entry."""
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit."""
        self.close()
