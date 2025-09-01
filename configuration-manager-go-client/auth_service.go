package configmanager

import (
	"context"
	"fmt"
)

// Login authenticates with username and password
func (a *AuthService) Login(ctx context.Context, username, password string) (*AuthResponse, error) {
	if username == "" {
		return nil, NewValidationError("username cannot be empty", 0)
	}

	if password == "" {
		return nil, NewValidationError("password cannot be empty", 0)
	}

	request := &LoginRequest{
		Username: username,
		Password: password,
	}

	resp, err := a.client.Post(ctx, "/auth/login", request)
	if err != nil {
		return nil, fmt.Errorf("login request failed: %w", err)
	}
	defer a.client.CloseResponse(resp)

	var authResponse AuthResponse
	if err := a.client.DecodeJSON(resp, &authResponse); err != nil {
		return nil, fmt.Errorf("failed to decode login response: %w", err)
	}

	// Update the client with the new token
	if authResponse.Token != "" {
		a.client.SetJWTToken(authResponse.Token)
	}

	return &authResponse, nil
}

// Register creates a new user account
func (a *AuthService) Register(ctx context.Context, username, password string, role *string) (*AuthResponse, error) {
	if username == "" {
		return nil, NewValidationError("username cannot be empty", 0)
	}

	if password == "" {
		return nil, NewValidationError("password cannot be empty", 0)
	}

	request := &RegisterRequest{
		Username: username,
		Password: password,
	}

	if role != nil {
		if *role != "USER" && *role != "ADMIN" {
			return nil, NewValidationError("role must be either 'USER' or 'ADMIN'", 0)
		}
		request.Role = *role
	}

	resp, err := a.client.Post(ctx, "/auth/register", request)
	if err != nil {
		return nil, fmt.Errorf("register request failed: %w", err)
	}
	defer a.client.CloseResponse(resp)

	var authResponse AuthResponse
	if err := a.client.DecodeJSON(resp, &authResponse); err != nil {
		return nil, fmt.Errorf("failed to decode register response: %w", err)
	}

	// Update the client with the new token
	if authResponse.Token != "" {
		a.client.SetJWTToken(authResponse.Token)
	}

	return &authResponse, nil
}

// GetCurrentUser retrieves the current authenticated user information
func (a *AuthService) GetCurrentUser(ctx context.Context) (*CurrentUserResponse, error) {
	resp, err := a.client.Get(ctx, "/auth/me")
	if err != nil {
		return nil, fmt.Errorf("get current user request failed: %w", err)
	}
	defer a.client.CloseResponse(resp)

	var userResponse CurrentUserResponse
	if err := a.client.DecodeJSON(resp, &userResponse); err != nil {
		return nil, fmt.Errorf("failed to decode current user response: %w", err)
	}

	return &userResponse, nil
}

// RefreshToken refreshes the JWT token
func (a *AuthService) RefreshToken(ctx context.Context) (*TokenRefreshResponse, error) {
	resp, err := a.client.Post(ctx, "/auth/refresh", nil)
	if err != nil {
		return nil, fmt.Errorf("refresh token request failed: %w", err)
	}
	defer a.client.CloseResponse(resp)

	var refreshResponse TokenRefreshResponse
	if err := a.client.DecodeJSON(resp, &refreshResponse); err != nil {
		return nil, fmt.Errorf("failed to decode refresh token response: %w", err)
	}

	// Update the client with the new token
	if refreshResponse.Token != "" {
		a.client.SetJWTToken(refreshResponse.Token)
	}

	return &refreshResponse, nil
}

// SetJWTToken updates the client's JWT token
func (a *AuthService) SetJWTToken(token string) {
	if token == "" {
		return
	}
	a.client.SetJWTToken(token)
}
