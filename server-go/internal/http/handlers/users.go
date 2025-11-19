package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"

	"your.module/config-manager/internal/logger"
	"your.module/config-manager/internal/mongo"
	"your.module/config-manager/internal/types"
)

type UsersHandler struct {
	db  *mongo.Client
	log *logger.Logger
}

func NewUsersHandler(db *mongo.Client, log *logger.Logger) *UsersHandler {
	return &UsersHandler{db: db, log: log}
}

func (h *UsersHandler) Register(api *gin.RouterGroup, requireAdmin gin.HandlerFunc) {
	users := api.Group("/users", requireAdmin)
	{
		users.GET("", h.listUsers)
		users.GET("/:id", h.getUser)
		users.PUT("/:id/role", h.updateUserRole)
		users.DELETE("/:id", h.deleteUser)
		users.GET("/:id/configurations", h.getUserConfigurations)
	}
}

// GET /api/users - List all users (admin only)
func (h *UsersHandler) listUsers(c *gin.Context) {
	ctx := c.Request.Context()
	h.log.InfoCtx(ctx, "Listing all users")
	
	cursor, err := h.db.Users.Find(c, bson.M{})
	if err != nil {
		h.log.ErrorCtx(ctx, "Failed to fetch users from database",
			logger.Error(err),
		)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch users"})
		return
	}
	defer cursor.Close(c)

	var users []types.User
	if err := cursor.All(c, &users); err != nil {
		h.log.ErrorCtx(ctx, "Failed to decode users",
			logger.Error(err),
		)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode users"})
		return
	}

	h.log.InfoCtx(ctx, "Users listed successfully",
		logger.Int("count", len(users)),
	)
	c.JSON(http.StatusOK, gin.H{"users": users})
}

