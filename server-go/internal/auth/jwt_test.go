package auth

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Example of simple unit test without mocks using Arrange-Act-Assert pattern
func TestGenerateToken_ValidInputs_ReturnsValidToken(t *testing.T) {
	// Arrange
	secret := "test-secret"
	userID := "user123"
	username := "testuser"
	role := "USER"
	ttl := 24 * time.Hour

	// Act
	tokenString, err := GenerateToken(secret, userID, username, role, ttl)

	// Assert
	require.NoError(t, err, "Token generation should not return an error")
	assert.NotEmpty(t, tokenString, "Token should not be empty")

	// Verify token can be parsed and contains correct claims
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		return []byte(secret), nil
	})

	require.NoError(t, err, "Token should be parseable")
	assert.True(t, token.Valid, "Token should be valid")

	claims, ok := token.Claims.(*Claims)
	require.True(t, ok, "Claims should be of correct type")
	assert.Equal(t, userID, claims.UserID, "UserID should match")
	assert.Equal(t, username, claims.Username, "Username should match")
	assert.Equal(t, role, claims.Role, "Role should match")
}

// Example of table-driven test
func TestGenerateToken_DifferentTTLs_SetsCorrectExpiration(t *testing.T) {
	tests := []struct {
		name string
		ttl  time.Duration
	}{
		{"1 hour", 1 * time.Hour},
		{"24 hours", 24 * time.Hour},
		{"7 days", 7 * 24 * time.Hour},
		{"30 days", 30 * 24 * time.Hour},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Arrange
			secret := "test-secret"
			userID := "user123"
			username := "testuser"
			role := "USER"
			beforeGeneration := time.Now()

			// Act
			tokenString, err := GenerateToken(secret, userID, username, role, tt.ttl)

			// Assert
			require.NoError(t, err)

			token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
				return []byte(secret), nil
			})
			require.NoError(t, err)

			claims := token.Claims.(*Claims)
			
			expectedExpiration := beforeGeneration.Add(tt.ttl)
			actualExpiration := claims.ExpiresAt.Time

			// Allow 1 second variance for test execution time
			timeDiff := actualExpiration.Sub(expectedExpiration)
			assert.True(t, timeDiff < time.Second && timeDiff > -time.Second,
				"Expiration time should be approximately correct (within 1 second)")
		})
	}
}

func TestGenerateToken_DifferentRoles_EncodesCorrectly(t *testing.T) {
	// Example of testing multiple scenarios with table-driven approach
	tests := []struct {
		name string
		role string
	}{
		{"Admin role", "ADMIN"},
		{"User role", "USER"},
	}

	secret := "test-secret"

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Arrange & Act
			tokenString, err := GenerateToken(secret, "user123", "testuser", tt.role, 1*time.Hour)

			// Assert
			require.NoError(t, err)
			
			token, _ := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
				return []byte(secret), nil
			})
			
			claims := token.Claims.(*Claims)
			assert.Equal(t, tt.role, claims.Role)
		})
	}
}

func TestGenerateToken_CheckIssuedAt_SetToCurrentTime(t *testing.T) {
	// Arrange
	secret := "test-secret"
	beforeGeneration := time.Now().Add(-1 * time.Second) // Allow 1 second tolerance

	// Act
	tokenString, err := GenerateToken(secret, "user123", "testuser", "USER", 1*time.Hour)

	// Assert
	require.NoError(t, err)
	afterGeneration := time.Now().Add(1 * time.Second) // Allow 1 second tolerance

	token, _ := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		return []byte(secret), nil
	})
	
	claims := token.Claims.(*Claims)
	issuedAt := claims.IssuedAt.Time

	assert.True(t, issuedAt.After(beforeGeneration) && issuedAt.Before(afterGeneration),
		"IssuedAt should be at or after token generation started")
	assert.True(t, issuedAt.Before(afterGeneration) || issuedAt.Equal(afterGeneration),
		"IssuedAt should be at or before token generation completed")
}

func TestGenerateToken_EmptySecret_StillGeneratesToken(t *testing.T) {
	// This tests edge case - tokens can be generated with empty secrets
	// (though they're insecure)
	
	// Arrange
	secret := ""
	
	// Act
	tokenString, err := GenerateToken(secret, "user123", "testuser", "USER", 1*time.Hour)
	
	// Assert
	require.NoError(t, err, "Should generate token even with empty secret")
	assert.NotEmpty(t, tokenString)
}

func TestGenerateToken_ZeroTTL_SetsImmediateExpiration(t *testing.T) {
	// Arrange
	secret := "test-secret"
	beforeGeneration := time.Now()
	
	// Act
	tokenString, err := GenerateToken(secret, "user123", "testuser", "USER", 0)
	
	// Assert
	require.NoError(t, err)
	
	token, _ := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		return []byte(secret), nil
	})
	
	claims := token.Claims.(*Claims)
	expiration := claims.ExpiresAt.Time
	
	// Expiration should be approximately equal to generation time
	timeDiff := expiration.Sub(beforeGeneration)
	assert.True(t, timeDiff < time.Second && timeDiff > -time.Second,
		"Zero TTL should result in immediate expiration")
}

