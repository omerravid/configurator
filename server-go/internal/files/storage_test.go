package files

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"your.module/config-manager/internal/config"
)

// Tests for file storage service - both embedded and S3 storage

// ========== Embedded Storage Tests ==========

func setupEmbeddedStorage(t *testing.T) (*EmbeddedStorage, string, func()) {
	t.Helper()

	tempDir := t.TempDir()

	cfg := config.Config{
		EmbeddedPath:  tempDir,
		ServerBaseURL: "http://localhost:3004",
	}

	storage := NewEmbeddedStorage(cfg)

	cleanup := func() {
		// TempDir is automatically cleaned up
	}

	return storage, tempDir, cleanup
}

func TestNewEmbeddedStorage_CreatesStorage_WithCorrectConfig(t *testing.T) {
	// Arrange
	cfg := config.Config{
		EmbeddedPath:  "/data/files",
		ServerBaseURL: "http://example.com",
	}

	// Act
	storage := NewEmbeddedStorage(cfg)

	// Assert
	assert.NotNil(t, storage)
	assert.Equal(t, "/data/files", storage.basePath)
	assert.Equal(t, "http://example.com", storage.baseURL)
}

func TestNewEmbeddedStorage_NoBaseURL_UsesDefault(t *testing.T) {
	// Arrange
	cfg := config.Config{
		EmbeddedPath:  "/data/files",
		ServerBaseURL: "",
	}

	// Act
	storage := NewEmbeddedStorage(cfg)

	// Assert
	assert.Equal(t, "http://localhost:3004", storage.baseURL)
}

func TestEmbeddedStorage_StoreFile_CreatesFileSuccessfully(t *testing.T) {
	// Arrange
	storage, tempDir, cleanup := setupEmbeddedStorage(t)
	defer cleanup()

	ctx := context.Background()
	testData := []byte("test file content")
	filename := "test.txt"
	mimeType := "text/plain"

	// Act
	metadata, err := storage.StoreFile(ctx, testData, filename, mimeType)

	// Assert
	require.NoError(t, err)
	assert.NotNil(t, metadata)
	assert.NotEmpty(t, metadata.FileID)
	assert.Equal(t, filename, metadata.OriginalName)
	assert.Equal(t, mimeType, metadata.MimeType)
	assert.Equal(t, int64(len(testData)), metadata.Size)
	assert.Equal(t, StorageEmbedded, metadata.StorageType)
	assert.NotEmpty(t, metadata.StorageKey)

	// Verify file was actually created
	filePath := filepath.Join(tempDir, metadata.StorageKey)
	storedData, err := os.ReadFile(filePath)
	require.NoError(t, err)
	assert.Equal(t, testData, storedData)

	// Verify metadata file was created
	metaPath := filePath + ".meta.json"
	_, err = os.Stat(metaPath)
	assert.NoError(t, err)
}

func TestEmbeddedStorage_StoreFile_PreservesFileExtension(t *testing.T) {
	// Arrange
	storage, _, cleanup := setupEmbeddedStorage(t)
	defer cleanup()

	tests := []struct {
		name        string
		filename    string
		expectedExt string
	}{
		{"text file", "document.txt", ".txt"},
		{"image file", "photo.jpg", ".jpg"},
		{"no extension", "readme", ""},
		{"multiple dots", "file.tar.gz", ".gz"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Act
			metadata, err := storage.StoreFile(context.Background(), []byte("test"), tt.filename, "application/octet-stream")

			// Assert
			require.NoError(t, err)
			assert.Contains(t, metadata.StorageKey, tt.expectedExt)
		})
	}
}

func TestEmbeddedStorage_StoreFile_GeneratesUniqueKeys(t *testing.T) {
	// Arrange
	storage, _, cleanup := setupEmbeddedStorage(t)
	defer cleanup()

	ctx := context.Background()

	// Act - Store multiple files with same name
	meta1, err1 := storage.StoreFile(ctx, []byte("data1"), "file.txt", "text/plain")
	meta2, err2 := storage.StoreFile(ctx, []byte("data2"), "file.txt", "text/plain")
	meta3, err3 := storage.StoreFile(ctx, []byte("data3"), "file.txt", "text/plain")

	// Assert
	require.NoError(t, err1)
	require.NoError(t, err2)
	require.NoError(t, err3)

	// All storage keys should be unique
	assert.NotEqual(t, meta1.StorageKey, meta2.StorageKey)
	assert.NotEqual(t, meta2.StorageKey, meta3.StorageKey)
	assert.NotEqual(t, meta1.StorageKey, meta3.StorageKey)
}

