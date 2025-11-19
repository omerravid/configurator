package handlers

import (
	"encoding/json"
	"fmt"
	"mime/multipart"
	"net/http"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"

	"your.module/config-manager/internal/files"
	"your.module/config-manager/internal/logger"
	"your.module/config-manager/internal/mongo"
	"your.module/config-manager/internal/types"
)

type FolderImportHandler struct {
	storage *files.StorageManager
	db      *mongo.Client
	log     *logger.Logger
}

func NewFolderImportHandler(storage *files.StorageManager, db *mongo.Client, log *logger.Logger) *FolderImportHandler {
	return &FolderImportHandler{
		storage: storage,
		db:      db,
		log:     log,
	}
}

func (h *FolderImportHandler) Register(api *gin.RouterGroup) {
	api.POST("/folder-import", h.importFolder)
}

// POST /api/folder-import - Import folder with JSON and binary files
func (h *FolderImportHandler) importFolder(c *gin.Context) {
	// Parse multipart form (max 1000 files)
	err := c.Request.ParseMultipartForm(32 << 20) // 32 MB max memory
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Failed to parse multipart form",
			"details": err.Error(),
		})
		return
	}

	form := c.Request.MultipartForm
	if form == nil || form.File["files"] == nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "No files uploaded",
		})
		return
	}

	uploadedFiles := form.File["files"]
	folderName := c.PostForm("folderName")
	configID := c.PostForm("configId")
	propertyPath := c.PostForm("propertyPath")

	// Get relative paths (can be multiple form values)
	relativePaths := c.Request.Form["relativePaths"]

	fmt.Printf("Folder import: %d files, folder=%s, configId=%s, propertyPath=%s\n",
		len(uploadedFiles), folderName, configID, propertyPath)

	// Process folder import
	result, err := h.processFolderImport(c, uploadedFiles, folderName, relativePaths)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to process folder import",
			"details": err.Error(),
		})
		return
	}

	// If configId and propertyPath provided, attach to configuration
	if configID != "" && propertyPath != "" {
		err := h.attachToConfiguration(c, configID, propertyPath, result.Structure)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Import succeeded but failed to attach to configuration",
				"details": err.Error(),
				"data":    result.Structure,
				"stats": gin.H{
					"totalFiles":   result.TotalFiles,
					"jsonFiles":    result.JSONFiles,
					"binaryFiles":  result.BinaryFiles,
					"errors":       len(result.Errors),
					"errorDetails": result.Errors,
				},
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"success":  true,
			"message":  fmt.Sprintf("Successfully imported and attached %d files to property \"%s\"", result.TotalFiles, propertyPath),
			"attached": true,
			"configId": configID,
			"propertyPath": propertyPath,
			"stats": gin.H{
				"totalFiles":   result.TotalFiles,
				"jsonFiles":    result.JSONFiles,
				"binaryFiles":  result.BinaryFiles,
				"errors":       len(result.Errors),
				"errorDetails": result.Errors,
			},
		})
		return
	}

	// Normal import without attachment
	c.JSON(http.StatusOK, gin.H{
		"success":  true,
		"message":  fmt.Sprintf("Successfully processed %d files (%d JSON, %d binary)", result.TotalFiles, result.JSONFiles, result.BinaryFiles),
		"data":     result.Structure,
		"attached": false,
		"stats": gin.H{
			"totalFiles":   result.TotalFiles,
			"jsonFiles":    result.JSONFiles,
			"binaryFiles":  result.BinaryFiles,
			"errors":       len(result.Errors),
			"errorDetails": result.Errors,
		},
	})
}

type ImportResult struct {
	Structure   map[string]interface{}
	TotalFiles  int
	JSONFiles   int
	BinaryFiles int
	Errors      []map[string]string
}

