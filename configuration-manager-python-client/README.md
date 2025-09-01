# Configuration Manager Python Client

A comprehensive Python client library for the Configuration Manager service, providing full access to authentication, REST API operations, and file management capabilities.

## Features

- ✅ **Complete API Coverage**: All REST endpoints supported
- ✅ **Authentication**: JWT token and API key authentication
- ✅ **Configuration Management**: Full CRUD operations with inheritance and provenance
- ✅ **File Management**: Upload, download, and folder import capabilities
- ✅ **User Management**: User administration and role management
- ✅ **Rules Engine**: Validation rules management
- ✅ **Settings & Admin**: System configuration and data migration
- ✅ **Error Handling**: Comprehensive exception types with proper error handling
- ✅ **Type Safety**: Strongly typed dataclasses for all API models
- ✅ **Python 3.8+**: Compatible with Python 3.8 and later versions
- ✅ **Context Manager**: Proper resource management with context manager support

## Installation

```bash
pip install configuration-manager-client
```

Or from source:

```bash
git clone https://github.com/configuration-manager/python-client.git
cd python-client
pip install -e .
```

## Quick Start

### Basic Usage

```python
from configuration_manager_client import ConfigurationManagerClient

# Create client with API key
client = ConfigurationManagerClient.with_api_key(
    "http://localhost:3002/api", 
    "your-api-key"
)

# Check service health
is_healthy = client.is_healthy()
print(f"Service healthy: {is_healthy}")

# Get all configurations
configs = client.configurations.get_all()
print(f"Found {len(configs.configs)} configurations")
```

### Login-based Authentication

```python
# Create client for login
client = ConfigurationManagerClient.for_login("http://localhost:3002/api")

# Login with credentials
auth_response = client.auth.login("admin", "admin123")
print(f"Logged in as: {auth_response.user.username}")

# Client is now authenticated and ready to use
configs = client.configurations.get_all()
```

### Context Manager Usage

```python
# Recommended: Use as context manager for proper resource cleanup
with ConfigurationManagerClient.with_api_key(
    "http://localhost:3002/api", 
    "your-api-key"
) as client:
    # Use client services
    configs = client.configurations.get_all()
    print(f"Found {len(configs.configs)} configurations")

# Client is automatically closed
```

## API Reference

### Authentication Service

```python
# Login
auth_response = client.auth.login("username", "password")

# Register new user
register_response = client.auth.register("newuser", "password", "USER")

# Get current user
current_user = client.auth.get_current_user()

# Refresh token
refresh_response = client.auth.refresh_token()

# Update token
client.auth.set_jwt_token("new-jwt-token")
```

### Configuration Service

```python
from configuration_manager_client.models import (
    ConfigurationType,
    ConfigurationStatus,
    CreateConfigurationRequest,
    UpdateConfigurationRequest,
    GetConfigurationsOptions,
    GetConfigurationOptions,
    GetConfigurationValueOptions,
)

# Get all configurations
configs = client.configurations.get_all()

# Get configurations with filtering
filtered_configs = client.configurations.get_all(
    GetConfigurationsOptions(
        type=ConfigurationType.COMPONENT,
        status=ConfigurationStatus.COMMITTED,
        include_archived=False,
    )
)

# Get specific configuration with provenance
config = client.configurations.get(
    "config-id", 
    GetConfigurationOptions(provenance=True)
)

# Create new configuration
create_request = CreateConfigurationRequest(
    name="My Component",
    type=ConfigurationType.COMPONENT,
    data={"setting1": "value1", "setting2": 42},
    description="Example configuration"
)
new_config = client.configurations.create(create_request)

# Update configuration
update_request = UpdateConfigurationRequest(
    data={"setting1": "updated_value"}
)
updated = client.configurations.update("config-id", update_request)

# Get configuration value at specific path
value = client.configurations.get_value(
    "config-id",
    GetConfigurationValueOptions(path="setting1", minimal=True)
)

# Get child configurations
children = client.configurations.get_children("config-id")

# Admin operations
client.configurations.archive("config-id", archive_children=True)
client.configurations.restore("config-id")
```

### File Service

