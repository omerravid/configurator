"""Authentication service for Configuration Manager API."""

from typing import Optional

from ..http_client import HTTPClient
from ..models.auth import (
    LoginRequest,
    RegisterRequest,
    AuthResponse,
    CurrentUserResponse,
    TokenRefreshResponse,
)
from ..exceptions import ValidationError
from ..utils import from_dict


class AuthService:
    """Authentication service client."""

    def __init__(self, http_client: HTTPClient):
        """Initialize authentication service.
        
        Args:
            http_client: HTTP client instance
        """
        self.client = http_client

    def login(self, username: str, password: str) -> AuthResponse:
        """Login with username and password.
        
        Args:
            username: Username for authentication
            password: Password for authentication
            
        Returns:
            AuthResponse containing token and user information
            
        Raises:
            ValidationError: If username or password is empty
            AuthenticationError: If login fails
        """
        if not username:
            raise ValidationError("Username cannot be empty")

        if not password:
            raise ValidationError("Password cannot be empty")

        request = LoginRequest(username=username, password=password)
        
        response = self.client.post("/auth/login", json_data={
            "username": request.username,
            "password": request.password,
        })

        auth_response = from_dict(AuthResponse, response.json())

        # Update the client with the new token
        if auth_response.token:
            self.client.set_jwt_token(auth_response.token)

        return auth_response

    def register(
        self, 
        username: str, 
        password: str, 
        role: Optional[str] = None
    ) -> AuthResponse:
        """Register a new user account.
        
        Args:
            username: Username for the new account
            password: Password for the new account
            role: User role ("USER" or "ADMIN", defaults to "USER")
            
        Returns:
            AuthResponse containing token and user information
            
        Raises:
            ValidationError: If username/password is empty or role is invalid
        """
        if not username:
            raise ValidationError("Username cannot be empty")

        if not password:
            raise ValidationError("Password cannot be empty")

        if role is not None and role not in ("USER", "ADMIN"):
            raise ValidationError("Role must be either 'USER' or 'ADMIN'")

        request_data = {
            "username": username,
            "password": password,
        }
        
        if role:
            request_data["role"] = role

        response = self.client.post("/auth/register", json_data=request_data)

        auth_response = from_dict(AuthResponse, response.json())

        # Update the client with the new token
        if auth_response.token:
            self.client.set_jwt_token(auth_response.token)

        return auth_response

    def get_current_user(self) -> CurrentUserResponse:
        """Get current authenticated user information.
        
        Returns:
            CurrentUserResponse containing user information
            
        Raises:
            AuthenticationError: If not authenticated
        """
        response = self.client.get("/auth/me")
        return from_dict(CurrentUserResponse, response.json())

    def refresh_token(self) -> TokenRefreshResponse:
        """Refresh JWT token.
        
        Returns:
            TokenRefreshResponse containing new token
            
        Raises:
            AuthenticationError: If token refresh fails
        """
        response = self.client.post("/auth/refresh")
        
        refresh_response = from_dict(TokenRefreshResponse, response.json())

        # Update the client with the new token
        if refresh_response.token:
            self.client.set_jwt_token(refresh_response.token)

        return refresh_response

    def set_jwt_token(self, token: str) -> None:
        """Update the client's JWT token.
        
        Args:
            token: New JWT token
        """
        if token:
            self.client.set_jwt_token(token)
