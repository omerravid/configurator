package configmanager

import (
	"fmt"
	"net/http"
	"time"
)

// ConfigManagerError is the base error type for Configuration Manager client
type ConfigManagerError struct {
	Message    string
	StatusCode int
	ErrorCode  string
	Details    string
}

func (e *ConfigManagerError) Error() string {
	if e.StatusCode > 0 {
		return fmt.Sprintf("Configuration Manager API error %d: %s", e.StatusCode, e.Message)
	}
	return fmt.Sprintf("Configuration Manager error: %s", e.Message)
}

// AuthenticationError represents authentication-related errors
type AuthenticationError struct {
	ConfigManagerError
}

// NewAuthenticationError creates a new authentication error
func NewAuthenticationError(message string, statusCode int) *AuthenticationError {
	return &AuthenticationError{
		ConfigManagerError{
			Message:    message,
			StatusCode: statusCode,
		},
	}
}

// AuthorizationError represents authorization-related errors
type AuthorizationError struct {
	ConfigManagerError
}

// NewAuthorizationError creates a new authorization error
func NewAuthorizationError(message string, statusCode int) *AuthorizationError {
	return &AuthorizationError{
		ConfigManagerError{
			Message:    message,
			StatusCode: statusCode,
		},
	}
}

// ValidationError represents validation-related errors
type ValidationError struct {
	ConfigManagerError
}

// NewValidationError creates a new validation error
func NewValidationError(message string, statusCode int) *ValidationError {
	return &ValidationError{
		ConfigManagerError{
			Message:    message,
			StatusCode: statusCode,
		},
	}
}

// NotFoundError represents resource not found errors
type NotFoundError struct {
	ConfigManagerError
}

// NewNotFoundError creates a new not found error
func NewNotFoundError(message string, statusCode int) *NotFoundError {
	return &NotFoundError{
		ConfigManagerError{
			Message:    message,
			StatusCode: statusCode,
		},
	}
}

// ConflictError represents conflict errors (e.g., duplicate names)
type ConflictError struct {
	ConfigManagerError
}

// NewConflictError creates a new conflict error
func NewConflictError(message string, statusCode int) *ConflictError {
	return &ConflictError{
		ConfigManagerError{
			Message:    message,
			StatusCode: statusCode,
		},
	}
}

// RateLimitError represents rate limiting errors
type RateLimitError struct {
	ConfigManagerError
	RetryAfter *time.Time
}

// NewRateLimitError creates a new rate limit error
func NewRateLimitError(message string, statusCode int, retryAfter *time.Time) *RateLimitError {
	return &RateLimitError{
		ConfigManagerError: ConfigManagerError{
			Message:    message,
			StatusCode: statusCode,
		},
		RetryAfter: retryAfter,
	}
}

// APIError represents general API communication errors
type APIError struct {
	ConfigManagerError
	ErrorResponse *APIErrorResponse
}

// NewAPIError creates a new API error
func NewAPIError(message string, statusCode int, errorResponse *APIErrorResponse) *APIError {
	return &APIError{
		ConfigManagerError: ConfigManagerError{
			Message:    message,
			StatusCode: statusCode,
		},
		ErrorResponse: errorResponse,
	}
}

// HTTPError represents HTTP-level errors
type HTTPError struct {
	ConfigManagerError
	Request  *http.Request
	Response *http.Response
}

// NewHTTPError creates a new HTTP error
func NewHTTPError(message string, req *http.Request, resp *http.Response) *HTTPError {
	statusCode := 0
	if resp != nil {
		statusCode = resp.StatusCode
	}

	return &HTTPError{
		ConfigManagerError: ConfigManagerError{
			Message:    message,
			StatusCode: statusCode,
		},
		Request:  req,
		Response: resp,
	}
}

// NetworkError represents network-level errors
type NetworkError struct {
	ConfigManagerError
	Cause error
}

// NewNetworkError creates a new network error
func NewNetworkError(message string, cause error) *NetworkError {
	return &NetworkError{
		ConfigManagerError: ConfigManagerError{
			Message: message,
		},
		Cause: cause,
	}
}

// TimeoutError represents timeout errors
type TimeoutError struct {
	ConfigManagerError
	Timeout time.Duration
}

// NewTimeoutError creates a new timeout error
func NewTimeoutError(message string, timeout time.Duration) *TimeoutError {
	return &TimeoutError{
		ConfigManagerError: ConfigManagerError{
			Message: message,
		},
		Timeout: timeout,
	}
}