```python
from configuration_manager_client.models import ReplaceFileRequest, FolderImportRequest

# Download file
download_result = client.files.download("storage-key")
client.files.save_to_file(download_result, "/path/to/save/file.pdf")

# Replace file in configuration (from file path)
replace_response = client.files.replace_file_from_path(
    config_id="config-id",
    property_path="documents.manual",
    file_path="/path/to/manual.pdf"
)

# Replace file (from bytes)
file_data = b"File content"
replace_response = client.files.replace_file_from_bytes(
    config_id="config-id",
    property_path="documents.readme",
    file_data=file_data,
    file_name="readme.txt",
    content_type="text/plain"
)

# Replace file (using request object)
from io import BytesIO

file_stream = BytesIO(b"File content")
replace_request = ReplaceFileRequest(
    config_id="config-id",
    property_path="documents.test",
    file=file_stream,
    file_name="test.txt",
    content_type="text/plain"
)
replace_response = client.files.replace_file(replace_request)

# Import folder structure
from configuration_manager_client.models import FolderImportFile

folder_files = [
    FolderImportFile(
        file=BytesIO(b'{"version": "1.0"}'),
        file_name="config.json",
        content_type="application/json",
        relative_path="config/config.json"
    )
]

folder_request = FolderImportRequest(
    files=folder_files,
    folder_name="project-assets"
)
import_response = client.files.import_folder(folder_request)

# Get file information
file_info = client.files.get_info("storage-key")
```

### User Service (Admin)

```python
# Get all users
users = client.users.get_all()

# Get specific user
user = client.users.get("user-id")

# Update user role
role_update = client.users.update_role("user-id", "ADMIN")

# Get user's configurations
user_configs = client.users.get_configurations("user-id")

# Delete user
deletion = client.users.delete("user-id")
```

### Rules Service

```python
from configuration_manager_client.models import (
    CreateRuleRequest,
    ValidateRuleRequest,
    GetRulesOptions,
    RuleType,
    NumericRuleConfig,
)

# Get rules for configuration
rules = client.rules.get_all(
    GetRulesOptions(configuration_id="config-id")
)

# Create validation rule
rule_config = NumericRuleConfig(min=0.0, max=100.0, required=True)

create_rule_request = CreateRuleRequest(
    configuration_id="config-id",
    property_path="settings.maxValue",
    rule_type=RuleType.NUMERIC,
    rule_config=rule_config.__dict__,
    error_message="Value must be between 0 and 100"
)
rule = client.rules.create(create_rule_request)

# Validate value against rules
validate_request = ValidateRuleRequest(
    configuration_id="config-id",
    property_path="settings.maxValue",
    value=150
)
validation = client.rules.validate(validate_request)
```

### Settings Service (Admin)

```python
from configuration_manager_client.models import CreateBackupRequest, RestoreRequest

# Get data statistics
stats = client.settings.get_data_statistics()

# Create backup
backup_request = CreateBackupRequest(name="manual-backup")
backup = client.settings.create_backup(backup_request)

# List backups
backups = client.settings.get_backups()

# Restore from backup
restore_request = RestoreRequest(backup_name="backup-filename.json")
restore_result = client.settings.restore_from_backup(restore_request)

# MongoDB operations
mongo_settings = client.settings.get_mongodb_settings()
mongo_status = client.settings.get_mongodb_status()

# Storage settings
storage_settings = client.settings.get_storage_settings()
storage_status = client.settings.get_storage_status()
```

## Error Handling

The library provides specific exception types for different error scenarios:

```python
from configuration_manager_client.exceptions import (
    AuthenticationError,
    AuthorizationError,
    ValidationError,
    NotFoundError,
    ConflictError,
    RateLimitError,
    APIError,
    NetworkError,
    TimeoutError,
)

try:
    config = client.configurations.get("non-existent-id")
except NotFoundError as e:
    # Handle 404 errors
    print(f"Configuration not found: {e.message}")
except AuthenticationError as e:
    # Handle 401 errors
    print(f"Authentication failed: {e.message}")
except AuthorizationError as e:
    # Handle 403 errors
    print(f"Access denied: {e.message}")
except ValidationError as e:
    # Handle 400 validation errors
    print(f"Validation error: {e.message}")
except ConflictError as e:
    # Handle 409 conflicts
    print(f"Conflict: {e.message}")
except RateLimitError as e:
    # Handle 429 rate limiting
    print(f"Rate limited. Retry after: {e.retry_after}")
except APIError as e:
    # Handle other API errors
    print(f"API error: {e.message} (Status: {e.status_code})")
except NetworkError as e:
    # Handle network errors
    print(f"Network error: {e.message}")
except TimeoutError as e:
    # Handle timeout errors
    print(f"Timeout: {e.message}")
```

