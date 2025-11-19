package fixtures

import (
	"time"

	"golang.org/x/crypto/bcrypt"

	"your.module/config-manager/internal/types"
)

// AdminUser returns a test admin user
func AdminUser() types.User {
	hash, _ := bcrypt.GenerateFromPassword([]byte("admin123"), bcrypt.DefaultCost)
	return types.User{
		ID:           "admin-id-123",
		Username:     "admin",
		PasswordHash: string(hash),
		Role:         types.RoleAdmin,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}
}

// RegularUser returns a test regular user
func RegularUser() types.User {
	hash, _ := bcrypt.GenerateFromPassword([]byte("user123"), bcrypt.DefaultCost)
	return types.User{
		ID:           "user-id-456",
		Username:     "testuser",
		PasswordHash: string(hash),
		Role:         types.RoleUser,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}
}

// LoginRequest returns a valid login request
func LoginRequest(username, password string) types.LoginRequest {
	return types.LoginRequest{
		Username: username,
		Password: password,
	}
}

// RegisterRequest returns a valid register request
func RegisterRequest(username, password string, role types.Role) types.RegisterRequest {
	return types.RegisterRequest{
		Username: username,
		Password: password,
		Role:     role,
	}
}

