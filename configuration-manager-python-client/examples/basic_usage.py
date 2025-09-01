"""Basic usage examples for Configuration Manager Python client."""

import os
import json
from io import BytesIO

from configuration_manager_client import (
    ConfigurationManagerClient,
    CreateConfigurationRequest,
    UpdateConfigurationRequest,
    ReplaceFileRequest,
    FolderImportRequest,
    FolderImportFile,
    CreateRuleRequest,
    ValidateRuleRequest,
    CreateBackupRequest,
    ConfigurationType,
    RuleType,
    NumericRuleConfig,
)
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


def basic_authentication_example():
    """Example: Basic client setup and authentication."""
    print("=== Basic Authentication Example ===")

    # Option 1: Create client with API key
    client = ConfigurationManagerClient.with_api_key(
        "http://localhost:3002/api", 
        "your-api-key"
    )

    # Option 2: Create client for login-based authentication
    login_client = ConfigurationManagerClient.for_login("http://localhost:3002/api")

    # Login with username and password
    try:
        auth_response = login_client.auth.login("admin", "admin123")
        print(f"Logged in as: {auth_response.user.username}")
    except AuthenticationError as e:
        print(f"Login failed: {e}")
        return

    # Option 3: Create client with JWT token
    jwt_client = ConfigurationManagerClient.with_jwt_token(
        "http://localhost:3002/api", 
        auth_response.token
    )

    # Check if the service is healthy
    is_healthy = client.is_healthy()
    print(f"Service health: {is_healthy}")

    # Get detailed health information
    try:
        health_info = client.get_health()
        print(f"Service status: {health_info.status}")
        print(f"Timestamp: {health_info.timestamp}")
    except Exception as e:
        print(f"Health check failed: {e}")

    print()


def configuration_management_example():
    """Example: Configuration management operations."""
    print("=== Configuration Management Example ===")

    client = ConfigurationManagerClient.with_api_key(
        "http://localhost:3002/api", 
        "your-api-key"
    )

    try:
        # Get all configurations
        configs_response = client.configurations.get_all()
        print(f"Found {len(configs_response.configs)} configurations")

        # Get configurations with filtering
        from configuration_manager_client.models.configuration import GetConfigurationsOptions
        
        filtered_configs = client.configurations.get_all(
            GetConfigurationsOptions(
                type=ConfigurationType.COMPONENT,
                include_archived=False,
            )
        )
        print(f"Found {len(filtered_configs.configs)} component configurations")

        # Create a new configuration
        create_request = CreateConfigurationRequest(
            name="My New Component",
            type=ConfigurationType.COMPONENT,
            data={
                "setting1": "value1",
                "setting2": 42,
                "nested": {
                    "property": "nested_value"
                }
            },
            description="Example component configuration",
        )

        new_config = client.configurations.create(create_request)
        print(f"Created configuration: {new_config.config.id}")

        # Get configuration with provenance
        from configuration_manager_client.models.configuration import GetConfigurationOptions
        
        resolved_config = client.configurations.get(
            new_config.config.id,
            GetConfigurationOptions(provenance=True)
        )
        print(f"Configuration data: {resolved_config.data}")

        # Get specific value from configuration
        from configuration_manager_client.models.configuration import GetConfigurationValueOptions
        
        value_response = client.configurations.get_value(
            new_config.config.id,
            GetConfigurationValueOptions(
                path="setting1",
                minimal=True
            )
        )
        print(f"Setting1 value: {value_response.value}")

        # Update configuration
        update_request = UpdateConfigurationRequest(
            data={
                "setting1": "updated_value",
                "setting3": "new_setting",
            },
            description="Updated description",
        )

        updated_config = client.configurations.update(
            new_config.config.id,
            update_request
        )
        print(f"Updated configuration: {updated_config.config.updated_at}")

        # Get child configurations
        children = client.configurations.get_children(new_config.config.id)
        print(f"Configuration has {children.count} children")

    except Exception as e:
        print(f"Configuration management error: {e}")

    print()


