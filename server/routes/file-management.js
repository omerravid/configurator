const express = require("express");
const multer = require("multer");
const { authenticateToken } = require("../middleware/auth");
const FileStorageService = require("../services/FileStorageService");
const { Configuration } = require("../models");
const ConfigurationService = require("../services/ConfigurationService");

const router = express.Router();
const fs = require('fs').promises;
const path = require('path');

// Configure multer for single file upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Infinity, // No file size limit
  },
  fileFilter: (req, file, cb) => {
    // Accept all file types
    cb(null, true);
  }
});

// POST /api/file-management/upload - Upload a new file to a configuration
router.post("/upload", authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const { configId, propertyPath } = req.body;
    const file = req.file;

    console.log(`File upload request: configId=${configId}, propertyPath=${propertyPath}`);

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

    const fileStorage = new FileStorageService();

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
    // For nested paths, we need to build the proper nested structure
    const dataUpdate = {};
    setValueAtPath(dataUpdate, propertyPath, newFileObject);

    console.log(`Updating configuration ${configId} with file data:`, {
      propertyPath,
      dataUpdate: JSON.stringify(dataUpdate, null, 2),
      fileObject: JSON.stringify(newFileObject, null, 2)
    });

    await ConfigurationService.updateConfiguration(
      configId,
      {
        data: dataUpdate
      },
      "system" // Use system as updater for file uploads
    );

    console.log(`File upload completed: ${file.originalname} -> ${fileMetadata.fileId}`);

    res.json({
      success: true,
      message: `File "${file.originalname}" uploaded successfully`,
      metadata: newFileObject._metadata,
      downloadUrl: downloadUrl
    });

  } catch (error) {
    console.error("File upload error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to upload file",
      details: error.message
    });
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
    // For nested paths, we need to build the proper nested structure
    const dataUpdate = {};
    setValueAtPath(dataUpdate, propertyPath, newFileObject);

    await ConfigurationService.updateConfiguration(
      configId,
      {
        data: dataUpdate
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

// Helper function to set value at a specific path
function setValueAtPath(obj, path, value) {
  if (!path) {
    return obj;
  }

  const keys = path.split('.');
  let current = obj;

  // Navigate to the parent of the target key
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!current[key] || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key];
  }

  // Set the final value
  const finalKey = keys[keys.length - 1];
  current[finalKey] = value;

  return obj;
}

// GET /api/file-management/unreferenced - Find files not referenced in any configuration
router.get("/unreferenced", authenticateToken, async (req, res) => {
  try {
    console.log('Finding unreferenced files...');

    const fileStorage = new FileStorageService();

    // Get all stored files
    const allFiles = await getAllStoredFiles(fileStorage);
    console.log(`Found ${allFiles.length} total files in storage`);

    // Get all file references from configurations
    const referencedFiles = await getAllReferencedFiles();
    console.log(`Found ${referencedFiles.size} files referenced in configurations`);

    // Find unreferenced files
    const unreferencedFiles = allFiles.filter(file => !referencedFiles.has(file.storageKey));

    console.log(`Found ${unreferencedFiles.length} unreferenced files`);

    res.json({
      success: true,
      unreferencedFiles: unreferencedFiles.map(file => ({
        storageKey: file.storageKey,
        originalName: file.originalName,
        size: file.size,
        uploadDate: file.uploadDate,
        mimeType: file.mimeType
      })),
      totalFiles: allFiles.length,
      referencedFiles: referencedFiles.size,
      unreferencedCount: unreferencedFiles.length
    });

  } catch (error) {
    console.error('Failed to find unreferenced files:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to find unreferenced files'
    });
  }
});

// DELETE /api/file-management/unreferenced - Delete unreferenced files
router.delete("/unreferenced", authenticateToken, async (req, res) => {
  try {
    console.log('Deleting unreferenced files...');

    const fileStorage = new FileStorageService();

    // Get all stored files
    const allFiles = await getAllStoredFiles(fileStorage);
    console.log(`Found ${allFiles.length} total files in storage`);

    // Get all file references from configurations
    const referencedFiles = await getAllReferencedFiles();
    console.log(`Found ${referencedFiles.size} files referenced in configurations`);

    // Find unreferenced files
    const unreferencedFiles = allFiles.filter(file => !referencedFiles.has(file.storageKey));

    console.log(`Deleting ${unreferencedFiles.length} unreferenced files`);

    let deletedCount = 0;
    const errors = [];

    for (const file of unreferencedFiles) {
      try {
        await fileStorage.deleteFile({ storageKey: file.storageKey });
        deletedCount++;
        console.log(`Deleted unreferenced file: ${file.originalName} (${file.storageKey})`);
      } catch (error) {
        console.error(`Failed to delete file ${file.storageKey}:`, error);
        errors.push({
          storageKey: file.storageKey,
          originalName: file.originalName,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      message: `Successfully deleted ${deletedCount} unreferenced files`,
      deletedCount,
      totalCandidates: unreferencedFiles.length,
      errors
    });

  } catch (error) {
    console.error('Failed to delete unreferenced files:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete unreferenced files'
    });
  }
});

// Helper function to get all files from storage
async function getAllStoredFiles(fileStorage) {
  if (fileStorage.storageType === 'embedded') {
    const storageDir = fileStorage.embeddedStoragePath;

    try {
      const files = await fs.readdir(storageDir);
      const fileList = [];

      // Process metadata files
      for (const fileName of files) {
        if (fileName.endsWith('.meta.json')) {
          try {
            const metaFilePath = path.join(storageDir, fileName);
            const metaData = JSON.parse(await fs.readFile(metaFilePath, 'utf8'));
            const actualFileName = fileName.replace('.meta.json', '');
            const actualFilePath = path.join(storageDir, actualFileName);

            // Check if actual file exists
            try {
              await fs.access(actualFilePath);
              fileList.push({
                storageKey: metaData.storageKey || actualFileName,
                originalName: metaData.originalName,
                mimeType: metaData.mimeType,
                size: metaData.size,
                uploadDate: metaData.uploadDate,
                fileName: actualFileName
              });
            } catch (fileError) {
              console.warn(`File ${actualFileName} metadata exists but file missing`);
            }
          } catch (error) {
            console.warn(`Error reading metadata file ${fileName}:`, error.message);
          }
        }
      }

      return fileList;
    } catch (error) {
      console.warn('Error accessing storage directory:', error.message);
      return [];
    }
  } else {
    // TODO: Implement S3 file listing if needed
    console.warn('S3 unreferenced file cleanup not yet implemented');
    return [];
  }
}

// Helper function to get all file references from configurations
async function getAllReferencedFiles() {
  const referencedFiles = new Set();

  try {
    const configurations = await Configuration.findAll();

    for (const config of configurations) {
      if (config.data) {
        findFileReferences(config.data, referencedFiles);
      }
    }
  } catch (error) {
    console.error('Error getting configurations:', error);
  }

  return referencedFiles;
}

// Recursive function to find file references in configuration data
function findFileReferences(obj, referencedFiles) {
  if (typeof obj !== 'object' || obj === null) {
    return;
  }

  if (Array.isArray(obj)) {
    for (const item of obj) {
      findFileReferences(item, referencedFiles);
    }
  } else {
    // Check if this is a file object
    if (obj._type === 'file' && obj._metadata && obj._metadata.storageKey) {
      referencedFiles.add(obj._metadata.storageKey);
    }

    // Recursively check all properties
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        findFileReferences(obj[key], referencedFiles);
      }
    }
  }
}

module.exports = router;
