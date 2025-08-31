# Image Preview Feature

The FileManagementPanel now includes automatic image preview functionality for known image file types.

## Supported Image Formats

The image preview supports the following file types:
- **JPEG** (.jpg, .jpeg)
- **PNG** (.png)
- **GIF** (.gif)
- **WebP** (.webp)
- **BMP** (.bmp)
- **SVG** (.svg)
- **TIFF** (.tiff, .tif)

Detection is based on both MIME type (`image/*`) and file extension.

## How It Works

### Automatic Detection
- Files are automatically detected as images based on their MIME type or file extension
- A "Show Preview" button appears for all detected image files
- The preview is loaded on-demand when the user clicks the button

### Preview Display
- **Secure Loading**: Images are fetched with authentication headers
- **Loading State**: Shows a spinner while loading the image
- **Error Handling**: Displays helpful error messages if loading fails
- **Responsive Design**: Images scale to fit within a maximum height while maintaining aspect ratio
- **File Information**: Shows filename and file size overlays on the preview

### Memory Management
- Uses blob URLs for secure image display
- Automatically cleans up blob URLs when the component unmounts
- Revokes blob URLs when preview is hidden to prevent memory leaks

## User Interface

### Preview Button
- **Show Preview**: Eye icon with "Show Preview" text
- **Hide Preview**: Eye-slash icon with "Hide Preview" text
- Located below the file metadata, above the action buttons

### Preview Container
- **Border**: Rounded border matching the overall file panel design
- **Background**: Light background for better image contrast
- **Overlays**: 
  - Top-right: Filename with semi-transparent background
  - Bottom-left: File size with semi-transparent background
- **Styling**: Shadow and rounded corners for a polished look

## Error States

### Loading Errors
- **Network Issues**: "Failed to load image preview" message
- **Authentication Errors**: Handled gracefully with error display
- **Corrupted Files**: "The image may be corrupted or in an unsupported format"

### Unsupported Files
- Preview button only appears for supported image formats
- Non-image files continue to work with existing download/edit functionality

## Integration with Storage

### S3 Storage
- Works seamlessly with S3-stored images
- Fetches images through the authenticated API endpoint
- Handles S3 access permissions automatically

### Embedded Storage
- Works with locally stored images
- Uses the same authenticated endpoint for consistency
- Maintains security through token-based authentication

## Performance Considerations

### On-Demand Loading
- Images are only loaded when the user requests a preview
- No automatic loading prevents unnecessary bandwidth usage
- Blob URLs are created only when needed

### Memory Management
- Blob URLs are properly cleaned up to prevent memory leaks
- Component unmounting automatically revokes all blob URLs
- Toggling preview off immediately cleans up resources

## Usage Examples

### Basic Image File
1. Upload or view any image file in a configuration
2. Click "Show Preview" button below the file metadata
3. Image loads with filename and size information
4. Click "Hide Preview" to close and clean up resources

### Error Handling
1. If image fails to load, error message is displayed
2. User can still download the original file
3. Error state provides helpful context about the failure

### Large Images
1. Large images are automatically scaled to fit within the preview area
2. Aspect ratio is maintained to prevent distortion
3. File size information helps users understand why loading might be slow

## Technical Implementation

### Authentication
- All image requests include Bearer token authentication
- Maintains security for both S3 and embedded storage
- Handles token expiration gracefully

### Blob URL Management
```javascript
// Secure image loading
const response = await fetch(`/api/files/${storageKey}`, {
  headers: { 'Authorization': `Bearer ${token}` }
});
const blob = await response.blob();
const blobUrl = URL.createObjectURL(blob);

// Cleanup
URL.revokeObjectURL(blobUrl);
```

### React Lifecycle
- `useEffect` for cleanup on component unmount
- State management for loading, error, and preview states
- Proper async/await error handling

## Future Enhancements

### Potential Improvements
- **Thumbnail Generation**: Pre-generate thumbnails for faster preview
- **Zoom Functionality**: Allow users to zoom in on image details
- **Multiple Format Support**: Add support for more specialized image formats
- **Batch Preview**: Preview multiple images in a gallery view
- **Image Editing**: Basic image editing tools (crop, resize, etc.)

---

The image preview feature enhances the user experience by providing immediate visual feedback for image files while maintaining security and performance best practices.
