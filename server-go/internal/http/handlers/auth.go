package handlers

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"golang.org/x/crypto/bcrypt"

	"your.module/config-manager/internal/auth"
	"your.module/config-manager/internal/config"
	"your.module/config-manager/internal/logger"
	"your.module/config-manager/internal/mongo"
	"your.module/config-manager/internal/types"
)

type AuthHandler struct {
	cfg config.Config
	db  *mongo.Client
	log *logger.Logger
}

func NewAuthHandler(cfg config.Config, db *mongo.Client, log *logger.Logger) *AuthHandler {
	return &AuthHandler{cfg: cfg, db: db, log: log}
}

// change signature to accept authMw
func (h *AuthHandler) Register(r *gin.Engine, authMw gin.HandlerFunc) {
	g := r.Group("/api/auth")
	g.POST("/login", h.login)
	g.POST("/register", h.register)

	// protected
	p := r.Group("/api/auth", authMw)
	p.GET("/me", h.me)
	p.POST("/refresh", h.refresh)
}
func (h *AuthHandler) login(c *gin.Context) {
	ctx := c.Request.Context()

	var req types.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.log.WarnCtx(ctx, "Invalid login request body",
			logger.Error(err),
		)
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	h.log.InfoCtx(ctx, "Login attempt",
		logger.String("username", req.Username),
	)

	var u types.User
	err := h.db.Users.FindOne(c, bson.M{"username": req.Username}).Decode(&u)
	if err != nil {
		h.log.WarnCtx(ctx, "Login failed - user not found",
			logger.String("username", req.Username),
		)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid username or password"})
		return
	}

	if bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(req.Password)) != nil {
		h.log.WarnCtx(ctx, "Login failed - invalid password",
			logger.String("username", req.Username),
			logger.String("userId", u.ID),
		)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid username or password"})
		return
	}

	tok, err := auth.GenerateToken(h.cfg.JWTSecret, u.ID, u.Username, string(u.Role), 24*time.Hour)
	if err != nil {
		h.log.ErrorCtx(ctx, "Failed to generate JWT token",
			logger.Error(err),
			logger.String("username", req.Username),
			logger.String("userId", u.ID),
		)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
		return
	}

	h.log.InfoCtx(ctx, "Login successful",
		logger.String("username", u.Username),
		logger.String("userId", u.ID),
		logger.String("role", string(u.Role)),
	)

	c.JSON(http.StatusOK, types.AuthResponse{
		Message: "Login successful",
		Token:   tok,
		User: gin.H{
			"id":       u.ID,
			"username": u.Username,
			"role":     u.Role,
		},
	})
}

func (h *AuthHandler) register(c *gin.Context) {
	ctx := c.Request.Context()

	var req types.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.log.WarnCtx(ctx, "Invalid register request body",
			logger.Error(err),
		)
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	h.log.InfoCtx(ctx, "User registration attempt",
		logger.String("username", req.Username),
		logger.String("role", string(req.Role)),
	)

	if req.Role == "" {
		req.Role = types.RoleUser
	}

	pw, _ := bcrypt.GenerateFromPassword([]byte(req.Password), 10)
	u := types.User{
		Username:     req.Username,
		PasswordHash: string(pw),
		Role:         req.Role,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	res, err := h.db.Users.InsertOne(c, u)
	if err != nil {
		h.log.WarnCtx(ctx, "User registration failed - username exists",
			logger.String("username", req.Username),
			logger.Error(err),
		)
		c.JSON(http.StatusConflict, gin.H{"error": "Username already exists"})
		return
	}

	id := res.InsertedID
	tok, err := auth.GenerateToken(h.cfg.JWTSecret, toString(id), u.Username, string(u.Role), 24*time.Hour)
	if err != nil {
		h.log.ErrorCtx(ctx, "Failed to generate JWT token for new user",
			logger.Error(err),
			logger.String("username", req.Username),
			logger.String("userId", toString(id)),
		)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
		return
	}

	h.log.InfoCtx(ctx, "User registered successfully",
		logger.String("username", u.Username),
		logger.String("userId", toString(id)),
		logger.String("role", string(u.Role)),
	)

	c.JSON(http.StatusCreated, types.AuthResponse{
		Message: "User registered successfully",
		Token:   tok,
		User: gin.H{
			"id":       toString(id),
			"username": u.Username,
			"role":     u.Role,
		},
	})
}

func (h *AuthHandler) me(c *gin.Context) {
	claims, _ := c.Get("user")
	c.JSON(http.StatusOK, gin.H{
		"user": claims,
	})
}

func (h *AuthHandler) refresh(c *gin.Context) {
	ctx := c.Request.Context()

	claims, ok := c.Get("user")
	if !ok {
		h.log.WarnCtx(ctx, "Token refresh failed - no user context")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	// Handle jwt.MapClaims (same pattern as other handlers)
	var m map[string]any
	switch v := claims.(type) {
	case map[string]any:
		m = v
	case jwt.MapClaims:
		m = map[string]any(v)
	default:
		h.log.ErrorCtx(ctx, "Token refresh failed - invalid user context type",
			logger.String("type", fmt.Sprintf("%T", claims)))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user context"})
		return
	}

	id, _ := m["userId"].(string)
	username, _ := m["username"].(string)
	role, _ := m["role"].(string)

	h.log.InfoCtx(ctx, "Refreshing JWT token",
		logger.String("username", username),
		logger.String("userId", id),
	)

	tok, err := auth.GenerateToken(h.cfg.JWTSecret, id, username, role, 24*time.Hour)
	if err != nil {
		h.log.ErrorCtx(ctx, "Failed to generate refreshed JWT token",
			logger.Error(err),
			logger.String("username", username),
			logger.String("userId", id),
		)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
		return
	}

	h.log.InfoCtx(ctx, "JWT token refreshed successfully",
		logger.String("username", username),
		logger.String("userId", id),
	)

	c.JSON(http.StatusOK, gin.H{"token": tok})
}

func toString(v any) string {
	switch t := v.(type) {
	case string:
		return t
	case primitive.ObjectID:
		return t.Hex()
	default:
		return ""
	}
}