func TestEmbeddedStorage_StoreFile_HandlesLargeFiles(t *testing.T) {
	// Arrange
	storage, _, cleanup := setupEmbeddedStorage(t)
	defer cleanup()

	ctx := context.Background()

	// Create a 1MB file
	largeData := make([]byte, 1024*1024)
	for i := range largeData {
		largeData[i] = byte(i % 256)
	}

	// Act
	metadata, err := storage.StoreFile(ctx, largeData, "large.bin", "application/octet-stream")

	// Assert
	require.NoError(t, err)
	assert.Equal(t, int64(1024*1024), metadata.Size)
}

func TestEmbeddedStorage_GetFileContent_RetrievesFileSuccessfully(t *testing.T) {
	// Arrange
	storage, _, cleanup := setupEmbeddedStorage(t)
	defer cleanup()

	ctx := context.Background()
	originalData := []byte("original content")
	metadata, err := storage.StoreFile(ctx, originalData, "test.txt", "text/plain")
	require.NoError(t, err)

	// Act
	retrievedData, retrievedMeta, err := storage.GetFileContent(ctx, metadata.StorageKey)

	// Assert
	require.NoError(t, err)
	assert.Equal(t, originalData, retrievedData)
	assert.NotNil(t, retrievedMeta)
	assert.Equal(t, metadata.StorageKey, retrievedMeta.StorageKey)
	assert.Equal(t, StorageEmbedded, retrievedMeta.StorageType)
}

func TestEmbeddedStorage_GetFileContent_NonExistentFile_ReturnsError(t *testing.T) {
	// Arrange
	storage, _, cleanup := setupEmbeddedStorage(t)
	defer cleanup()

	ctx := context.Background()

	// Act
	data, metadata, err := storage.GetFileContent(ctx, "nonexistent.txt")

	// Assert
	assert.Error(t, err)
	assert.Nil(t, data)
	assert.Nil(t, metadata)
}

func TestEmbeddedStorage_GenerateDownloadURL_ReturnsCorrectURL(t *testing.T) {
	// Arrange
	storage, _, cleanup := setupEmbeddedStorage(t)
	defer cleanup()

	ctx := context.Background()
	metadata := &FileMetadata{
		StorageKey:  "abc123.txt",
		StorageType: StorageEmbedded,
	}

	// Act
	url, err := storage.GenerateDownloadURL(ctx, metadata, 1*time.Hour)

	// Assert
	require.NoError(t, err)
	assert.Equal(t, "http://localhost:3004/api/files/abc123.txt", url)
}

func TestEmbeddedStorage_GenerateDownloadURL_UsesConfiguredBaseURL(t *testing.T) {
	// Arrange
	cfg := config.Config{
		EmbeddedPath:  "/data",
		ServerBaseURL: "https://api.example.com",
	}
	storage := NewEmbeddedStorage(cfg)

	ctx := context.Background()
	metadata := &FileMetadata{
		StorageKey: "test.txt",
	}

	// Act
	url, err := storage.GenerateDownloadURL(ctx, metadata, 1*time.Hour)

	// Assert
	require.NoError(t, err)
	assert.Equal(t, "https://api.example.com/api/files/test.txt", url)
}

func TestEmbeddedStorage_DeleteFile_RemovesFileAndMetadata(t *testing.T) {
	// Arrange
	storage, tempDir, cleanup := setupEmbeddedStorage(t)
	defer cleanup()

	ctx := context.Background()

	// Store a file
	metadata, err := storage.StoreFile(ctx, []byte("test"), "test.txt", "text/plain")
	require.NoError(t, err)

	filePath := filepath.Join(tempDir, metadata.StorageKey)
	metaPath := filePath + ".meta.json"

	// Verify file and metadata exist
	_, err = os.Stat(filePath)
	require.NoError(t, err)
	_, err = os.Stat(metaPath)
	require.NoError(t, err)

	// Act
	err = storage.DeleteFile(ctx, metadata)

	// Assert
	require.NoError(t, err)

	// Verify file is deleted
	_, err = os.Stat(filePath)
	assert.True(t, os.IsNotExist(err))

	// Verify metadata is deleted
	_, err = os.Stat(metaPath)
	assert.True(t, os.IsNotExist(err))
}

