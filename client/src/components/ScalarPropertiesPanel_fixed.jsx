// This is a temporary file to fix the syntax error in the file upload
// The issue is on line 1536 where literal \n characters are breaking the JavaScript

// Here's the corrected try block:
try {
  // Handle root path correctly - don't add dot prefix if at root
  const propertyPath = selectedPath === "root" ? newFileName : `${selectedPath.replace(/^root\./, "")}.${newFileName}`;
  const response = await configAPI.replaceFile(selectedConfig?.id, propertyPath, selectedFile);

  if (response.data.success) {
    showToast(`File "${selectedFile.name}" uploaded successfully`, "success");

    // Create file object structure
    const fileObject = {
      _type: "file",
      _metadata: response.data.metadata,
      _link: response.data.downloadUrl
    };

    // Add the file property to the configuration
    onPropertyAdd?.(selectedPath, newFileName, fileObject);

    setNewFileName("");
    setSelectedFile(null);
    setShowFileUpload(false);
  } else {
    showToast(`Failed to upload file: ${response.data.error}`, "error");
  }
} catch (error) {
  console.error('File upload error:', error);
  showToast(`Failed to upload file: ${error.message}`, "error");
}