// GET /api/users/:id - Get user by ID
func (h *UsersHandler) getUser(c *gin.Context) {
	ctx := c.Request.Context()
	id := c.Param("id")
	
	h.log.InfoCtx(ctx, "Getting user by ID",
		logger.String("userId", id),
	)
	
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		h.log.WarnCtx(ctx, "Invalid user ID format",
			logger.String("userId", id),
			logger.Error(err),
		)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	var user types.User
	err = h.db.Users.FindOne(c, bson.M{"_id": oid}).Decode(&user)
	if err != nil {
		h.log.WarnCtx(ctx, "User not found",
			logger.String("userId", id),
		)
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	h.log.InfoCtx(ctx, "User retrieved successfully",
		logger.String("userId", id),
		logger.String("username", user.Username),
	)
	c.JSON(http.StatusOK, gin.H{"user": user})
}

// PUT /api/users/:id/role - Update user role (admin only)
func (h *UsersHandler) updateUserRole(c *gin.Context) {
	ctx := c.Request.Context()
	id := c.Param("id")
	
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		h.log.WarnCtx(ctx, "Invalid user ID format for role update",
			logger.String("userId", id),
			logger.Error(err),
		)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	var req struct {
		Role types.Role `json:"role" validate:"required,oneof=ADMIN USER"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		h.log.WarnCtx(ctx, "Invalid role update request",
			logger.String("userId", id),
			logger.Error(err),
		)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request. Role must be ADMIN or USER"})
		return
	}

	h.log.InfoCtx(ctx, "Updating user role",
		logger.String("userId", id),
		logger.String("newRole", string(req.Role)),
	)

	// Update user role
	update := bson.M{
		"$set": bson.M{
			"role":       req.Role,
			"updated_at": time.Now(),
		},
	}

	result, err := h.db.Users.UpdateOne(c, bson.M{"_id": oid}, update)
	if err != nil {
		h.log.ErrorCtx(ctx, "Failed to update user role",
			logger.String("userId", id),
			logger.Error(err),
		)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user role"})
		return
	}

	if result.MatchedCount == 0 {
		h.log.WarnCtx(ctx, "User not found for role update",
			logger.String("userId", id),
		)
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	h.log.InfoCtx(ctx, "User role updated successfully",
		logger.String("userId", id),
		logger.String("newRole", string(req.Role)),
	)

	c.JSON(http.StatusOK, gin.H{
		"message": "User role updated successfully",
		"role":    req.Role,
	})
}

// DELETE /api/users/:id - Delete user (admin only, prevent self-delete)
func (h *UsersHandler) deleteUser(c *gin.Context) {
	ctx := c.Request.Context()
	id := c.Param("id")
	
	h.log.InfoCtx(ctx, "Deleting user",
		logger.String("targetUserId", id),
	)
	
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		h.log.WarnCtx(ctx, "Invalid user ID format for deletion",
			logger.String("userId", id),
			logger.Error(err),
		)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	// Get current user from context
	claims, exists := c.Get("user")
	if !exists {
		h.log.ErrorCtx(ctx, "User context not found for deletion")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User context not found"})
		return
	}

	// Convert to map[string]any (same pattern as RequireAdmin middleware)
	var claimsMap map[string]any
	claimsMap, ok := claims.(map[string]any)
	if !ok {
		// Try jwt.MapClaims
		if jwtClaims, ok := claims.(jwt.MapClaims); ok {
			claimsMap = map[string]any(jwtClaims)
		} else {
			h.log.ErrorCtx(ctx, "Invalid user context type for deletion")
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user context type"})
			return
		}
	}

	currentUserID, _ := claimsMap["userId"].(string)

	// Prevent self-deletion
	if currentUserID == id {
		h.log.WarnCtx(ctx, "Attempted self-deletion",
			logger.String("userId", id),
		)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot delete your own account"})
		return
	}

	result, err := h.db.Users.DeleteOne(c, bson.M{"_id": oid})
	if err != nil {
		h.log.ErrorCtx(ctx, "Failed to delete user",
			logger.String("userId", id),
			logger.Error(err),
		)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete user"})
		return
	}

	if result.DeletedCount == 0 {
		h.log.WarnCtx(ctx, "User not found for deletion",
			logger.String("userId", id),
		)
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	h.log.InfoCtx(ctx, "User deleted successfully",
		logger.String("userId", id),
		logger.String("deletedBy", currentUserID),
	)

	c.JSON(http.StatusOK, gin.H{"message": "User deleted successfully"})
}

// GET /api/users/:id/configurations - Get user's configurations
func (h *UsersHandler) getUserConfigurations(c *gin.Context) {
	ctx := c.Request.Context()
	id := c.Param("id")
	
	h.log.InfoCtx(ctx, "Getting user configurations",
		logger.String("userId", id),
	)
	
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		h.log.WarnCtx(ctx, "Invalid user ID format",
			logger.String("userId", id),
			logger.Error(err),
		)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	// Verify user exists
	var user types.User
	err = h.db.Users.FindOne(c, bson.M{"_id": oid}).Decode(&user)
	if err != nil {
		h.log.WarnCtx(ctx, "User not found for configurations query",
			logger.String("userId", id),
		)
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// Find configurations owned by this user
	filter := bson.M{"owner_id": id}
	
	// Optionally filter by archived status
	includeArchived := c.Query("includeArchived") == "true"
	if !includeArchived {
		filter["archived"] = bson.M{"$ne": true}
	}

	cursor, err := h.db.Configurations.Find(c, filter)
	if err != nil {
		h.log.ErrorCtx(ctx, "Failed to fetch user configurations",
			logger.String("userId", id),
			logger.Error(err),
		)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch configurations"})
		return
	}
	defer cursor.Close(c)

	var configs []types.Configuration
	if err := cursor.All(c, &configs); err != nil {
		h.log.ErrorCtx(ctx, "Failed to decode user configurations",
			logger.String("userId", id),
			logger.Error(err),
		)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode configurations"})
		return
	}

	h.log.InfoCtx(ctx, "User configurations retrieved successfully",
		logger.String("userId", id),
		logger.String("username", user.Username),
		logger.Int("count", len(configs)),
		logger.Bool("includeArchived", includeArchived),
	)

	c.JSON(http.StatusOK, gin.H{"configurations": configs})
}

