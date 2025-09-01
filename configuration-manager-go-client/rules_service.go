package configmanager

import (
	"context"
	"fmt"
	"net/url"
	"strconv"
)

// GetAll retrieves rules for a configuration
func (r *RulesService) GetAll(ctx context.Context, options *GetRulesOptions) (*RulesListResponse, error) {
	if options == nil || options.ConfigurationID == "" {
		return nil, NewValidationError("configuration ID is required", 0)
	}

	params := url.Values{}
	params.Set("configurationId", options.ConfigurationID)

	resp, err := r.client.GetWithQuery(ctx, "/rules", params)
	if err != nil {
		return nil, fmt.Errorf("get rules request failed: %w", err)
	}
	defer r.client.CloseResponse(resp)

	var response RulesListResponse
	if err := r.client.DecodeJSON(resp, &response); err != nil {
		return nil, fmt.Errorf("failed to decode rules response: %w", err)
	}

	return &response, nil
}

// Create creates a new rule
func (r *RulesService) Create(ctx context.Context, request *CreateRuleRequest) (*RuleResponse, error) {
	if request == nil {
		return nil, NewValidationError("create rule request cannot be nil", 0)
	}

	if request.ConfigurationID == "" {
		return nil, NewValidationError("configuration ID cannot be empty", 0)
	}

	if request.PropertyPath == "" {
		return nil, NewValidationError("property path cannot be empty", 0)
	}

	resp, err := r.client.Post(ctx, "/rules", request)
	if err != nil {
		return nil, fmt.Errorf("create rule request failed: %w", err)
	}
	defer r.client.CloseResponse(resp)

	var response RuleResponse
	if err := r.client.DecodeJSON(resp, &response); err != nil {
		return nil, fmt.Errorf("failed to decode create rule response: %w", err)
	}

	return &response, nil
}

// Get retrieves a specific rule by ID
func (r *RulesService) Get(ctx context.Context, id string) (*RuleResponse, error) {
	if id == "" {
		return nil, NewValidationError("rule ID cannot be empty", 0)
	}

	path := fmt.Sprintf("/rules/%s", id)
	resp, err := r.client.Get(ctx, path)
	if err != nil {
		return nil, fmt.Errorf("get rule request failed: %w", err)
	}
	defer r.client.CloseResponse(resp)

	var response RuleResponse
	if err := r.client.DecodeJSON(resp, &response); err != nil {
		return nil, fmt.Errorf("failed to decode rule response: %w", err)
	}

	return &response, nil
}

// Update updates an existing rule
func (r *RulesService) Update(ctx context.Context, id string, request *UpdateRuleRequest) (*RuleResponse, error) {
	if id == "" {
		return nil, NewValidationError("rule ID cannot be empty", 0)
	}

	if request == nil {
		return nil, NewValidationError("update rule request cannot be nil", 0)
	}

	path := fmt.Sprintf("/rules/%s", id)
	resp, err := r.client.Put(ctx, path, request)
	if err != nil {
		return nil, fmt.Errorf("update rule request failed: %w", err)
	}
	defer r.client.CloseResponse(resp)

	var response RuleResponse
	if err := r.client.DecodeJSON(resp, &response); err != nil {
		return nil, fmt.Errorf("failed to decode update rule response: %w", err)
	}

	return &response, nil
}

// Delete deletes a rule
func (r *RulesService) Delete(ctx context.Context, id string) error {
	if id == "" {
		return NewValidationError("rule ID cannot be empty", 0)
	}

	path := fmt.Sprintf("/rules/%s", id)
	resp, err := r.client.Delete(ctx, path)
	if err != nil {
		return fmt.Errorf("delete rule request failed: %w", err)
	}
	defer r.client.CloseResponse(resp)

	return nil
}

// Validate validates a value against rules
func (r *RulesService) Validate(ctx context.Context, request *ValidateRuleRequest) (*RuleValidationResponse, error) {
	if request == nil {
		return nil, NewValidationError("validate rule request cannot be nil", 0)
	}

	if request.ConfigurationID == "" {
		return nil, NewValidationError("configuration ID cannot be empty", 0)
	}

	if request.PropertyPath == "" {
		return nil, NewValidationError("property path cannot be empty", 0)
	}

	resp, err := r.client.Post(ctx, "/rules/validate", request)
	if err != nil {
		return nil, fmt.Errorf("validate rule request failed: %w", err)
	}
	defer r.client.CloseResponse(resp)

	var response RuleValidationResponse
	if err := r.client.DecodeJSON(resp, &response); err != nil {
		return nil, fmt.Errorf("failed to decode validate rule response: %w", err)
	}

	return &response, nil
}

// GetForPath gets rules for a specific configuration and path
func (r *RulesService) GetForPath(ctx context.Context, configID, path string, options *GetRulesForPathOptions) (*RulesListResponse, error) {
	if configID == "" {
		return nil, NewValidationError("configuration ID cannot be empty", 0)
	}

	if path == "" {
		return nil, NewValidationError("path cannot be empty", 0)
	}

	// URL encode the path
	encodedPath := url.PathEscape(path)
	endpoint := fmt.Sprintf("/rules/configuration/%s/path/%s", configID, encodedPath)

	params := url.Values{}
	if options != nil && options.IncludeInherited != nil && !*options.IncludeInherited {
		params.Set("includeInherited", "false")
	}

	resp, err := r.client.GetWithQuery(ctx, endpoint, params)
	if err != nil {
		return nil, fmt.Errorf("get rules for path request failed: %w", err)
	}
	defer r.client.CloseResponse(resp)

	var response RulesListResponse
	if err := r.client.DecodeJSON(resp, &response); err != nil {
		return nil, fmt.Errorf("failed to decode rules for path response: %w", err)
	}

	return &response, nil
}
