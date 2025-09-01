package configmanager

import (
	"context"
	"fmt"
	"io"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

// Download downloads a file by storage key
func (f *FileService) Download(ctx context.Context, storageKey string) (*FileDownloadResult, error) {
	if storageKey == "" {
		return nil, NewValidationError("storage key cannot be empty", 0)
	}

	path := fmt.Sprintf("/files/%s", storageKey)
	resp, err := f.client.Get(ctx, path)
	if err != nil {
		return nil, fmt.Errorf("download file request failed: %w", err)
	}

	// Don't close response here - it will be closed by the caller
	if resp.StatusCode != http.StatusOK {
		f.client.CloseResponse(resp)
		return nil, fmt.Errorf("download failed with status %d", resp.StatusCode)
	}

	// Get file information from headers
	contentType := resp.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	contentLength := resp.ContentLength
	if contentLength < 0 {
		contentLength = 0
	}

	// Try to get filename from Content-Disposition header
	fileName := storageKey
	if cd := resp.Header.Get("Content-Disposition"); cd != "" {
		if _, params, err := mime.ParseMediaType(cd); err == nil {
			if filename := params["filename"]; filename != "" {
				fileName = filename
			}
		}
	}

	return &FileDownloadResult{
		Content:       resp.Body,
		FileName:      fileName,
		ContentType:   contentType,
		ContentLength: contentLength,
	}, nil
}

// GetInfo gets file metadata and download URL
func (f *FileService) GetInfo(ctx context.Context, storageKey string) (*FileInfoResponse, error) {
	if storageKey == "" {
		return nil, NewValidationError("storage key cannot be empty", 0)
	}

	path := fmt.Sprintf("/files/%s/info", storageKey)
	resp, err := f.client.Get(ctx, path)
	if err != nil {
		return nil, fmt.Errorf("get file info request failed: %w", err)
	}
	defer f.client.CloseResponse(resp)

	var response FileInfoResponse
	if err := f.client.DecodeJSON(resp, &response); err != nil {
		return nil, fmt.Errorf("failed to decode file info response: %w", err)
	}

	return &response, nil
}

// ReplaceFile replaces a file in an existing configuration
func (f *FileService) ReplaceFile(ctx context.Context, request *ReplaceFileRequest) (*ReplaceFileResponse, error) {
	if request == nil {
		return nil, NewValidationError("replace file request cannot be nil", 0)
	}

	if request.ConfigID == "" {
		return nil, NewValidationError("config ID cannot be empty", 0)
	}

	if request.PropertyPath == "" {
		return nil, NewValidationError("property path cannot be empty", 0)
	}

	if request.File == nil {
		return nil, NewValidationError("file cannot be nil", 0)
	}

	if request.FileName == "" {
		return nil, NewValidationError("file name cannot be empty", 0)
	}

	// Create multipart form
	body, writer := f.client.CreateMultipartForm()

	// Add file
	fileWriter, err := writer.CreateFormFile("file", request.FileName)
	if err != nil {
		return nil, fmt.Errorf("failed to create form file: %w", err)
	}

	if _, err := io.Copy(fileWriter, request.File); err != nil {
		return nil, fmt.Errorf("failed to copy file data: %w", err)
	}

	// Add form fields
	if err := writer.WriteField("configId", request.ConfigID); err != nil {
		return nil, fmt.Errorf("failed to write configId field: %w", err)
	}

	if err := writer.WriteField("propertyPath", request.PropertyPath); err != nil {
		return nil, fmt.Errorf("failed to write propertyPath field: %w", err)
	}

	// Close the writer to finalize the form
	contentType := writer.FormDataContentType()
	if err := writer.Close(); err != nil {
		return nil, fmt.Errorf("failed to close multipart writer: %w", err)
	}

	// Send the request
	resp, err := f.client.PostMultipart(ctx, "/file-management/replace", body, contentType)
	if err != nil {
		return nil, fmt.Errorf("replace file request failed: %w", err)
	}
	defer f.client.CloseResponse(resp)

	var response ReplaceFileResponse
	if err := f.client.DecodeJSON(resp, &response); err != nil {
		return nil, fmt.Errorf("failed to decode replace file response: %w", err)
	}

	return &response, nil
}

// ReplaceFileFromPath replaces a file using a file path
func (f *FileService) ReplaceFileFromPath(ctx context.Context, configID, propertyPath, filePath string) (*ReplaceFileResponse, error) {
	if filePath == "" {
		return nil, NewValidationError("file path cannot be empty", 0)
	}

	file, err := os.Open(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to open file %s: %w", filePath, err)
	}
	defer file.Close()

	fileName := filepath.Base(filePath)
	contentType := getContentTypeFromExtension(filepath.Ext(filePath))

	request := &ReplaceFileRequest{
		ConfigID:     configID,
		PropertyPath: propertyPath,
		File:         file,
		FileName:     fileName,
		ContentType:  contentType,
	}

	return f.ReplaceFile(ctx, request)
}

// ImportFolder imports a folder structure with files
func (f *FileService) ImportFolder(ctx context.Context, request *FolderImportRequest) (*FolderImportResponse, error) {
	if request == nil {
		return nil, NewValidationError("folder import request cannot be nil", 0)
	}

	if len(request.Files) == 0 {
		return nil, NewValidationError("files list cannot be empty", 0)
	}

	// Create multipart form
	body, writer := f.client.CreateMultipartForm()

	// Add files
	for i, file := range request.Files {
		if file.File == nil {
			continue
		}

		fileWriter, err := writer.CreateFormFile("files", file.FileName)
		if err != nil {
			return nil, fmt.Errorf("failed to create form file for %s: %w", file.FileName, err)
		}

		if _, err := io.Copy(fileWriter, file.File); err != nil {
			return nil, fmt.Errorf("failed to copy file data for %s: %w", file.FileName, err)
		}
	}

	// Add optional fields
	if request.FolderName != nil {
		if err := writer.WriteField("folderName", *request.FolderName); err != nil {
			return nil, fmt.Errorf("failed to write folderName field: %w", err)
		}
	}

	for _, relativePath := range request.RelativePaths {
		if err := writer.WriteField("relativePaths", relativePath); err != nil {
			return nil, fmt.Errorf("failed to write relativePaths field: %w", err)
		}
	}

	// Close the writer to finalize the form
	contentType := writer.FormDataContentType()
	if err := writer.Close(); err != nil {
		return nil, fmt.Errorf("failed to close multipart writer: %w", err)
	}

	// Send the request
	resp, err := f.client.PostMultipart(ctx, "/folder-import", body, contentType)
	if err != nil {
		return nil, fmt.Errorf("import folder request failed: %w", err)
	}
	defer f.client.CloseResponse(resp)

	var response FolderImportResponse
	if err := f.client.DecodeJSON(resp, &response); err != nil {
		return nil, fmt.Errorf("failed to decode import folder response: %w", err)
	}

	return &response, nil
}

// SaveToFile saves a downloaded file to the specified path
func (f *FileService) SaveToFile(downloadResult *FileDownloadResult, destinationPath string) error {
	if downloadResult == nil {
		return NewValidationError("download result cannot be nil", 0)
	}

	if destinationPath == "" {
		return NewValidationError("destination path cannot be empty", 0)
	}

	defer downloadResult.Content.Close()

	// Create directory if it doesn't exist
	dir := filepath.Dir(destinationPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create directory %s: %w", dir, err)
	}

	// Create the destination file
	destFile, err := os.Create(destinationPath)
	if err != nil {
		return fmt.Errorf("failed to create file %s: %w", destinationPath, err)
	}
	defer destFile.Close()

	// Copy the content
	if _, err := io.Copy(destFile, downloadResult.Content); err != nil {
		return fmt.Errorf("failed to copy file content: %w", err)
	}

	return nil
}

// getContentTypeFromExtension returns the content type for a file extension
func getContentTypeFromExtension(ext string) string {
	ext = strings.ToLower(ext)
	switch ext {
	case ".txt":
		return "text/plain"
	case ".html", ".htm":
		return "text/html"
	case ".css":
		return "text/css"
	case ".js":
		return "application/javascript"
	case ".json":
		return "application/json"
	case ".xml":
		return "application/xml"
	case ".pdf":
		return "application/pdf"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".png":
		return "image/png"
	case ".gif":
		return "image/gif"
	case ".bmp":
		return "image/bmp"
	case ".svg":
		return "image/svg+xml"
	case ".mp4":
		return "video/mp4"
	case ".avi":
		return "video/x-msvideo"
	case ".mov":
		return "video/quicktime"
	case ".mp3":
		return "audio/mpeg"
	case ".wav":
		return "audio/wav"
	case ".zip":
		return "application/zip"
	case ".tar":
		return "application/x-tar"
	case ".gz":
		return "application/gzip"
	case ".doc":
		return "application/msword"
	case ".docx":
		return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
	case ".xls":
		return "application/vnd.ms-excel"
	case ".xlsx":
		return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
	case ".ppt":
		return "application/vnd.ms-powerpoint"
	case ".pptx":
		return "application/vnd.openxmlformats-officedocument.presentationml.presentation"
	default:
		return "application/octet-stream"
	}
}