func (h *FolderImportHandler) processFolderImport(c *gin.Context, uploadedFiles []*multipart.FileHeader, folderName string, relativePaths []string) (*ImportResult, error) {
	structure := make(map[string]interface{})
	var errors []map[string]string
	jsonFiles := 0
	binaryFiles := 0

	// First pass: process JSON files only
	for idx, fileHeader := range uploadedFiles {
		file, err := fileHeader.Open()
		if err != nil {
			errors = append(errors, map[string]string{
				"file":  fileHeader.Filename,
				"error": fmt.Sprintf("Failed to open file: %v", err),
			})
			continue
		}

		// Read file content
		fileContent := make([]byte, fileHeader.Size)
		_, err = file.Read(fileContent)
		file.Close()
		if err != nil {
			errors = append(errors, map[string]string{
				"file":  fileHeader.Filename,
				"error": fmt.Sprintf("Failed to read file: %v", err),
			})
			continue
		}

		// Get relative path
		var relativePath string
		if idx < len(relativePaths) && relativePaths[idx] != "" {
			relativePath = relativePaths[idx]
		} else {
			relativePath = fileHeader.Filename
		}

		// Normalize path
		relativePath = strings.ReplaceAll(relativePath, "\\", "/")
		relativePath = strings.TrimPrefix(relativePath, "/")
		pathParts := strings.Split(relativePath, "/")
		pathParts = filterEmpty(pathParts)

		// Remove folder name if it's the first part
		if folderName != "" && len(pathParts) > 0 && pathParts[0] == folderName {
			pathParts = pathParts[1:]
		}

		if len(pathParts) == 0 {
			errors = append(errors, map[string]string{
				"file":  fileHeader.Filename,
				"error": "Invalid file path",
			})
			continue
		}

		fileName := pathParts[len(pathParts)-1]
		fileExt := strings.ToLower(filepath.Ext(fileName))

		// Only process JSON files in first pass
		if fileExt != ".json" {
			continue
		}

		folderParts := pathParts[:len(pathParts)-1]
		parent := ensureFolderPath(structure, folderParts)

		// Parse JSON
		var jsonContent interface{}
		err = json.Unmarshal(fileContent, &jsonContent)
		if err != nil {
			errors = append(errors, map[string]string{
				"file":  fileHeader.Filename,
				"error": fmt.Sprintf("JSON parse error: %v", err),
			})
			continue
		}

		propertyName := getSanitizedFileNameWithoutExtension(fileName)
		if parentMap, ok := parent.(map[string]interface{}); ok {
			parentMap[propertyName] = jsonContent
			jsonFiles++
		}
	}

	// Second pass: process binary files
	for idx, fileHeader := range uploadedFiles {
		file, err := fileHeader.Open()
		if err != nil {
			continue // Already logged in first pass
		}

		// Read file content
		fileContent := make([]byte, fileHeader.Size)
		_, err = file.Read(fileContent)
		file.Close()
		if err != nil {
			continue // Already logged
		}

		// Get relative path
		var relativePath string
		if idx < len(relativePaths) && relativePaths[idx] != "" {
			relativePath = relativePaths[idx]
		} else {
			relativePath = fileHeader.Filename
		}

		// Normalize path
		relativePath = strings.ReplaceAll(relativePath, "\\", "/")
		relativePath = strings.TrimPrefix(relativePath, "/")
		pathParts := strings.Split(relativePath, "/")
		pathParts = filterEmpty(pathParts)

		// Remove folder name if it's the first part
		if folderName != "" && len(pathParts) > 0 && pathParts[0] == folderName {
			pathParts = pathParts[1:]
		}

		if len(pathParts) == 0 {
			continue // Already logged
		}

		fileName := pathParts[len(pathParts)-1]
		fileExt := strings.ToLower(filepath.Ext(fileName))

		// Skip JSON files (already processed)
		if fileExt == ".json" {
			continue
		}

		folderParts := pathParts[:len(pathParts)-1]
		parent := ensureFolderPath(structure, folderParts)

		// Store binary file
		mimeType := fileHeader.Header.Get("Content-Type")
		if mimeType == "" {
			mimeType = "application/octet-stream"
		}

		fileMetadata, err := h.storage.StoreFile(c.Request.Context(), fileContent, fileName, mimeType)
		if err != nil {
			errors = append(errors, map[string]string{
				"file":  fileHeader.Filename,
				"error": fmt.Sprintf("Storage error: %v", err),
			})
			continue
		}

		downloadURL, err := h.storage.GenerateDownloadURL(c.Request.Context(), fileMetadata)
		if err != nil {
			downloadURL = ""
		}

		// Create file object
		fileObject := map[string]interface{}{
			"_type": "file",
			"_metadata": map[string]interface{}{
				"originalName": fileName,
				"mimeType":     mimeType,
				"size":         fileHeader.Size,
				"storageKey":   fileMetadata.FileID,
				"storageType":  fileMetadata.StorageType,
			},
			"_link": downloadURL,
		}

		propertyName := getSanitizedFileNameWithoutExtension(fileName)
		if parentMap, ok := parent.(map[string]interface{}); ok {
			// Avoid collision with existing properties
			originalName := propertyName
			counter := 1
			for {
				if _, exists := parentMap[propertyName]; !exists {
					break
				}
				propertyName = fmt.Sprintf("%s_%d", originalName, counter)
				counter++
			}
			parentMap[propertyName] = fileObject
			binaryFiles++
		}
	}

	return &ImportResult{
		Structure:   structure,
		TotalFiles:  len(uploadedFiles),
		JSONFiles:   jsonFiles,
		BinaryFiles: binaryFiles,
		Errors:      errors,
	}, nil
}

func (h *FolderImportHandler) attachToConfiguration(c *gin.Context, configID, propertyPath string, structure map[string]interface{}) error {
	oid, err := primitive.ObjectIDFromHex(configID)
	if err != nil {
		return fmt.Errorf("invalid configId: %v", err)
	}

	// Verify configuration exists
	var config types.Configuration
	err = h.db.Configurations.FindOne(c, bson.M{"_id": oid}).Decode(&config)
	if err != nil {
		return fmt.Errorf("configuration not found: %v", err)
	}

	// Build update with structure at property path
	dataUpdate := make(map[string]interface{})
	setValueAtPath(dataUpdate, propertyPath, structure)

	// Update configuration
	update := bson.M{
		"$set": bson.M{
			"data": dataUpdate,
		},
	}

	_, err = h.db.Configurations.UpdateOne(c, bson.M{"_id": oid}, update)
	if err != nil {
		return fmt.Errorf("failed to update configuration: %v", err)
	}

	return nil
}

// Helper functions

func ensureFolderPath(root interface{}, parts []string) interface{} {
	current := root
	for _, part := range parts {
		if currentMap, ok := current.(map[string]interface{}); ok {
			if _, exists := currentMap[part]; !exists {
				currentMap[part] = make(map[string]interface{})
			}
			current = currentMap[part]
		}
	}
	return current
}

func getSanitizedFileNameWithoutExtension(filename string) string {
	// Remove extension
	name := strings.TrimSuffix(filename, filepath.Ext(filename))
	// Replace dots with underscores
	name = strings.ReplaceAll(name, ".", "_")
	return name
}

func filterEmpty(parts []string) []string {
	var result []string
	for _, part := range parts {
		if part != "" {
			result = append(result, part)
		}
	}
	return result
}

