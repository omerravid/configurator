"""User management service for Configuration Manager API."""

from ..http_client import HTTPClient
from ..models.users import (
    UsersListResponse,
    UserResponse,
    UpdateUserRoleRequest,
    UserRoleUpdateResponse,
    UserDeletionResponse,
    UserConfigurationsResponse,
)
from ..exceptions import ValidationError
from ..utils import from_dict


class UserService:
    """User management service client."""

    def __init__(self, http_client: HTTPClient):
        """Initialize user service.
        
        Args:
            http_client: HTTP client instance
        """
        self.client = http_client

    def get_all(self) -> UsersListResponse:
        """Get all users (admin only).
        
        Returns:
            UsersListResponse containing list of users
        """
        response = self.client.get("/users")
        return from_dict(UsersListResponse, response.json())

    def get(self, user_id: str) -> UserResponse:
        """Get a specific user by ID.
        
        Args:
            user_id: User ID
            
        Returns:
            UserResponse containing user information
            
        Raises:
            ValidationError: If user_id is empty
        """
        if not user_id:
            raise ValidationError("User ID cannot be empty")

        response = self.client.get(f"/users/{user_id}")
        return from_dict(UserResponse, response.json())

    def update_role(self, user_id: str, role: str) -> UserRoleUpdateResponse:
        """Update user role (admin only).
        
        Args:
            user_id: User ID
            role: New role ("USER" or "ADMIN")
            
        Returns:
            UserRoleUpdateResponse containing updated user
            
        Raises:
            ValidationError: If parameters are invalid
        """
        if not user_id:
            raise ValidationError("User ID cannot be empty")

        if not role:
            raise ValidationError("Role cannot be empty")

        if role not in ("USER", "ADMIN"):
            raise ValidationError("Role must be either 'USER' or 'ADMIN'")

        data = {"role": role}
        response = self.client.put(f"/users/{user_id}/role", json_data=data)
        return from_dict(UserRoleUpdateResponse, response.json())

    def delete(self, user_id: str) -> UserDeletionResponse:
        """Delete a user (admin only).
        
        Args:
            user_id: User ID
            
        Returns:
            UserDeletionResponse containing deletion confirmation
            
        Raises:
            ValidationError: If user_id is empty
        """
        if not user_id:
            raise ValidationError("User ID cannot be empty")

        response = self.client.delete(f"/users/{user_id}")
        return from_dict(UserDeletionResponse, response.json())

    def get_configurations(self, user_id: str) -> UserConfigurationsResponse:
        """Get configurations created by a user.
        
        Args:
            user_id: User ID
            
        Returns:
            UserConfigurationsResponse containing user's configurations
            
        Raises:
            ValidationError: If user_id is empty
        """
        if not user_id:
            raise ValidationError("User ID cannot be empty")

        response = self.client.get(f"/users/{user_id}/configurations")
        return from_dict(UserConfigurationsResponse, response.json())
