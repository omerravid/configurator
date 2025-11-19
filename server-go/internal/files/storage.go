package files

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/feature/s3/manager"
	"github.com/aws/aws-sdk-go-v2/service/s3"

	"your.module/config-manager/internal/config"
)

type StorageType string

const (
	StorageEmbedded StorageType = "embedded"
	StorageS3       StorageType = "s3"
)

type FileMetadata struct {
	FileID       string      `json:"fileId"`
	OriginalName string      `json:"originalName"`
	MimeType     string      `json:"mimeType"`
	Size         int64       `json:"size"`
	StorageType  StorageType `json:"storageType"`
	StorageKey   string      `json:"storageKey"`
	BucketName   string      `json:"bucketName,omitempty"`
	Region       string      `json:"region,omitempty"`
	FilePath     string      `json:"filePath,omitempty"`
	UploadDate   time.Time   `json:"uploadDate"`
}

type Storage interface {
	StoreFile(ctx context.Context, data []byte, filename, mimeType string) (*FileMetadata, error)
	GetFileContent(ctx context.Context, storageKey string) ([]byte, *FileMetadata, error)
	GenerateDownloadURL(ctx context.Context, metadata *FileMetadata, expiresIn time.Duration) (string, error)
	DeleteFile(ctx context.Context, metadata *FileMetadata) error
}

type EmbeddedStorage struct {
	basePath string
	baseURL  string
}

func NewEmbeddedStorage(appCfg config.Config) *EmbeddedStorage {
	baseURL := appCfg.ServerBaseURL
	if baseURL == "" {
		baseURL = "http://localhost:3004"
	}
	return &EmbeddedStorage{
		basePath: appCfg.EmbeddedPath,
		baseURL:  baseURL,
	}
}

func (s *EmbeddedStorage) StoreFile(ctx context.Context, data []byte, filename, mimeType string) (*FileMetadata, error) {
	if err := os.MkdirAll(s.basePath, 0755); err != nil {
		return nil, err
	}

	fileID := generateFileID()
	ext := filepath.Ext(filename)
	storageKey := fileID + ext
	filePath := filepath.Join(s.basePath, storageKey)

	if err := os.WriteFile(filePath, data, 0644); err != nil {
		return nil, err
	}

	metaPath := filePath + ".meta.json"
	meta := FileMetadata{
		FileID:       storageKey,
		OriginalName: filename,
		MimeType:     mimeType,
		Size:         int64(len(data)),
		StorageType:  StorageEmbedded,
		StorageKey:   storageKey,
		FilePath:     filePath,
		UploadDate:   time.Now(),
	}

	metaJSON := fmt.Sprintf(`{"originalName":"%s","mimeType":"%s","size":%d,"storageKey":"%s","uploadDate":"%s"}`,
		filename, mimeType, len(data), storageKey, meta.UploadDate.Format(time.RFC3339))
	if err := os.WriteFile(metaPath, []byte(metaJSON), 0644); err != nil {
		os.Remove(filePath)
		return nil, err
	}

	return &meta, nil
}

func (s *EmbeddedStorage) GetFileContent(ctx context.Context, storageKey string) ([]byte, *FileMetadata, error) {
	filePath := filepath.Join(s.basePath, storageKey)
	metaPath := filePath + ".meta.json"

	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, nil, err
	}

	metaJSON, err := os.ReadFile(metaPath)
	if err != nil {
		return nil, nil, err
	}

	meta := &FileMetadata{
		StorageKey:  storageKey,
		StorageType: StorageEmbedded,
		FilePath:    filePath,
		Size:        int64(len(data)),
	}
	_ = metaJSON // parse if needed

	return data, meta, nil
}

func (s *EmbeddedStorage) GenerateDownloadURL(ctx context.Context, metadata *FileMetadata, expiresIn time.Duration) (string, error) {
	return fmt.Sprintf("%s/api/files/%s", s.baseURL, metadata.StorageKey), nil
}

func (s *EmbeddedStorage) DeleteFile(ctx context.Context, metadata *FileMetadata) error {
	filePath := filepath.Join(s.basePath, metadata.StorageKey)
	metaPath := filePath + ".meta.json"
	os.Remove(filePath)
	os.Remove(metaPath)
	return nil
}

func (s *EmbeddedStorage) ListAllFiles(ctx context.Context) ([]map[string]interface{}, error) {
	var fileList []map[string]interface{}

	entries, err := os.ReadDir(s.basePath)
	if err != nil {
		return nil, err
	}

	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".meta.json") {
			continue
		}

		// Read metadata file
		metaPath := filepath.Join(s.basePath, entry.Name())
		metaData, err := os.ReadFile(metaPath)
		if err != nil {
			continue
		}

		var meta FileMetadata
		if err := json.Unmarshal(metaData, &meta); err != nil {
			continue
		}

		// Check if actual file exists
		actualFileName := strings.TrimSuffix(entry.Name(), ".meta.json")
		actualFilePath := filepath.Join(s.basePath, actualFileName)
		if _, err := os.Stat(actualFilePath); err != nil {
			continue
		}

		fileList = append(fileList, map[string]interface{}{
			"storageKey":   meta.StorageKey,
			"originalName": meta.OriginalName,
			"mimeType":     meta.MimeType,
			"size":         meta.Size,
			"uploadDate":   meta.UploadDate,
			"fileName":     actualFileName,
		})
	}

	return fileList, nil
}

