package middleware

import (
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"

	"your.module/config-manager/internal/logger"
)

// RequestLogging creates middleware that logs HTTP requests with structured fields
func RequestLogging(log *logger.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Generate unique request ID
		requestID := uuid.New().String()
		c.Set("requestId", requestID)

		// Extract user info from context if available (set by auth middleware)
		var userID, username string
		if user, exists := c.Get("user"); exists {
			if userMap, ok := user.(map[string]any); ok {
				if id, ok := userMap["id"].(string); ok {
					userID = id
				}
				if name, ok := userMap["username"].(string); ok {
					username = name
				}
			}
		}

		// Store user info in context for logger
		if userID != "" {
			c.Set("userId", userID)
		}
		if username != "" {
			c.Set("username", username)
		}

		// Start timer
		start := time.Now()
		path := c.Request.URL.Path
		method := c.Request.Method

		// Log incoming request
		log.InfoCtx(c.Request.Context(),
			"Incoming request",
			logger.String("requestId", requestID),
			logger.String("method", method),
			logger.String("path", path),
			logger.String("clientIP", c.ClientIP()),
			logger.String("userId", userID),
			logger.String("username", username),
		)

		// Process request
		c.Next()

		// Calculate duration
		duration := time.Since(start)

		// Log response
		statusCode := c.Writer.Status()
		logMsg := "Request completed"

		// Build log fields
		fields := []zap.Field{
			logger.String("requestId", requestID),
			logger.String("method", method),
			logger.String("path", path),
			logger.Int("status", statusCode),
			logger.Duration("duration", duration),
			logger.String("clientIP", c.ClientIP()),
		}

		if userID != "" {
			fields = append(fields, logger.String("userId", userID))
		}
		if username != "" {
			fields = append(fields, logger.String("username", username))
		}

		// Add error if present
		if len(c.Errors) > 0 {
			fields = append(fields, logger.String("error", c.Errors.String()))
		}

		// Use different log levels based on status code
		if statusCode >= 500 {
			log.ErrorCtx(c.Request.Context(), "Request failed with server error", fields...)
		} else if statusCode >= 400 {
			log.WarnCtx(c.Request.Context(), "Request failed with client error", fields...)
		} else {
			log.InfoCtx(c.Request.Context(), logMsg, fields...)
		}
	}
}

