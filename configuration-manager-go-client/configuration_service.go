package configmanager

import (
	"context"
	"fmt"
	"net/url"
	"strconv"
)

// GetAll retrieves all configurations with optional filtering
func (c *ConfigurationService) GetAll(ctx context.Context, options *GetConfigurationsOptions) (*ConfigurationListResponse, error) {
	params := url.Values{}

	if options != nil {
		if options.Type != nil {
			params.Set("type", string(*options.Type))
		}
		if options.Status != nil {
			params.Set("status", string(*options.Status))
		}
		if options.IncludeArchived != nil {
			params.Set("includeArchived", strconv.FormatBool(*options.IncludeArchived))
		}
	}

	resp, err := c.client.GetWithQuery(ctx, "configs", params)
	if err != nil {
		return nil, fmt.Errorf("get configurations request failed: %w", err)
	}
	defer c.client.CloseResponse(resp)

	var response ConfigurationListResponse
	if err := c.client.DecodeJSON(resp, &response); err != nil {
		return nil, fmt.Errorf("failed to decode configurations response: %w", err)
	}

	return &response, nil
}

// Get retrieves a specific configuration by ID
func (c *ConfigurationService) Get(ctx context.Context, id string, options *GetConfigurationOptions) (*ResolvedConfigurationResponse, error) {
	if id == "" {
		return nil, NewValidationError("configuration ID cannot be empty", 0)
	}

	params := url.Values{}
	if options != nil {
		if options.Provenance != nil && *options.Provenance {
			params.Set("provenance", "true")
		}
		if options.Raw != nil && *options.Raw {
			params.Set("raw", "true")
		}
	}

	path := fmt.Sprintf("configs/%s", id)
	resp, err := c.client.GetWithQuery(ctx, path, params)
	if err != nil {
		return nil, fmt.Errorf("get configuration request failed: %w", err)
	}
	defer c.client.CloseResponse(resp)

	var response ResolvedConfigurationResponse
	if err := c.client.DecodeJSON(resp, &response); err != nil {
		return nil, fmt.Errorf("failed to decode configuration response: %w", err)
	}

	return &response, nil
}

// Create creates a new configuration
func (c *ConfigurationService) Create(ctx context.Context, request *CreateConfigurationRequest) (*ConfigurationResponse, error) {
	if request == nil {
		return nil, NewValidationError("create request cannot be nil", 0)
	}

	if request.Name == "" {
		return nil, NewValidationError("configuration name cannot be empty", 0)
	}

	resp, err := c.client.Post(ctx, "configs", request)
	if err != nil {
		return nil, fmt.Errorf("create configuration request failed: %w", err)
	}
	defer c.client.CloseResponse(resp)

	var response ConfigurationResponse
	if err := c.client.DecodeJSON(resp, &response); err != nil {
		return nil, fmt.Errorf("failed to decode create configuration response: %w", err)
	}

	return &response, nil
}

// Update updates an existing configuration
func (c *ConfigurationService) Update(ctx context.Context, id string, request *UpdateConfigurationRequest) (*ConfigurationResponse, error) {
	if id == "" {
		return nil, NewValidationError("configuration ID cannot be empty", 0)
	}

	if request == nil {
		return nil, NewValidationError("update request cannot be nil", 0)
	}

	path := fmt.Sprintf("configs/%s", id)
	resp, err := c.client.Put(ctx, path, request)
	if err != nil {
		return nil, fmt.Errorf("update configuration request failed: %w", err)
	}
	defer c.client.CloseResponse(resp)

	var response ConfigurationResponse
	if err := c.client.DecodeJSON(resp, &response); err != nil {
		return nil, fmt.Errorf("failed to decode update configuration response: %w", err)
	}

	return &response, nil
}

// Delete deletes a configuration
func (c *ConfigurationService) Delete(ctx context.Context, id string) (*ConfigurationResponse, error) {
	if id == "" {
		return nil, NewValidationError("configuration ID cannot be empty", 0)
	}

	path := fmt.Sprintf("configs/%s", id)
	resp, err := c.client.Delete(ctx, path)
	if err != nil {
		return nil, fmt.Errorf("delete configuration request failed: %w", err)
	}
	defer c.client.CloseResponse(resp)

	var response ConfigurationResponse
	if err := c.client.DecodeJSON(resp, &response); err != nil {
		return nil, fmt.Errorf("failed to decode delete configuration response: %w", err)
	}

	return &response, nil
}

// GetValue gets configuration data at a specific path
func (c *ConfigurationService) GetValue(ctx context.Context, id string, options *GetConfigurationValueOptions) (*ConfigurationValueResponse, error) {
	if id == "" {
		return nil, NewValidationError("configuration ID cannot be empty", 0)
	}

	params := url.Values{}
	if options != nil {
		if options.Path != nil {
			params.Set("path", *options.Path)
		}
		if options.Minimal != nil && *options.Minimal {
			params.Set("minimal", "true")
		}
	}

	path := fmt.Sprintf("configs/%s/data", id)
	resp, err := c.client.GetWithQuery(ctx, path, params)
	if err != nil {
		return nil, fmt.Errorf("get configuration value request failed: %w", err)
	}
	defer c.client.CloseResponse(resp)

	var response ConfigurationValueResponse
	if err := c.client.DecodeJSON(resp, &response); err != nil {
		return nil, fmt.Errorf("failed to decode configuration value response: %w", err)
	}

	return &response, nil
}

