package handlers

import (
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"

	"your.module/config-manager/internal/files"
	"your.module/config-manager/internal/logger"
	"your.module/config-manager/internal/mongo"
	"your.module/config-manager/internal/types"
)

type FileManagementHandler struct {
	storage *files.StorageManager
	db      *mongo.Client
	log     *logger.Logger
}

func NewFileManagementHandler(storage *files.StorageManager, db *mongo.Client, log *logger.Logger) *FileManagementHandler {
	return &FileManagementHandler{
		storage: storage,
		db:      db,
		log:     log,
	}
}

func (h *FileManagementHandler) Register(api *gin.RouterGroup) {
	fm := api.Group("/file-management")
	{
		fm.POST("/upload", h.upload)
		fm.POST("/replace", h.replace)
		fm.DELETE("/:storageKey", h.deleteFile)
		fm.GET("/unreferenced", h.listUnreferenced)
		fm.DELETE("/unreferenced", h.deleteUnreferenced)
	}
}

// POST /api/file-management/upload - Upload a new file to a configuration
func (h *FileManagementHandler) upload(c *gin.Context) {
	configID := c.PostForm("configId")
	propertyPath := c.PostForm("propertyPath")

	if configID == "" || propertyPath == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Missing configId or propertyPath",
		})
		return
	}

	// Get uploaded file
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "No file uploaded",
		})
		return
	}

	// Verify configuration exists
	oid, err := primitive.ObjectIDFromHex(configID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid configId",
		})
		return
	}

	var config types.Configuration
	err = h.db.Configurations.FindOne(c, bson.M{"_id": oid}).Decode(&config)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "Configuration not found",
		})
		return
	}

	// Open the file
	fileReader, err := file.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to read uploaded file",
		})
		return
	}
	defer fileReader.Close()

	// Read file content
	fileContent, err := io.ReadAll(fileReader)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to read file content",
		})
		return
	}

	// Determine mime type
	mimeType := file.Header.Get("Content-Type")
	if mimeType == "" {
		mimeType = "application/octet-stream"
	}

	// Store the file
	fileMetadata, err := h.storage.StoreFile(c.Request.Context(), fileContent, file.Filename, mimeType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to store file",
			"details": err.Error(),
		})
		return
	}

	// Generate download URL
	downloadURL, err := h.storage.GenerateDownloadURL(c.Request.Context(), fileMetadata)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to generate download URL",
		})
		return
	}

	// Create file object
	fileObject := map[string]interface{}{
		"_type": "file",
		"_metadata": map[string]interface{}{
			"originalName": file.Filename,
			"mimeType":     mimeType,
			"size":         file.Size,
			"storageKey":   fileMetadata.FileID,
			"storageType":  fileMetadata.StorageType,
		},
		"_link": downloadURL,
	}

	// Update configuration with file object at property path
	dataUpdate := make(map[string]interface{})
	setValueAtPath(dataUpdate, propertyPath, fileObject)

	// Perform update
	update := bson.M{
		"$set": bson.M{
			"data": dataUpdate,
		},
	}

	_, err = h.db.Configurations.UpdateOne(c, bson.M{"_id": oid}, update)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to update configuration",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":     true,
		"message":     fmt.Sprintf("File \"%s\" uploaded successfully", file.Filename),
		"metadata":    fileObject["_metadata"],
		"downloadUrl": downloadURL,
	})
}

// POST /api/file-management/replace - Replace an existing file
func (h *FileManagementHandler) replace(c *gin.Context) {
	configID := c.PostForm("configId")
	propertyPath := c.PostForm("propertyPath")

	if configID == "" || propertyPath == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Missing configId or propertyPath",
		})
		return
	}

	// Get uploaded file
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "No file uploaded",
		})
		return
	}

	// Verify configuration exists
	oid, err := primitive.ObjectIDFromHex(configID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid configId",
		})
		return
	}

	var config types.Configuration
	err = h.db.Configurations.FindOne(c, bson.M{"_id": oid}).Decode(&config)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "Configuration not found",
		})
		return
	}

	// Get current value at property path to find old file
	currentValue := getValueAtPath(config.Data, propertyPath)
	if currentValue == nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Property path not found",
		})
		return
	}

	// Check if it's a file object
	currentMap, ok := currentValue.(map[string]interface{})
	if !ok || currentMap["_type"] != "file" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Property is not a file object",
		})
		return
	}

	// Delete old file if it exists
	if metadata, ok := currentMap["_metadata"].(map[string]interface{}); ok {
		if storageKey, ok := metadata["storageKey"].(string); ok {
			fileMeta := &files.FileMetadata{StorageKey: storageKey}
			err := h.storage.DeleteFile(c.Request.Context(), fileMeta)
			if err != nil {
				fmt.Printf("Warning: Failed to delete old file %s: %v\n", storageKey, err)
				// Continue with replacement even if deletion fails
			}
		}
	}

	// Open the new file
	fileReader, err := file.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to read uploaded file",
		})
		return
	}
	defer fileReader.Close()

	// Read file content
	fileContent, err := io.ReadAll(fileReader)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to read file content",
		})
		return
	}

	// Determine mime type
	mimeType := file.Header.Get("Content-Type")
	if mimeType == "" {
		mimeType = "application/octet-stream"
	}

	// Store the new file
	fileMetadata, err := h.storage.StoreFile(c.Request.Context(), fileContent, file.Filename, mimeType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to store file",
			"details": err.Error(),
		})
		return
	}

	// Generate download URL
	downloadURL, err := h.storage.GenerateDownloadURL(c.Request.Context(), fileMetadata)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to generate download URL",
		})
		return
	}

	// Create new file object
	fileObject := map[string]interface{}{
		"_type": "file",
		"_metadata": map[string]interface{}{
			"originalName": file.Filename,
			"mimeType":     mimeType,
			"size":         file.Size,
			"storageKey":   fileMetadata.FileID,
			"storageType":  fileMetadata.StorageType,
		},
		"_link": downloadURL,
	}

	// Update configuration
	dataUpdate := make(map[string]interface{})
	setValueAtPath(dataUpdate, propertyPath, fileObject)

	update := bson.M{
		"$set": bson.M{
			"data": dataUpdate,
		},
	}

	_, err = h.db.Configurations.UpdateOne(c, bson.M{"_id": oid}, update)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to update configuration",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":  true,
		"message":  fmt.Sprintf("File \"%s\" replaced successfully", file.Filename),
		"fileData": fileObject,
	})
}

