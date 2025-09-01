package configmanager

import (
	"io"
	"time"
)

// ReplaceFileRequest represents file replacement request
type ReplaceFileRequest struct {
	ConfigID     string    `json:"configId"`
	PropertyPath string    `json:"propertyPath"`
	File         io.Reader `json:"-"`
	FileName     string    `json:"fileName"`
	ContentType  string    `json:"contentType,omitempty"`
}

// ReplaceFileResponse represents file replacement response
type ReplaceFileResponse struct {
	Success    bool               `json:"success"`
	Message    string             `json:"message"`
	FileObject *FileObject        `json:"fileObject,omitempty"`
	Config     *UpdatedConfigInfo `json:"config,omitempty"`
	Error      *string            `json:"error,omitempty"`
}

// UpdatedConfigInfo represents updated configuration info
type UpdatedConfigInfo struct {
	ID        string    `json:"id"`
	UpdatedAt time.Time `json:"updated_at"`
}

// FileInfoResponse represents file info response
type FileInfoResponse struct {
	Metadata    FileMetadata `json:"metadata"`
	DownloadURL string       `json:"downloadUrl"`
}

// FolderImportRequest represents folder import request
type FolderImportRequest struct {
	Files         []FolderImportFile `json:"-"`
	FolderName    *string            `json:"folderName,omitempty"`
	RelativePaths []string           `json:"relativePaths,omitempty"`
}

// FolderImportFile represents a file for folder import
type FolderImportFile struct {
	File         io.Reader `json:"-"`
	FileName     string    `json:"fileName"`
	ContentType  string    `json:"contentType,omitempty"`
	RelativePath string    `json:"relativePath,omitempty"`
}

// FolderImportResponse represents folder import response
type FolderImportResponse struct {
	Success bool                 `json:"success"`
	Message string               `json:"message"`
	Data    interface{}          `json:"data"`
	Stats   FolderImportStats    `json:"stats"`
}

// FolderImportStats represents folder import statistics
type FolderImportStats struct {
	TotalFiles   int      `json:"totalFiles"`
	JSONFiles    int      `json:"jsonFiles"`
	BinaryFiles  int      `json:"binaryFiles"`
	Errors       int      `json:"errors"`
	ErrorDetails []string `json:"errorDetails,omitempty"`
}

// FileDownloadResult represents file download result
type FileDownloadResult struct {
	Content       io.ReadCloser `json:"-"`
	FileName      string        `json:"fileName"`
	ContentType   string        `json:"contentType"`
	ContentLength int64         `json:"contentLength"`
}

// FileService provides file management operations
type FileService struct {
	client *HTTPClient
}

// NewFileService creates a new file service
func NewFileService(client *HTTPClient) *FileService {
	return &FileService{client: client}
}
