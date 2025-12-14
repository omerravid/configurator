package http

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"your.module/config-manager/internal/backup"
	"your.module/config-manager/internal/config"
	"your.module/config-manager/internal/files"
	"your.module/config-manager/internal/http/handlers"
	"your.module/config-manager/internal/http/middleware"
	"your.module/config-manager/internal/logger"
	"your.module/config-manager/internal/mongo"
)

func NewRouter(cfg config.Config, log *logger.Logger, mc *mongo.Client) *gin.Engine {
	r := gin.New()
	r.Use(gin.Recovery())

	// Add structured request logging middleware
	r.Use(middleware.RequestLogging(log))

	// Health check (no auth). Supports both GET and HEAD so frontend connectivity
	// checks can use lightweight HEAD requests.
	healthHandler := func(c *gin.Context) {
		// Consider the service unhealthy if it cannot reach Mongo quickly.
		// This keeps the signal aligned with "can we actually serve requests?"
		statusCode := http.StatusOK
		status := "OK"
		mongoOK := true

		ctx, cancel := context.WithTimeout(c.Request.Context(), 1*time.Second)
		defer cancel()

		if mc == nil || mc.DB == nil {
			mongoOK = false
			statusCode = http.StatusServiceUnavailable
			status = "DEGRADED"
		} else if err := mc.DB.Client().Ping(ctx, nil); err != nil {
			mongoOK = false
			statusCode = http.StatusServiceUnavailable
			status = "DEGRADED"
		}

		// HEAD responses should not include a body.
		if c.Request.Method == http.MethodHead {
			c.Status(statusCode)
			return
		}

		c.JSON(statusCode, gin.H{
			"status":    status,
			"mongo":     gin.H{"ok": mongoOK},
			"timestamp": time.Now().UTC().Format(time.RFC3339),
		})
	}
	r.GET("/api/health", healthHandler)
	r.HEAD("/api/health", healthHandler)

	authMw := middleware.Auth(middleware.AuthConfig{
		JWTSecret: cfg.JWTSecret,
		APIKey:    cfg.APIKey,
	})

	ah := handlers.NewAuthHandler(cfg, mc, log)
	ah.Register(r, authMw)

	api := r.Group("/api", authMw)
	requireAdmin := middleware.RequireAdmin()
	checkConfigPerms := middleware.CheckConfigPermissions(mc)

	// Users (admin only)
	uh := handlers.NewUsersHandler(mc, log)
	uh.Register(api, requireAdmin)

	// Files & Storage
	storageMgr, err := files.NewStorageManager(cfg)
	if err != nil {
		log.Error("Failed to initialize storage",
			logger.Error(err),
		)
		storageMgr = nil // Continue without storage
	}

	// Configs (needs storage for URL fixing)
	ch := handlers.NewConfigsHandler(mc, storageMgr, log)
	ch.Register(api, checkConfigPerms, requireAdmin)

	// Rules
	rh := handlers.NewRulesHandler(mc, log)
	rh.Register(api)

	// Files & File Management (only if storage initialized)
	if storageMgr != nil {
		fh := handlers.NewFilesHandler(storageMgr, log)
		fh.Register(api)

		// File Management
		fmh := handlers.NewFileManagementHandler(storageMgr, mc, log)
		fmh.Register(api)

		// Folder Import
		fih := handlers.NewFolderImportHandler(storageMgr, mc, log)
		fih.Register(api)
	}

	// Settings/Backup
	backupSvc := backup.New(cfg)
	sh := handlers.NewSettingsHandler(backupSvc, storageMgr, mc, log)
	sh.Register(api)

	return r
}
