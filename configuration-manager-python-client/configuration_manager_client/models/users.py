"""User management models for Configuration Manager client."""

from dataclasses import dataclass
from typing import List

from .auth import User
from .configuration import Configuration


@dataclass
class UsersListResponse:
    """Users list response."""
    users: List[User]


@dataclass
class UserResponse:
    """User response."""
    user: User


@dataclass
class UpdateUserRoleRequest:
    """Update user role request."""
    role: str


@dataclass
class UserRoleUpdateResponse:
    """User role update response."""
    message: str
    user: User


@dataclass
class UserSummary:
    """User summary."""
    id: str
    username: str


@dataclass
class UserDeletionResponse:
    """User deletion response."""
    message: str
    deleted_user: UserSummary


@dataclass
class UserConfigurationsResponse:
    """User configurations response."""
    configurations: List[Configuration]
