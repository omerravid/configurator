"""Authentication models for Configuration Manager client."""

from dataclasses import dataclass
from datetime import datetime
from typing import Optional


@dataclass
class LoginRequest:
    """Login request."""
    username: str
    password: str


@dataclass
class RegisterRequest:
    """Register request."""
    username: str
    password: str
    role: Optional[str] = None


@dataclass
class User:
    """User information."""
    id: str
    username: str
    role: str
    created_at: datetime
    updated_at: datetime


@dataclass
class AuthResponse:
    """Authentication response."""
    token: str
    user: User
    message: Optional[str] = None


@dataclass
class CurrentUserResponse:
    """Current user response."""
    user: User


@dataclass
class TokenRefreshResponse:
    """Token refresh response."""
    token: str
