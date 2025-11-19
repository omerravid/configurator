package handlers

import (
	"net/http"
	"os"
	"path/filepath"

	"github.com/gin-gonic/gin"

	"your.module/config-manager/internal/backup"
	"your.module/config-manager/internal/files"
	"your.module/config-manager/internal/logger"
	db "your.module/config-manager/internal/mongo"
)

type SettingsHandler struct {
	backupSvc  *backup.Service
	storageMgr *files.StorageManager
	db         *db.Client
	log        *logger.Logger
}

func NewSettingsHandler(backupSvc *backup.Service, storageMgr *files.StorageManager, dbClient *db.Client, log *logger.Logger) *SettingsHandler {
	return &SettingsHandler{
		backupSvc:  backupSvc,
		storageMgr: storageMgr,
		db:         dbClient,
		log:        log,
	}
}

func (h *SettingsHandler) Register(r *gin.RouterGroup) {
	r.POST("/settings/data/backup", h.createBackup)
	r.GET("/settings/data/backups", h.listBackups)
	r.GET("/settings/data/backup/:backupName", h.downloadBackup)
	r.POST("/settings/data/restore", h.restoreBackup)
	r.POST("/settings/data/upload-restore", h.uploadAndRestore)
	r.DELETE("/settings/data/backup/:backupName", h.deleteBackup)
	r.GET("/settings/data/status", h.dataStatus)

	// Storage status
	r.GET("/settings/storage", h.storageStatus)
}

func (h *SettingsHandler) createBackup(c *gin.Context) {
	var req struct {
		Name string `json:"name"`
	}
	_ = c.ShouldBindJSON(&req)

	path, err := h.backupSvc.CreateBackup(c.Request.Context(), req.Name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to create backup: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Backup created successfully",
		"file":    filepath.Base(path),
	})
}

func (h *SettingsHandler) listBackups(c *gin.Context) {
	backups, err := h.backupSvc.ListBackups()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to list backups",
		})
		return
	}

	// Transform string array to array of objects with 'name' property for frontend compatibility
	backupObjects := make([]gin.H, 0, len(backups))
	for _, backup := range backups {
		backupObjects = append(backupObjects, gin.H{
			"name": backup,
			"type": "full", // All backups are full backups in Go implementation
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"backups": backupObjects,
	})
}

func (h *SettingsHandler) downloadBackup(c *gin.Context) {
	name := c.Param("backupName")
	path := h.backupSvc.GetBackupPath(name)

	if _, err := os.Stat(path); err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "Backup not found",
		})
		return
	}

	c.FileAttachment(path, name)
}

func (h *SettingsHandler) restoreBackup(c *gin.Context) {
	var req struct {
		BackupName string `json:"backupName"`
		Filename   string `json:"filename"` // Support both field names
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Backup name is required",
		})
		return
	}

	// Support both 'backupName' and 'filename' for compatibility
	name := req.BackupName
	if name == "" {
		name = req.Filename
	}

	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Backup name or filename is required",
		})
		return
	}

	path := h.backupSvc.GetBackupPath(name)
	if err := h.backupSvc.RestoreBackup(c.Request.Context(), path); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to restore backup: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Backup restored successfully",
	})
}

func (h *SettingsHandler) deleteBackup(c *gin.Context) {
	name := c.Param("backupName")

	if err := h.backupSvc.DeleteBackup(name); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to delete backup",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Backup deleted successfully",
	})
}

func (h *SettingsHandler) dataStatus(c *gin.Context) {
	h.log.InfoCtx(c.Request.Context(), "Getting data statistics")

	// Count users
	userCount, err := h.db.Users.CountDocuments(c.Request.Context(), gin.H{})
	if err != nil {
		h.log.ErrorCtx(c.Request.Context(), "Failed to count users", logger.Error(err))
		userCount = 0
	}

	// Count configurations
	configCount, err := h.db.Configurations.CountDocuments(c.Request.Context(), gin.H{})
	if err != nil {
		h.log.ErrorCtx(c.Request.Context(), "Failed to count configurations", logger.Error(err))
		configCount = 0
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"stats": gin.H{
			"users":          userCount,
			"configurations": configCount,
		},
	})
}

func (h *SettingsHandler) uploadAndRestore(c *gin.Context) {
	h.log.InfoCtx(c.Request.Context(), "Upload and restore backup")

	// Get uploaded file
	file, err := c.FormFile("backupFile")
	if err != nil {
		h.log.ErrorCtx(c.Request.Context(), "Failed to get uploaded file", logger.Error(err))
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "No backup file provided",
		})
		return
	}

	// Save uploaded file to temporary location
	tempPath := filepath.Join(os.TempDir(), file.Filename)
	if err := c.SaveUploadedFile(file, tempPath); err != nil {
		h.log.ErrorCtx(c.Request.Context(), "Failed to save uploaded file", logger.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to save uploaded file",
		})
		return
	}
	defer os.Remove(tempPath) // Clean up temp file

	h.log.InfoCtx(c.Request.Context(), "Uploaded file saved",
		logger.String("filename", file.Filename),
		logger.String("tempPath", tempPath))

	// Restore from the uploaded file
	if err := h.backupSvc.RestoreBackup(c.Request.Context(), tempPath); err != nil {
		h.log.ErrorCtx(c.Request.Context(), "Failed to restore from uploaded file", logger.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to restore backup: " + err.Error(),
		})
		return
	}

	h.log.InfoCtx(c.Request.Context(), "Backup restored successfully from uploaded file")

	c.JSON(http.StatusOK, gin.H{
		"success":             true,
		"message":             "Backup restored successfully from uploaded file",
		"adminUsersPreserved": true, // For frontend compatibility
	})
}

func (h *SettingsHandler) storageStatus(c *gin.Context) {
	// Return storage configuration status
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"status": gin.H{
			"storageType":  "embedded", // or from config
			"isConfigured": true,
		},
	})
}
