package handlers

import (
	"net/http"
	"os"
	"path/filepath"

	"github.com/gin-gonic/gin"

	"your.module/config-manager/internal/backup"
	"your.module/config-manager/internal/files"
	"your.module/config-manager/internal/logger"
)

type SettingsHandler struct {
	backupSvc  *backup.Service
	storageMgr *files.StorageManager
	log        *logger.Logger
}

func NewSettingsHandler(backupSvc *backup.Service, storageMgr *files.StorageManager, log *logger.Logger) *SettingsHandler {
	return &SettingsHandler{
		backupSvc:  backupSvc,
		storageMgr: storageMgr,
		log:        log,
	}
}

func (h *SettingsHandler) Register(r *gin.RouterGroup) {
	r.POST("/settings/data/backup", h.createBackup)
	r.GET("/settings/data/backups", h.listBackups)
	r.GET("/settings/data/backup/:backupName", h.downloadBackup)
	r.POST("/settings/data/restore", h.restoreBackup)
	r.DELETE("/settings/data/backup/:backupName", h.deleteBackup)

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

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"backups": backups,
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
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Backup name is required",
		})
		return
	}

	path := h.backupSvc.GetBackupPath(req.BackupName)
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