def file_management_example():
    """Example: File management operations."""
    print("=== File Management Example ===")

    client = ConfigurationManagerClient.with_api_key(
        "http://localhost:3002/api", 
        "your-api-key"
    )

    try:
        # Replace file in configuration using file path
        if os.path.exists("/path/to/manual.pdf"):
            replace_response = client.files.replace_file_from_path(
                config_id="config-id-123",
                property_path="documents.manual",
                file_path="/path/to/manual.pdf"
            )
            
            if replace_response.success:
                print(f"File replaced: {replace_response.file_object.metadata.original_name}")

        # Replace file using byte data
        file_content = b"This is a test file content"
        replace_response2 = client.files.replace_file_from_bytes(
            config_id="config-id-123",
            property_path="documents.readme",
            file_data=file_content,
            file_name="readme.txt",
            content_type="text/plain"
        )
        print(f"File replacement success: {replace_response2.success}")

        # Replace file using request object
        file_stream = BytesIO(b"Another test file")
        replace_request = ReplaceFileRequest(
            config_id="config-id-123",
            property_path="documents.test",
            file=file_stream,
            file_name="test.txt",
            content_type="text/plain"
        )

        replace_response3 = client.files.replace_file(replace_request)
        print(f"File replacement via request: {replace_response3.success}")

        # Download file
        try:
            download_result = client.files.download("storage-key-123")
            print(f"Downloaded file: {download_result.file_name}")
            print(f"File size: {download_result.content_length} bytes")
            
            # Save downloaded file
            client.files.save_to_file(download_result, "/tmp/downloaded-file.pdf")
            print("File saved to /tmp/downloaded-file.pdf")
        except NotFoundError:
            print("File not found for download")

        # Get file information
        try:
            file_info = client.files.get_info("storage-key-123")
            print(f"File metadata size: {file_info.metadata.size} bytes")
        except NotFoundError:
            print("File metadata not found")

        # Import folder structure
        folder_files = [
            FolderImportFile(
                file=BytesIO(b'{"version": "1.0"}'),
                file_name="config.json",
                content_type="application/json",
                relative_path="config/config.json"
            ),
            FolderImportFile(
                file=BytesIO(b"Binary file content"),
                file_name="logo.png",
                content_type="image/png",
                relative_path="assets/logo.png"
            )
        ]

        folder_request = FolderImportRequest(
            files=folder_files,
            folder_name="project-assets"
        )

        import_response = client.files.import_folder(folder_request)
        if import_response.success:
            print(f"Imported {import_response.stats.total_files} files")

    except Exception as e:
        print(f"File management error: {e}")

    print()


def user_management_example():
    """Example: User management operations (admin only)."""
    print("=== User Management Example ===")

    client = ConfigurationManagerClient.with_api_key(
        "http://localhost:3002/api", 
        "your-admin-api-key"
    )

    try:
        # Get all users
        users_response = client.users.get_all()
        print(f"Found {len(users_response.users)} users")

        # Get specific user
        if users_response.users:
            first_user = users_response.users[0]
            user_response = client.users.get(first_user.id)
            print(f"User: {user_response.user.username}")

            # Update user role
            role_update_response = client.users.update_role(first_user.id, "ADMIN")
            print(f"Updated user role: {role_update_response.user.role}")

            # Get user's configurations
            user_configs = client.users.get_configurations(first_user.id)
            print(f"User has {len(user_configs.configurations)} configurations")

            # Delete user (be careful!)
            # deletion_response = client.users.delete(first_user.id)
            # print(f"Deleted user: {deletion_response.deleted_user.username}")

    except AuthorizationError as e:
        print(f"Not authorized for user management: {e}")
    except Exception as e:
        print(f"User management error: {e}")

    print()


def rules_management_example():
    """Example: Rules management."""
    print("=== Rules Management Example ===")

    client = ConfigurationManagerClient.with_api_key(
        "http://localhost:3002/api", 
        "your-api-key"
    )

    try:
        # Get rules for configuration
        from configuration_manager_client.models.rules import GetRulesOptions
        
        rules = client.rules.get_all(
            GetRulesOptions(configuration_id="config-id-123")
        )
        print(f"Found {len(rules.rules)} rules")

        # Create validation rule
        rule_config = NumericRuleConfig(
            min=0.0,
            max=100.0,
            required=True
        )

        create_rule_request = CreateRuleRequest(
            configuration_id="config-id-123",
            property_path="settings.maxValue",
            rule_type=RuleType.NUMERIC,
            rule_config=rule_config.__dict__,
            error_message="Value must be between 0 and 100"
        )

        rule = client.rules.create(create_rule_request)
        print(f"Created rule: {rule.rule.id}")

        # Validate value against rules
        validate_request = ValidateRuleRequest(
            configuration_id="config-id-123",
            property_path="settings.maxValue",
            value=150  # This should fail validation
        )

        validation = client.rules.validate(validate_request)
        print(f"Validation result - Valid: {validation.valid}")
        if not validation.valid and validation.errors:
            print(f"Validation errors: {validation.errors}")

    except Exception as e:
        print(f"Rules management error: {e}")

    print()