// GetValueByName gets configuration data at a specific path by configuration name
func (c *ConfigurationService) GetValueByName(ctx context.Context, configurationName string, options *GetConfigurationValueOptions) (*ConfigurationValueResponse, error) {
	if configurationName == "" {
		return nil, NewValidationError("configuration name cannot be empty", 0)
	}

	params := url.Values{}
	if options != nil {
		if options.Path != nil {
			params.Set("path", *options.Path)
		}
		if options.Minimal != nil && *options.Minimal {
			params.Set("minimal", "true")
		}
	}

	path := fmt.Sprintf("configs/by-name/%s/data", url.PathEscape(configurationName))
	resp, err := c.client.GetWithQuery(ctx, path, params)
	if err != nil {
		return nil, fmt.Errorf("get configuration value by name request failed: %w", err)
	}
	defer c.client.CloseResponse(resp)

	var response ConfigurationValueResponse
	if err := c.client.DecodeJSON(resp, &response); err != nil {
		return nil, fmt.Errorf("failed to decode configuration value by name response: %w", err)
	}

	return &response, nil
}

// Commit commits a draft configuration
func (c *ConfigurationService) Commit(ctx context.Context, id string) (*ConfigurationResponse, error) {
	if id == "" {
		return nil, NewValidationError("configuration ID cannot be empty", 0)
	}

	path := fmt.Sprintf("configs/%s/commit", id)
	resp, err := c.client.Post(ctx, path, nil)
	if err != nil {
		return nil, fmt.Errorf("commit configuration request failed: %w", err)
	}
	defer c.client.CloseResponse(resp)

	var response ConfigurationResponse
	if err := c.client.DecodeJSON(resp, &response); err != nil {
		return nil, fmt.Errorf("failed to decode commit configuration response: %w", err)
	}

	return &response, nil
}

// GetChildren gets child configurations
func (c *ConfigurationService) GetChildren(ctx context.Context, id string, options *GetChildConfigurationsOptions) (*ChildrenConfigurationResponse, error) {
	if id == "" {
		return nil, NewValidationError("configuration ID cannot be empty", 0)
	}

	params := url.Values{}
	if options != nil && options.IncludeArchived != nil && *options.IncludeArchived {
		params.Set("includeArchived", "true")
	}

	path := fmt.Sprintf("configs/%s/children", id)
	resp, err := c.client.GetWithQuery(ctx, path, params)
	if err != nil {
		return nil, fmt.Errorf("get child configurations request failed: %w", err)
	}
	defer c.client.CloseResponse(resp)

	var response ChildrenConfigurationResponse
	if err := c.client.DecodeJSON(resp, &response); err != nil {
		return nil, fmt.Errorf("failed to decode child configurations response: %w", err)
	}

	return &response, nil
}

// GetComponents gets all components with their versions
func (c *ConfigurationService) GetComponents(ctx context.Context) (*ComponentsResponse, error) {
	resp, err := c.client.Get(ctx, "configs/components")
	if err != nil {
		return nil, fmt.Errorf("get components request failed: %w", err)
	}
	defer c.client.CloseResponse(resp)

	var response ComponentsResponse
	if err := c.client.DecodeJSON(resp, &response); err != nil {
		return nil, fmt.Errorf("failed to decode components response: %w", err)
	}

	return &response, nil
}

// Rename renames a configuration (admin only)
func (c *ConfigurationService) Rename(ctx context.Context, id, newName string) (*ConfigurationResponse, error) {
	if id == "" {
		return nil, NewValidationError("configuration ID cannot be empty", 0)
	}

	if newName == "" {
		return nil, NewValidationError("new name cannot be empty", 0)
	}

	request := &RenameConfigurationRequest{Name: newName}

	path := fmt.Sprintf("configs/%s/rename", id)
	resp, err := c.client.Put(ctx, path, request)
	if err != nil {
		return nil, fmt.Errorf("rename configuration request failed: %w", err)
	}
	defer c.client.CloseResponse(resp)

	var response ConfigurationResponse
	if err := c.client.DecodeJSON(resp, &response); err != nil {
		return nil, fmt.Errorf("failed to decode rename configuration response: %w", err)
	}

	return &response, nil
}

// Archive archives a configuration (admin only)
func (c *ConfigurationService) Archive(ctx context.Context, id string, archiveChildren *bool) (*ConfigurationResponse, error) {
	if id == "" {
		return nil, NewValidationError("configuration ID cannot be empty", 0)
	}

	request := &ArchiveConfigurationRequest{}
	if archiveChildren != nil {
		request.ArchiveChildren = archiveChildren
	}

	path := fmt.Sprintf("configs/%s/archive", id)
	resp, err := c.client.Post(ctx, path, request)
	if err != nil {
		return nil, fmt.Errorf("archive configuration request failed: %w", err)
	}
	defer c.client.CloseResponse(resp)

	var response ConfigurationResponse
	if err := c.client.DecodeJSON(resp, &response); err != nil {
		return nil, fmt.Errorf("failed to decode archive configuration response: %w", err)
	}

	return &response, nil
}

// Restore restores an archived configuration (admin only)
func (c *ConfigurationService) Restore(ctx context.Context, id string) (*ConfigurationResponse, error) {
	if id == "" {
		return nil, NewValidationError("configuration ID cannot be empty", 0)
	}

	path := fmt.Sprintf("configs/%s/restore", id)
	resp, err := c.client.Post(ctx, path, nil)
	if err != nil {
		return nil, fmt.Errorf("restore configuration request failed: %w", err)
	}
	defer c.client.CloseResponse(resp)

	var response ConfigurationResponse
	if err := c.client.DecodeJSON(resp, &response); err != nil {
		return nil, fmt.Errorf("failed to decode restore configuration response: %w", err)
	}

	return &response, nil
}
