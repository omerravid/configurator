package http

import (
	"net/http"

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
	r.Use(gin.Logger(), gin.Recovery())

	r.GET("/api/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "OK"})
	})

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
	sh := handlers.NewSettingsHandler(backupSvc, storageMgr, log)
	sh.Register(api)

	return r
}
