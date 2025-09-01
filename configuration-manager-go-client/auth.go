package configmanager

import "time"

// LoginRequest represents login request payload
type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// RegisterRequest represents user registration request
type RegisterRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
	Role     string `json:"role,omitempty"`
}

// User represents user information
type User struct {
	ID        string    `json:"id"`
	Username  string    `json:"username"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// AuthResponse represents authentication response
type AuthResponse struct {
	Token   string `json:"token"`
	User    User   `json:"user"`
	Message string `json:"message,omitempty"`
}

// CurrentUserResponse represents current user response
type CurrentUserResponse struct {
	User User `json:"user"`
}

// TokenRefreshResponse represents token refresh response
type TokenRefreshResponse struct {
	Token string `json:"token"`
}

// AuthService provides authentication operations
type AuthService struct {
	client *HTTPClient
}

// NewAuthService creates a new authentication service
func NewAuthService(client *HTTPClient) *AuthService {
	return &AuthService{client: client}
}