// DELETE /api/file-management/:storageKey - Delete a file
func (h *FileManagementHandler) deleteFile(c *gin.Context) {
	storageKey := c.Param("storageKey")

	if storageKey == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Missing storageKey",
		})
		return
	}

	// Delete the file
	fileMeta := &files.FileMetadata{
		StorageKey: storageKey,
	}

	err := h.storage.DeleteFile(c.Request.Context(), fileMeta)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to delete file",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "File deleted successfully",
	})
}

// GET /api/file-management/unreferenced - List unreferenced files
func (h *FileManagementHandler) listUnreferenced(c *gin.Context) {
	// Get all stored files
	allFiles, err := h.storage.ListAllFiles(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to list files",
		})
		return
	}

	// Get all referenced files from configurations
	referencedFiles, err := h.getAllReferencedFiles(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to get referenced files",
		})
		return
	}

	// Find unreferenced files
	var unreferenced []map[string]interface{}
	for _, file := range allFiles {
		storageKey, _ := file["storageKey"].(string)
		if !referencedFiles[storageKey] {
			unreferenced = append(unreferenced, file)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success":           true,
		"unreferencedFiles": unreferenced,
		"totalFiles":        len(allFiles),
		"referencedFiles":   len(referencedFiles),
		"unreferencedCount": len(unreferenced),
	})
}

// DELETE /api/file-management/unreferenced - Delete all unreferenced files
func (h *FileManagementHandler) deleteUnreferenced(c *gin.Context) {
	// Get all stored files
	allFiles, err := h.storage.ListAllFiles(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to list files",
		})
		return
	}

	// Get all referenced files from configurations
	referencedFiles, err := h.getAllReferencedFiles(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to get referenced files",
		})
		return
	}

	// Delete unreferenced files
	deletedCount := 0
	var errors []map[string]interface{}

	for _, file := range allFiles {
		storageKey, _ := file["storageKey"].(string)
		if !referencedFiles[storageKey] {
			fileMeta := &files.FileMetadata{StorageKey: storageKey}
			err := h.storage.DeleteFile(c.Request.Context(), fileMeta)
			if err != nil {
				errors = append(errors, map[string]interface{}{
					"storageKey":   storageKey,
					"originalName": file["originalName"],
					"error":        err.Error(),
				})
			} else {
				deletedCount++
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success":         true,
		"message":         fmt.Sprintf("Successfully deleted %d unreferenced files", deletedCount),
		"deletedCount":    deletedCount,
		"totalCandidates": len(allFiles) - len(referencedFiles),
		"errors":          errors,
	})
}

// Helper: get all referenced files from configurations
func (h *FileManagementHandler) getAllReferencedFiles(c *gin.Context) (map[string]bool, error) {
	referencedFiles := make(map[string]bool)

	cursor, err := h.db.Configurations.Find(c, bson.M{})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(c)

	for cursor.Next(c) {
		var config types.Configuration
		if err := cursor.Decode(&config); err != nil {
			continue
		}

		if config.Data != nil {
			findFileReferences(config.Data, referencedFiles)
		}
	}

	return referencedFiles, nil
}

// Helper: recursively find file references in data
func findFileReferences(data interface{}, referenced map[string]bool) {
	switch v := data.(type) {
	case map[string]interface{}:
		// Check if this is a file object
		if v["_type"] == "file" {
			if metadata, ok := v["_metadata"].(map[string]interface{}); ok {
				if storageKey, ok := metadata["storageKey"].(string); ok {
					referenced[storageKey] = true
				}
			}
		}
		// Recursively check all properties
		for _, value := range v {
			findFileReferences(value, referenced)
		}
	case []interface{}:
		for _, item := range v {
			findFileReferences(item, referenced)
		}
	}
}

// Helper: set value at a dot-separated path
func setValueAtPath(obj map[string]interface{}, path string, value interface{}) {
	keys := strings.Split(path, ".")
	current := obj

	// Navigate to parent, creating intermediate objects
	for i := 0; i < len(keys)-1; i++ {
		key := keys[i]
		if _, exists := current[key]; !exists {
			current[key] = make(map[string]interface{})
		}
		if next, ok := current[key].(map[string]interface{}); ok {
			current = next
		} else {
			// Overwrite non-map value
			current[key] = make(map[string]interface{})
			current = current[key].(map[string]interface{})
		}
	}

	// Set final value
	finalKey := keys[len(keys)-1]
	current[finalKey] = value
}

// Helper: get value at a dot-separated path
func getValueAtPath(obj map[string]interface{}, path string) interface{} {
	if obj == nil || path == "" {
		return obj
	}

	keys := strings.Split(path, ".")
	var current interface{} = obj

	for _, key := range keys {
		if m, ok := current.(map[string]interface{}); ok {
			current = m[key]
		} else {
			return nil
		}
	}

	return current
}