func TestEmbeddedStorage_DeleteFile_NonExistentFile_NoError(t *testing.T) {
	// Arrange
	storage, _, cleanup := setupEmbeddedStorage(t)
	defer cleanup()

	ctx := context.Background()
	metadata := &FileMetadata{
		StorageKey: "nonexistent.txt",
	}

	// Act
	err := storage.DeleteFile(ctx, metadata)

	// Assert
	// Should not error even if file doesn't exist
	assert.NoError(t, err)
}

func TestEmbeddedStorage_ListAllFiles_EmptyStorage_ReturnsEmpty(t *testing.T) {
	// Arrange
	storage, _, cleanup := setupEmbeddedStorage(t)
	defer cleanup()

	ctx := context.Background()

	// Act
	files, err := storage.ListAllFiles(ctx)

	// Assert
	require.NoError(t, err)
	assert.Empty(t, files)
}

func TestEmbeddedStorage_ListAllFiles_WithFiles_ReturnsList(t *testing.T) {
	// Arrange
	storage, _, cleanup := setupEmbeddedStorage(t)
	defer cleanup()

	ctx := context.Background()

	// Store multiple files
	testFiles := []struct {
		name     string
		content  string
		mimeType string
	}{
		{"file1.txt", "content1", "text/plain"},
		{"file2.jpg", "image data", "image/jpeg"},
		{"file3.pdf", "pdf data", "application/pdf"},
	}

	for _, tf := range testFiles {
		_, err := storage.StoreFile(ctx, []byte(tf.content), tf.name, tf.mimeType)
		require.NoError(t, err)
	}

	// Act
	files, err := storage.ListAllFiles(ctx)

	// Assert
	require.NoError(t, err)
	assert.Len(t, files, 3)

	// Verify each file has expected fields
	for _, file := range files {
		assert.NotEmpty(t, file["storageKey"])
		assert.NotEmpty(t, file["originalName"])
		assert.NotEmpty(t, file["mimeType"])
		assert.NotZero(t, file["size"])
	}
}

func TestEmbeddedStorage_CompleteWorkflow_StoreRetrieveDelete(t *testing.T) {
	// Arrange
	storage, _, cleanup := setupEmbeddedStorage(t)
	defer cleanup()

	ctx := context.Background()
	testData := []byte("workflow test data")
	filename := "workflow.txt"

	// Step 1: Store file
	metadata, err := storage.StoreFile(ctx, testData, filename, "text/plain")
	require.NoError(t, err)
	assert.NotEmpty(t, metadata.StorageKey)

	// Step 2: List files (should have 1)
	files, err := storage.ListAllFiles(ctx)
	require.NoError(t, err)
	assert.Len(t, files, 1)

	// Step 3: Retrieve file
	retrievedData, retrievedMeta, err := storage.GetFileContent(ctx, metadata.StorageKey)
	require.NoError(t, err)
	assert.Equal(t, testData, retrievedData)
	assert.NotNil(t, retrievedMeta)

	// Step 4: Generate download URL
	url, err := storage.GenerateDownloadURL(ctx, metadata, 1*time.Hour)
	require.NoError(t, err)
	assert.Contains(t, url, metadata.StorageKey)

	// Step 5: Delete file
	err = storage.DeleteFile(ctx, metadata)
	require.NoError(t, err)

	// Step 6: List files again (should be empty)
	files, err = storage.ListAllFiles(ctx)
	require.NoError(t, err)
	assert.Empty(t, files)

	// Step 7: Try to retrieve deleted file (should fail)
	_, _, err = storage.GetFileContent(ctx, metadata.StorageKey)
	assert.Error(t, err)
}

func TestEmbeddedStorage_SpecialCharactersInFilename_HandlesCorrectly(t *testing.T) {
	// Arrange
	storage, _, cleanup := setupEmbeddedStorage(t)
	defer cleanup()

	tests := []struct {
		name     string
		filename string
	}{
		{"spaces", "file with spaces.txt"},
		{"special chars", "file-with-special_chars.txt"},
		{"unicode", "файл.txt"},
		{"numbers", "123456.dat"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Act
			metadata, err := storage.StoreFile(context.Background(), []byte("test"), tt.filename, "text/plain")

			// Assert
			require.NoError(t, err)
			assert.Equal(t, tt.filename, metadata.OriginalName)
			assert.NotEmpty(t, metadata.StorageKey)
		})
	}
}

