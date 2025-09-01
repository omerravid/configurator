package configmanager

import (
	"context"
	"fmt"
)

// GetAll retrieves all users (admin only)
func (u *UserService) GetAll(ctx context.Context) (*UsersListResponse, error) {
	resp, err := u.client.Get(ctx, "/users")
	if err != nil {
		return nil, fmt.Errorf("get users request failed: %w", err)
	}
	defer u.client.CloseResponse(resp)

	var response UsersListResponse
	if err := u.client.DecodeJSON(resp, &response); err != nil {
		return nil, fmt.Errorf("failed to decode users response: %w", err)
	}

	return &response, nil
}

// Get retrieves a specific user by ID
func (u *UserService) Get(ctx context.Context, id string) (*UserResponse, error) {
	if id == "" {
		return nil, NewValidationError("user ID cannot be empty", 0)
	}

	path := fmt.Sprintf("/users/%s", id)
	resp, err := u.client.Get(ctx, path)
	if err != nil {
		return nil, fmt.Errorf("get user request failed: %w", err)
	}
	defer u.client.CloseResponse(resp)

	var response UserResponse
	if err := u.client.DecodeJSON(resp, &response); err != nil {
		return nil, fmt.Errorf("failed to decode user response: %w", err)
	}

	return &response, nil
}

// UpdateRole updates user role (admin only)
func (u *UserService) UpdateRole(ctx context.Context, id, role string) (*UserRoleUpdateResponse, error) {
	if id == "" {
		return nil, NewValidationError("user ID cannot be empty", 0)
	}

	if role == "" {
		return nil, NewValidationError("role cannot be empty", 0)
	}

	if role != "USER" && role != "ADMIN" {
		return nil, NewValidationError("role must be either 'USER' or 'ADMIN'", 0)
	}

	request := &UpdateUserRoleRequest{Role: role}

	path := fmt.Sprintf("/users/%s/role", id)
	resp, err := u.client.Put(ctx, path, request)
	if err != nil {
		return nil, fmt.Errorf("update user role request failed: %w", err)
	}
	defer u.client.CloseResponse(resp)

	var response UserRoleUpdateResponse
	if err := u.client.DecodeJSON(resp, &response); err != nil {
		return nil, fmt.Errorf("failed to decode update user role response: %w", err)
	}

	return &response, nil
}

// Delete deletes a user (admin only)
func (u *UserService) Delete(ctx context.Context, id string) (*UserDeletionResponse, error) {
	if id == "" {
		return nil, NewValidationError("user ID cannot be empty", 0)
	}

	path := fmt.Sprintf("/users/%s", id)
	resp, err := u.client.Delete(ctx, path)
	if err != nil {
		return nil, fmt.Errorf("delete user request failed: %w", err)
	}
	defer u.client.CloseResponse(resp)

	var response UserDeletionResponse
	if err := u.client.DecodeJSON(resp, &response); err != nil {
		return nil, fmt.Errorf("failed to decode delete user response: %w", err)
	}

	return &response, nil
}

// GetConfigurations gets configurations created by a user
func (u *UserService) GetConfigurations(ctx context.Context, id string) (*UserConfigurationsResponse, error) {
	if id == "" {
		return nil, NewValidationError("user ID cannot be empty", 0)
	}

	path := fmt.Sprintf("/users/%s/configurations", id)
	resp, err := u.client.Get(ctx, path)
	if err != nil {
		return nil, fmt.Errorf("get user configurations request failed: %w", err)
	}
	defer u.client.CloseResponse(resp)

	var response UserConfigurationsResponse
	if err := u.client.DecodeJSON(resp, &response); err != nil {
		return nil, fmt.Errorf("failed to decode user configurations response: %w", err)
	}

	return &response, nil
}