type S3Storage struct {
	client  *s3.Client
	bucket  string
	region  string
	baseURL string
}

func NewS3Storage(appCfg config.Config) (*S3Storage, error) {
	awsCfg, err := awsconfig.LoadDefaultConfig(context.Background(),
		awsconfig.WithRegion(appCfg.AWSRegion),
	)
	if err != nil {
		return nil, err
	}

	baseURL := appCfg.ServerBaseURL
	if baseURL == "" {
		baseURL = "http://localhost:3004"
	}

	return &S3Storage{
		client:  s3.NewFromConfig(awsCfg),
		bucket:  appCfg.S3Bucket,
		region:  appCfg.AWSRegion,
		baseURL: baseURL,
	}, nil
}

func (s *S3Storage) StoreFile(ctx context.Context, data []byte, filename, mimeType string) (*FileMetadata, error) {
	fileID := generateFileID()
	ext := filepath.Ext(filename)
	storageKey := fileID + ext

	uploader := manager.NewUploader(s.client)
	_, err := uploader.Upload(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(s.bucket),
		Key:         aws.String(storageKey),
		Body:        bytes.NewReader(data),
		ContentType: aws.String(mimeType),
		Metadata: map[string]string{
			"originalName": filename,
			"uploadDate":   time.Now().Format(time.RFC3339),
		},
	})
	if err != nil {
		return nil, err
	}

	return &FileMetadata{
		FileID:       storageKey,
		OriginalName: filename,
		MimeType:     mimeType,
		Size:         int64(len(data)),
		StorageType:  StorageS3,
		StorageKey:   storageKey,
		BucketName:   s.bucket,
		Region:       s.region,
		UploadDate:   time.Now(),
	}, nil
}

func (s *S3Storage) GetFileContent(ctx context.Context, storageKey string) ([]byte, *FileMetadata, error) {
	downloader := manager.NewDownloader(s.client)
	buf := manager.NewWriteAtBuffer([]byte{})
	_, err := downloader.Download(ctx, buf, &s3.GetObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(storageKey),
	})
	if err != nil {
		return nil, nil, err
	}

	meta := &FileMetadata{
		StorageKey:  storageKey,
		StorageType: StorageS3,
		BucketName:  s.bucket,
		Region:      s.region,
		Size:        int64(len(buf.Bytes())),
	}

	return buf.Bytes(), meta, nil
}

func (s *S3Storage) GenerateDownloadURL(ctx context.Context, metadata *FileMetadata, expiresIn time.Duration) (string, error) {
	presignClient := s3.NewPresignClient(s.client)
	req, err := presignClient.PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(metadata.StorageKey),
	}, func(opts *s3.PresignOptions) {
		opts.Expires = expiresIn
	})
	if err != nil {
		return "", err
	}
	return req.URL, nil
}

func (s *S3Storage) DeleteFile(ctx context.Context, metadata *FileMetadata) error {
	_, err := s.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(metadata.StorageKey),
	})
	return err
}

type StorageManager struct {
	storage Storage
	cfg     config.Config
}

func NewStorageManager(appCfg config.Config) (*StorageManager, error) {
	var s Storage
	var err error

	if appCfg.StorageType == "s3" {
		s, err = NewS3Storage(appCfg)
		if err != nil {
			return nil, err
		}
	} else {
		s = NewEmbeddedStorage(appCfg)
	}

	return &StorageManager{storage: s, cfg: appCfg}, nil
}

func (sm *StorageManager) StoreFile(ctx context.Context, data []byte, filename, mimeType string) (*FileMetadata, error) {
	return sm.storage.StoreFile(ctx, data, filename, mimeType)
}

func (sm *StorageManager) GetFileContent(ctx context.Context, storageKey string) ([]byte, *FileMetadata, error) {
	return sm.storage.GetFileContent(ctx, storageKey)
}

func (sm *StorageManager) GenerateDownloadURL(ctx context.Context, metadata *FileMetadata) (string, error) {
	return sm.storage.GenerateDownloadURL(ctx, metadata, time.Hour)
}

func (sm *StorageManager) DeleteFile(ctx context.Context, metadata *FileMetadata) error {
	return sm.storage.DeleteFile(ctx, metadata)
}

// ListAllFiles returns all files in storage (embedded only for now)
func (sm *StorageManager) ListAllFiles(ctx context.Context) ([]map[string]interface{}, error) {
	// Only implemented for embedded storage
	if embedded, ok := sm.storage.(*EmbeddedStorage); ok {
		return embedded.ListAllFiles(ctx)
	}
	// S3 listing not implemented yet
	return []map[string]interface{}{}, nil
}

func generateFileID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}
