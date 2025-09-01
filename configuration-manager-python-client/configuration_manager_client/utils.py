"""Utility functions for Configuration Manager client."""

import json
from datetime import datetime
from typing import TypeVar, Type, Dict, Any, Optional, Union, List
from dataclasses import is_dataclass, fields

from .models.types import (
    ConfigurationType,
    ConfigurationStatus,
    UserRole,
    RuleType,
    StorageType,
)

T = TypeVar('T')


def from_dict(cls: Type[T], data: Dict[str, Any]) -> T:
    """Convert dictionary to dataclass instance.
    
    Args:
        cls: Target dataclass type
        data: Dictionary data to convert
        
    Returns:
        Instance of the dataclass
    """
    if not is_dataclass(cls):
        return cls(data)  # type: ignore

    # Get field information
    field_types = {f.name: f.type for f in fields(cls)}
    kwargs = {}

    for field_name, field_type in field_types.items():
        # Handle different field name conventions (snake_case vs camelCase)
        value = None
        for key in [field_name, field_name.replace('_', ''), to_camel_case(field_name)]:
            if key in data:
                value = data[key]
                break

        if value is None:
            continue

        # Convert value based on field type
        kwargs[field_name] = convert_value(value, field_type)

    return cls(**kwargs)


def to_dict(instance: Any, camel_case: bool = False) -> Dict[str, Any]:
    """Convert dataclass instance to dictionary.
    
    Args:
        instance: Dataclass instance
        camel_case: Whether to convert keys to camelCase
        
    Returns:
        Dictionary representation
    """
    if not is_dataclass(instance):
        return instance

    result = {}
    for field in fields(instance):
        value = getattr(instance, field.name)
        if value is None:
            continue

        # Convert field name if needed
        key = to_camel_case(field.name) if camel_case else field.name
        
        # Convert value
        if is_dataclass(value):
            result[key] = to_dict(value, camel_case)
        elif isinstance(value, list):
            result[key] = [to_dict(item, camel_case) if is_dataclass(item) else item for item in value]
        elif isinstance(value, datetime):
            result[key] = value.isoformat()
        elif hasattr(value, 'value'):  # Enum
            result[key] = value.value
        else:
            result[key] = value

    return result


def convert_value(value: Any, target_type: Type) -> Any:
    """Convert value to target type.
    
    Args:
        value: Value to convert
        target_type: Target type
        
    Returns:
        Converted value
    """
    if value is None:
        return None

    # Handle Union types (Optional)
    if hasattr(target_type, '__origin__') and target_type.__origin__ is Union:
        # For Optional[T], try the non-None type
        for arg in target_type.__args__:
            if arg is not type(None):
                return convert_value(value, arg)
        return None

    # Handle List types
    if hasattr(target_type, '__origin__') and target_type.__origin__ in (list, List):
        if not isinstance(value, list):
            return value
        item_type = target_type.__args__[0] if target_type.__args__ else Any
        return [convert_value(item, item_type) for item in value]

    # Handle datetime
    if target_type == datetime:
        if isinstance(value, str):
            # Try to parse ISO format
            try:
                return datetime.fromisoformat(value.replace('Z', '+00:00'))
            except ValueError:
                return datetime.fromisoformat(value)
        return value

    # Handle enums
    if isinstance(target_type, type) and issubclass(target_type, (
        ConfigurationType, ConfigurationStatus, UserRole, RuleType, StorageType
    )):
        if isinstance(value, str):
            return target_type(value)
        return value

    # Handle dataclasses
    if is_dataclass(target_type):
        if isinstance(value, dict):
            return from_dict(target_type, value)
        return value

    # Handle basic types
    if target_type in (int, float, str, bool):
        return target_type(value)

    # Return as-is for other types
    return value


def to_camel_case(snake_str: str) -> str:
    """Convert snake_case to camelCase.
    
    Args:
        snake_str: String in snake_case
        
    Returns:
        String in camelCase
    """
    components = snake_str.split('_')
    return components[0] + ''.join(x.capitalize() for x in components[1:])


def to_snake_case(camel_str: str) -> str:
    """Convert camelCase to snake_case.
    
    Args:
        camel_str: String in camelCase
        
    Returns:
        String in snake_case
    """
    import re
    s1 = re.sub('(.)([A-Z][a-z]+)', r'\1_\2', camel_str)
    return re.sub('([a-z0-9])([A-Z])', r'\1_\2', s1).lower()


def build_query_params(**kwargs) -> Dict[str, str]:
    """Build query parameters from keyword arguments.
    
    Args:
        **kwargs: Keyword arguments
        
    Returns:
        Dictionary of query parameters
    """
    params = {}
    for key, value in kwargs.items():
        if value is not None:
            if isinstance(value, bool):
                params[key] = 'true' if value else 'false'
            elif hasattr(value, 'value'):  # Enum
                params[key] = value.value
            else:
                params[key] = str(value)
    return params


def safe_json_loads(text: str) -> Optional[Dict[str, Any]]:
    """Safely parse JSON text.
    
    Args:
        text: JSON text to parse
        
    Returns:
        Parsed dictionary or None if parsing fails
    """
    try:
        return json.loads(text)
    except (json.JSONDecodeError, TypeError):
        return None


def validate_file_size(file_data: bytes, max_size: int) -> None:
    """Validate file size.
    
    Args:
        file_data: File data as bytes
        max_size: Maximum allowed size
        
    Raises:
        ValidationError: If file is too large
    """
    from .exceptions import ValidationError
    
    if len(file_data) > max_size:
        raise ValidationError(
            f"File size {len(file_data)} exceeds maximum allowed size {max_size}"
        )


def get_content_type(filename: str) -> str:
    """Get content type from filename extension.
    
    Args:
        filename: Filename with extension
        
    Returns:
        Content type string
    """
    import os
    
    ext = os.path.splitext(filename)[1].lower()
    
    content_types = {
        '.txt': 'text/plain',
        '.html': 'text/html',
        '.htm': 'text/html',
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.json': 'application/json',
        '.xml': 'application/xml',
        '.pdf': 'application/pdf',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.bmp': 'image/bmp',
        '.svg': 'image/svg+xml',
        '.mp4': 'video/mp4',
        '.avi': 'video/x-msvideo',
        '.mov': 'video/quicktime',
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.zip': 'application/zip',
        '.tar': 'application/x-tar',
        '.gz': 'application/gzip',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.xls': 'application/vnd.ms-excel',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.ppt': 'application/vnd.ms-powerpoint',
        '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    }
    
    return content_types.get(ext, 'application/octet-stream')
