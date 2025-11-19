package handlers

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"

	"your.module/config-manager/internal/files"
	"your.module/config-manager/internal/logger"
)

type FilesHandler struct {
	storage *files.StorageManager
	log     *logger.Logger
}

func NewFilesHandler(storage *files.StorageManager, log *logger.Logger) *FilesHandler {
	return &FilesHandler{storage: storage, log: log}
}

func (h *FilesHandler) Register(r *gin.RouterGroup) {
	r.GET("/files/:storageKey", h.serveFile)
	r.GET("/files/:storageKey/info", h.fileInfo)
}

func (h *FilesHandler) serveFile(c *gin.Context) {
	storageKey := c.Param("storageKey")

	data, metadata, err := h.storage.GetFileContent(c.Request.Context(), storageKey)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "File not found"})
		return
	}

	if metadata.StorageType != files.StorageEmbedded {
		c.JSON(http.StatusBadRequest, gin.H{"error": "This endpoint only serves embedded storage files"})
		return
	}

	c.Header("Content-Type", metadata.MimeType)
	c.Header("Content-Length", fmt.Sprintf("%d", metadata.Size))
	c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, metadata.OriginalName))
	c.Header("Cache-Control", "private, max-age=3600")
	c.Data(http.StatusOK, metadata.MimeType, data)
}

func (h *FilesHandler) fileInfo(c *gin.Context) {
	storageKey := c.Param("storageKey")

	_, metadata, err := h.storage.GetFileContent(c.Request.Context(), storageKey)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "File not found"})
		return
	}

	url, _ := h.storage.GenerateDownloadURL(c.Request.Context(), metadata)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"metadata": map[string]any{
			"fileId":       metadata.FileID,
			"originalName": metadata.OriginalName,
			"mimeType":     metadata.MimeType,
			"size":         metadata.Size,
			"storageType":  metadata.StorageType,
			"storageKey":   metadata.StorageKey,
			"uploadDate":   metadata.UploadDate,
			"downloadUrl":  url,
		},
	})
}
