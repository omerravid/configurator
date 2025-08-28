const express = require("express");
const multer = require("multer");
const { authenticateToken } = require("../middleware/auth");
const FileStorageService = require("../services/FileStorageService");
const { Configuration } = require("../models");
const ConfigurationService = require("../services/ConfigurationService");

const router = express.Router();

// Configure multer for single file upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Accept all file types
    cb(null, true);
  }
});

// POST /api/file-management/replace - Replace a file in a configuration
router.post("/replace", authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const { configId, propertyPath } = req.body;
    const file = req.file;

    console.log(`File replacement request: configId=${configId}, propertyPath=${propertyPath}`);

    if (!file) {
      return res.status(400).json({ 
        success: false,
        error: 'No file uploaded' 
      });
    }

    if (!configId || !propertyPath) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing configId or propertyPath' 
      });
    }

    // Get the current configuration
    const config = await Configuration.findById(configId);
    if (!config) {
      return res.status(404).json({ 
        success: false,
        error: 'Configuration not found' 
      });
    }

    // Get the current value at the property path to find the old file
    const resolved = await ConfigurationService.resolveConfiguration(configId, false);
    const currentValue = getValueAtPath(resolved.resolved, propertyPath);

    // Check if current value is a file object
    if (!currentValue || currentValue._type !== 'file') {
      return res.status(400).json({ 
        success: false,
        error: 'Property is not a file object' 
      });
    }

    const fileStorage = new FileStorageService();

    // Delete the old file if it exists
    if (currentValue._metadata && currentValue._metadata.storageKey) {
      try {
        await fileStorage.deleteFile(currentValue._metadata);
        console.log('Deleted old file:', currentValue._metadata.storageKey);
      } catch (error) {
        console.warn('Failed to delete old file:', error.message);
        // Continue with replacement even if old file deletion fails
      }
    }

    // Store the new file
    const fileMetadata = await fileStorage.storeFile(
      file.buffer,
      file.originalname,
      file.mimetype || 'application/octet-stream'
    );

    // Generate download URL
    const downloadUrl = await fileStorage.generateDownloadUrl(fileMetadata);

    // Create new file object
    const newFileObject = {
      _type: 'file',
      _metadata: {
        originalName: file.originalname,
        mimeType: file.mimetype || 'application/octet-stream',
        size: file.size,
        storageKey: fileMetadata.fileId,
        storageType: fileMetadata.storageType
      },
      _link: downloadUrl
    };

    // Update the configuration with the new file object
    await ConfigurationService.updateConfiguration(
      configId, 
      { 
        data: { 
          [propertyPath]: newFileObject 
        } 
      },
      "system" // Use system as updater for file replacements
    );

    console.log(`File replacement completed: ${file.originalname} -> ${fileMetadata.fileId}`);

    res.json({
      success: true,
      message: `File "${file.originalname}" uploaded successfully`,
      fileData: newFileObject
    });

  } catch (error) {
    console.error("File replacement error:", error);
    res.status(500).json({ 
      success: false,
      error: "Failed to replace file",
      details: error.message 
    });
  }
});

// Helper function to get value at a specific path
function getValueAtPath(obj, path) {
  if (!obj || !path) return obj;

  const keys = path.split('.');
  let current = obj;

  for (const key of keys) {
    if (current && typeof current === 'object' && current.hasOwnProperty(key)) {
      current = current[key];
    } else {
      return null;
    }
  }

  return current;
}

module.exports = router;
