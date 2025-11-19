package files

import (
	"context"
	"fmt"
)

// FixFileURLs recursively processes configuration data and regenerates download URLs for file objects
// This ensures file URLs are correct for the current deployment environment
func FixFileURLs(ctx context.Context, storage *StorageManager, data interface{}) (interface{}, error) {
	if data == nil {
		return nil, nil
	}

	switch v := data.(type) {
	case map[string]interface{}:
		// Check if this is a file object
		if v["_type"] == "file" {
			metadata, hasMetadata := v["_metadata"].(map[string]interface{})
			if hasMetadata {
				storageKey, hasKey := metadata["storageKey"].(string)
				if hasKey {
					// This is a file object - regenerate the download URL
					fileMeta := &FileMetadata{
						StorageKey: storageKey,
					}
					
					// Copy other metadata fields if present
					if originalName, ok := metadata["originalName"].(string); ok {
						fileMeta.OriginalName = originalName
					}
					if mimeType, ok := metadata["mimeType"].(string); ok {
						fileMeta.MimeType = mimeType
					}
					if size, ok := metadata["size"].(float64); ok {
						fileMeta.Size = int64(size)
					} else if size, ok := metadata["size"].(int64); ok {
						fileMeta.Size = size
					}
					if storageType, ok := metadata["storageType"].(string); ok {
						fileMeta.StorageType = StorageType(storageType)
					}

					// Generate new download URL
					newURL, err := storage.GenerateDownloadURL(ctx, fileMeta)
					if err != nil {
						fmt.Printf("Warning: Failed to regenerate URL for file %s: %v\n", storageKey, err)
						// Return original value if URL generation fails
						return v, nil
					}

					// Create new file object with updated URL
					result := make(map[string]interface{})
					for k, val := range v {
						result[k] = val
					}
					result["_link"] = newURL
					return result, nil
				}
			}
		}

		// Regular object - process all properties recursively
		result := make(map[string]interface{})
		for key, val := range v {
			processed, err := FixFileURLs(ctx, storage, val)
			if err != nil {
				return nil, err
			}
			result[key] = processed
		}
		return result, nil

	case []interface{}:
		// Process each element in array
		result := make([]interface{}, len(v))
		for i, item := range v {
			processed, err := FixFileURLs(ctx, storage, item)
			if err != nil {
				return nil, err
			}
			result[i] = processed
		}
		return result, nil

	default:
		// Primitive value - return as is
		return v, nil
	}
}