## Factory Methods

```python
# With API key
client = ConfigurationManagerClient.with_api_key(base_url, api_key)

# With JWT token
client = ConfigurationManagerClient.with_jwt_token(base_url, jwt_token)

# For login-based authentication
client = ConfigurationManagerClient.for_login(base_url)

# With custom configuration
from configuration_manager_client.client import ClientOptions

options = ClientOptions(
    base_url=base_url,
    api_key=api_key,
    timeout=60.0,
    max_file_size=100 * 1024 * 1024,
    verify_ssl=True,
    max_retries=5,
)
client = ConfigurationManagerClient(options)
```

## Configuration Options

### ClientOptions

```python
from configuration_manager_client.client import ClientOptions

options = ClientOptions(
    base_url="http://localhost:3002/api",  # Required
    api_key="your-api-key",               # Optional
    jwt_token="your-jwt-token",           # Optional
    timeout=30.0,                         # Request timeout in seconds
    max_file_size=50 * 1024 * 1024,      # Max file size (50MB)
    user_agent="my-app/1.0",              # Custom user agent
    verify_ssl=True,                      # SSL verification
    max_retries=3,                        # Max retry attempts
)
```

## Advanced Usage

### Custom HTTP Client Configuration

```python
# Create client with custom settings
client = ConfigurationManagerClient.create(
    base_url="http://localhost:3002/api",
    api_key="your-api-key",
    timeout=60.0,
    max_file_size=100 * 1024 * 1024,
    user_agent="custom-app/2.0",
    verify_ssl=False,  # For development only
    max_retries=5,
)
```

### Working with Large Files

```python
# Upload large file with progress tracking
def upload_large_file(client, config_id, file_path):
    """Upload large file with size validation."""
    import os
    
    file_size = os.path.getsize(file_path)
    if file_size > client._http_client.max_file_size:
        print(f"File too large: {file_size} bytes")
        return
    
    print(f"Uploading file: {file_path} ({file_size} bytes)")
    
    try:
        response = client.files.replace_file_from_path(
            config_id=config_id,
            property_path="documents.large_file",
            file_path=file_path
        )
        print(f"Upload success: {response.success}")
    except Exception as e:
        print(f"Upload failed: {e}")
```

## Examples

See the [examples directory](examples/) for comprehensive examples including:

- Basic authentication and client setup
- Configuration management operations
- File upload and download operations
- User administration
- Rules validation
- Settings and system administration
- Error handling patterns
- Advanced client configuration

To run the examples:

```bash
python examples/basic_usage.py
```

## Development

### Installing for Development

```bash
git clone https://github.com/configuration-manager/python-client.git
cd python-client

# Install in development mode with dev dependencies
pip install -e ".[dev]"
```

### Running Tests

```bash
# Run tests
pytest

# Run tests with coverage
pytest --cov=configuration_manager_client

# Run specific test file
pytest tests/test_auth_service.py
```

### Code Formatting

```bash
# Format code
black configuration_manager_client/

# Sort imports
isort configuration_manager_client/

# Type checking
mypy configuration_manager_client/

# Linting
flake8 configuration_manager_client/
```

## Requirements

- Python 3.8 or later
- requests >= 2.28.0
- Configuration Manager service running and accessible

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests for your changes
5. Ensure all tests pass (`pytest`)
6. Format your code (`black . && isort .`)
7. Commit your changes (`git commit -m 'Add some amazing feature'`)
8. Push to the branch (`git push origin feature/amazing-feature`)
9. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For issues and questions, please create an issue in the project repository or contact the Configuration Manager team.

## Changelog

### v2.0.0
- Initial release with complete API coverage
- Support for all Configuration Manager endpoints
- Comprehensive error handling
- File upload/download capabilities
- Type-safe dataclass models
- Python 3.8+ compatibility
- Context manager support
- Extensive documentation and examples
