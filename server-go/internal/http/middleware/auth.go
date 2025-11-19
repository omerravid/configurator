package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"

	"your.module/config-manager/internal/mongo"
	"your.module/config-manager/internal/types"
)

type AuthConfig struct {
	JWTSecret string
	APIKey    string
}

func Auth(authCfg AuthConfig) gin.HandlerFunc {
	return func(c *gin.Context) {
		authz := c.GetHeader("Authorization")
		if strings.HasPrefix(strings.ToLower(authz), "bearer ") {
			tokenStr := strings.TrimSpace(authz[len("Bearer "):])
			claims := jwt.MapClaims{}
			token, err := jwt.ParseWithClaims(tokenStr, claims, func(token *jwt.Token) (interface{}, error) {
				return []byte(authCfg.JWTSecret), nil
			})
			if err == nil && token.Valid {
				c.Set("user", claims)
				c.Next()
				return
			}
		}
		if apiKey := c.GetHeader("X-API-Key"); apiKey != "" && apiKey == authCfg.APIKey {
			c.Set("user", map[string]any{
				"username": "api-service",
				"role":     "ADMIN",
				"isApiKey": true,
			})
			c.Next()
			return
		}
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
			"error": "Authentication required. Provide either Authorization Bearer token or X-API-Key header",
		})
	}
}

func RequireAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		v, ok := c.Get("user")
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "Authentication required",
				"debug": "user not found in context",
			})
			return
		}
		
		m, ok := v.(map[string]any)
		if !ok {
			// Try jwt.MapClaims
			if claims, ok := v.(jwt.MapClaims); ok {
				m = map[string]any(claims)
			} else {
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
					"error": "Invalid user context",
					"debug": "failed to convert user context",
				})
				return
			}
		}
		
		role, ok := m["role"].(string)
		if !ok || role != "ADMIN" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error": "Admin access required",
				"debug": gin.H{
					"roleValue": m["role"],
					"roleOk":    ok,
					"roleStr":   role,
					"userMap":   m,
				},
			})
			return
		}
		c.Next()
	}
}

// CheckConfigPermissions - middleware to check if user can modify a configuration
// Implements the same logic as Node's checkConfigPermissions
func CheckConfigPermissions(db *mongo.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		configID := c.Param("id")
		oid, err := primitive.ObjectIDFromHex(configID)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "Invalid configuration ID"})
			return
		}

		// Fetch the configuration
		var config types.Configuration
		err = db.Configurations.FindOne(c, bson.M{"_id": oid}).Decode(&config)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusNotFound, gin.H{"error": "Configuration not found"})
			return
		}

		// Store config in context for handler use
		c.Set("config", config)

		// Get user from context
		userClaims, ok := c.Get("user")
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
			return
		}
		
		// Handle jwt.MapClaims (same pattern as RequireAdmin)
		var userMap map[string]any
		userMap, ok = userClaims.(map[string]any)
		if !ok {
			// Try jwt.MapClaims
			if jwtClaims, ok := userClaims.(jwt.MapClaims); ok {
				userMap = map[string]any(jwtClaims)
			} else {
				c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Invalid user context"})
				return
			}
		}
		
		userRole, _ := userMap["role"].(string)
		username, _ := userMap["username"].(string)

		// Admin can do anything
		if userRole == "ADMIN" {
			c.Next()
			return
		}

		// Non-admin users cannot modify PRODUCT/INSTANCE/COMPONENT configs
		if config.Type == types.ConfigProduct ||
			config.Type == types.ConfigInstance ||
			config.Type == types.ConfigComponent {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error": "Only admins can modify Product/Instance/Component configurations",
			})
			return
		}

		// For USER and VERSION configs, check ownership
		if config.Type == types.ConfigUser || config.Type == types.ConfigVersion {
			if config.CreatedBy != username {
				c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
					"error": "You can only modify your own configurations",
				})
				return
			}

			// Special handling for commit operations - allow committing DRAFT configurations
			if strings.Contains(c.Request.URL.Path, "/commit") {
				if config.Status != types.StatusDraft {
					c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
						"error": "Can only commit DRAFT configurations",
					})
					return
				}
				c.Next()
				return
			}

			// Cannot modify COMMITTED configurations (except commit operation handled above)
			if c.Request.Method != "GET" && config.Status == types.StatusCommitted {
				c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
					"error": "Cannot modify committed configurations",
				})
				return
			}
		}

		c.Next()
	}
}