def settings_administration_example():
    """Example: Settings and administration (admin only)."""
    print("=== Settings Administration Example ===")

    client = ConfigurationManagerClient.with_api_key(
        "http://localhost:3002/api", 
        "your-admin-api-key"
    )

    try:
        # Get data statistics
        stats_response = client.settings.get_data_statistics()
        if stats_response.statistics:
            print(f"Total configurations: {stats_response.statistics.configurations.total}")
            print(f"Total users: {stats_response.statistics.users.total}")

        # Create backup
        backup_request = CreateBackupRequest(name="manual-backup-2024")
        backup_response = client.settings.create_backup(backup_request)
        if backup_response.backup:
            print(f"Backup created: {backup_response.backup.filename}")

        # List backups
        backups_response = client.settings.get_backups()
        print(f"Available backups: {len(backups_response.backups)}")

        # Get MongoDB settings
        mongo_settings = client.settings.get_mongodb_settings()
        if mongo_settings.status:
            print(f"MongoDB connected: {mongo_settings.status.connected}")

        # Get storage settings
        storage_settings = client.settings.get_storage_settings()
        print(f"Storage type: {storage_settings.storage_type}")

    except AuthorizationError as e:
        print(f"Not authorized for admin operations: {e}")
    except Exception as e:
        print(f"Settings administration error: {e}")

    print()


def error_handling_example():
    """Example: Error handling."""
    print("=== Error Handling Example ===")

    client = ConfigurationManagerClient.with_api_key(
        "http://localhost:3002/api", 
        "your-api-key"
    )

    # This will trigger various types of errors
    try:
        config = client.configurations.get("non-existent-id")
    except NotFoundError as e:
        print(f"Configuration not found: {e.message}")
    except AuthenticationError as e:
        print(f"Authentication failed: {e.message}")
    except AuthorizationError as e:
        print(f"Access denied: {e.message}")
    except ValidationError as e:
        print(f"Validation error: {e.message}")
    except ConflictError as e:
        print(f"Conflict: {e.message}")
    except RateLimitError as e:
        print(f"Rate limited. Retry after: {e.retry_after}")
    except APIError as e:
        print(f"API error: {e.message} (Status: {e.status_code})")
        if e.error_response:
            print(f"Error details: {e.error_response.get('details')}")
    except NetworkError as e:
        print(f"Network error: {e.message}")
    except TimeoutError as e:
        print(f"Timeout error: {e.message} (Timeout: {e.timeout})")
    except Exception as e:
        print(f"Unknown error: {e}")

    print()


def context_manager_example():
    """Example: Using client as context manager."""
    print("=== Context Manager Example ===")

    # Using client as context manager ensures proper cleanup
    with ConfigurationManagerClient.with_api_key(
        "http://localhost:3002/api", 
        "your-api-key"
    ) as client:
        # Check health
        is_healthy = client.is_healthy()
        print(f"Service healthy: {is_healthy}")

        # Use client services
        try:
            configs = client.configurations.get_all()
            print(f"Found {len(configs.configs)} configurations")
        except Exception as e:
            print(f"Error: {e}")

    # Client is automatically closed when exiting the with block
    print("Client closed automatically")
    print()


def advanced_configuration_example():
    """Example: Advanced client configuration."""
    print("=== Advanced Client Configuration Example ===")

    # Create client with custom options
    from configuration_manager_client.client import ClientOptions
    
    options = ClientOptions(
        base_url="http://localhost:3002/api",
        api_key="your-api-key",
        timeout=60.0,  # 60 seconds timeout
        max_file_size=100 * 1024 * 1024,  # 100MB max file size
        user_agent="my-application/1.0",
        verify_ssl=True,
        max_retries=5,
    )

    client = ConfigurationManagerClient(options)

    try:
        is_healthy = client.is_healthy()
        print(f"Service health with custom client: {is_healthy}")
    except Exception as e:
        print(f"Error with custom client: {e}")
    finally:
        client.close()

    print()


if __name__ == "__main__":
    """Run all examples."""
    print("Configuration Manager Python Client Examples")
    print("=" * 50)

    # Run all examples
    basic_authentication_example()
    configuration_management_example()
    file_management_example()
    user_management_example()
    rules_management_example()
    settings_administration_example()
    error_handling_example()
    context_manager_example()
    advanced_configuration_example()

    print("All examples completed!")