func TestEmbeddedStorage_BinaryFiles_HandlesCorrectly(t *testing.T) {
	// Arrange
	storage, _, cleanup := setupEmbeddedStorage(t)
	defer cleanup()

	ctx := context.Background()

	// Create binary data (image-like)
	binaryData := []byte{0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46}

	// Act
	metadata, err := storage.StoreFile(ctx, binaryData, "image.jpg", "image/jpeg")

	// Assert
	require.NoError(t, err)

	// Retrieve and verify
	retrievedData, _, err := storage.GetFileContent(ctx, metadata.StorageKey)
	require.NoError(t, err)
	assert.Equal(t, binaryData, retrievedData)
}

func TestEmbeddedStorage_EmptyFile_HandlesCorrectly(t *testing.T) {
	// Arrange
	storage, _, cleanup := setupEmbeddedStorage(t)
	defer cleanup()

	ctx := context.Background()
	emptyData := []byte{}

	// Act
	metadata, err := storage.StoreFile(ctx, emptyData, "empty.txt", "text/plain")

	// Assert
	require.NoError(t, err)
	assert.Equal(t, int64(0), metadata.Size)

	// Retrieve
	retrievedData, _, err := storage.GetFileContent(ctx, metadata.StorageKey)
	require.NoError(t, err)
	assert.Empty(t, retrievedData)
}

func TestEmbeddedStorage_ConcurrentStores_AllSucceed(t *testing.T) {
	// Arrange
	storage, _, cleanup := setupEmbeddedStorage(t)
	defer cleanup()

	ctx := context.Background()
	numGoroutines := 10

	// Act - Store files concurrently
	results := make(chan error, numGoroutines)
	for i := 0; i < numGoroutines; i++ {
		go func(index int) {
			_, err := storage.StoreFile(ctx, []byte("concurrent data"), "file.txt", "text/plain")
			results <- err
		}(i)
	}

	// Assert - All should succeed
	for i := 0; i < numGoroutines; i++ {
		err := <-results
		assert.NoError(t, err)
	}

	// Verify all files were created
	files, err := storage.ListAllFiles(ctx)
	require.NoError(t, err)
	assert.Len(t, files, numGoroutines)
}

func TestGenerateFileID_CreatesUniqueIDs(t *testing.T) {
	// Act - Generate multiple IDs
	ids := make(map[string]bool)
	for i := 0; i < 100; i++ {
		id := generateFileID()

		// Assert - Should be unique
		assert.False(t, ids[id], "Duplicate ID generated: %s", id)
		ids[id] = true

		// Should be hex string
		assert.NotEmpty(t, id)
		assert.Len(t, id, 32) // 16 bytes = 32 hex chars
	}
}

func TestFileMetadata_AllFields_PopulatedCorrectly(t *testing.T) {
	// Arrange
	storage, _, cleanup := setupEmbeddedStorage(t)
	defer cleanup()

	ctx := context.Background()
	testData := []byte("test content")
	filename := "test.txt"
	mimeType := "text/plain"

	beforeStore := time.Now()

	// Act
	metadata, err := storage.StoreFile(ctx, testData, filename, mimeType)

	// Assert
	require.NoError(t, err)

	assert.NotEmpty(t, metadata.FileID)
	assert.Equal(t, filename, metadata.OriginalName)
	assert.Equal(t, mimeType, metadata.MimeType)
	assert.Equal(t, int64(len(testData)), metadata.Size)
	assert.Equal(t, StorageEmbedded, metadata.StorageType)
	assert.NotEmpty(t, metadata.StorageKey)
	assert.NotEmpty(t, metadata.FilePath)
	assert.False(t, metadata.UploadDate.Before(beforeStore))
	assert.True(t, metadata.UploadDate.Before(time.Now().Add(1*time.Second)))
}

// Note: S3 storage tests would require actual AWS credentials or mocking
// These are examples of how you might structure them

func TestS3Storage_Integration_RequiresAWSCredentials(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping S3 integration test in short mode")
	}

	// This would require actual AWS setup
	t.Skip("S3 integration tests require AWS credentials and configuration")

	// Example structure:
	// storage := NewS3Storage(cfg)
	// metadata, err := storage.StoreFile(ctx, data, filename, mimeType)
	// assert.NoError(t, err)
}








