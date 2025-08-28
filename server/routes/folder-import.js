const express = require("express");
const multer = require("multer");
const { authenticateToken } = require("../middleware/auth");
const FileStorageService = require("../services/FileStorageService");

const router = express.Router();

// Configure multer for memory storage (process files in memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
    files: 1000, // Max 1000 files per request (increased from 100)
    fieldSize: 10 * 1024 * 1024 // 10MB field size limit
  },
  fileFilter: (req, file, cb) => {
    // Accept all file types for now
    cb(null, true);
  }
});

// POST /api/folder-import - Import folder with JSON and binary files
router.post("/", authenticateToken, upload.array('files'), async (req, res) => {
  try {
    const files = req.files;
    const { folderName } = req.body;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const fileStorage = new FileStorageService();
    const result = await processFolderImport(files, folderName, fileStorage);

    res.json({
      success: true,
      message: `Successfully processed ${result.totalFiles} files (${result.jsonFiles} JSON, ${result.binaryFiles} binary)`,
      data: result.structure,
      stats: {
        totalFiles: result.totalFiles,
        jsonFiles: result.jsonFiles,
        binaryFiles: result.binaryFiles,
        errors: result.errors.length,
        errorDetails: result.errors
      }
    });

  } catch (error) {
    console.error("Folder import error:", error);
    res.status(500).json({ 
      success: false,
      error: "Failed to import folder",
      details: error.message 
    });
  }
});

/**
 * Process folder import with both JSON and binary files
 * @param {Array} files - Array of uploaded files
 * @param {string} folderName - Name of the root folder
 * @param {FileStorageService} fileStorage - File storage service instance
 * @returns {Object} Processing result with structure and stats
 */
async function processFolderImport(files, folderName, fileStorage) {
  const structure = {};
  const errors = [];
  let jsonFiles = 0;
  let binaryFiles = 0;

  for (const file of files) {
    try {
      // Parse the file path to understand folder structure
      const relativePath = file.originalname;
      const pathParts = relativePath.split('/').filter(part => part.length > 0);

      if (pathParts.length === 0) {
        errors.push({ file: file.originalname, error: 'Invalid file path' });
        continue;
      }

      // Build nested structure
      let currentLevel = structure;

      // Process folders (all parts except the last one which is the file)
      for (let i = 0; i < pathParts.length - 1; i++) {
        const folderName = pathParts[i];
        if (!currentLevel[folderName]) {
          currentLevel[folderName] = {};
        }
        currentLevel = currentLevel[folderName];
      }

      // Process the file
      const fileName = pathParts[pathParts.length - 1];
      const fileExtension = getFileExtension(fileName);
      const isJsonFile = fileExtension === '.json';

      if (isJsonFile) {
        // Handle JSON file
        try {
          const fileContent = file.buffer.toString('utf8');
          const jsonContent = JSON.parse(fileContent);
          
          // Remove .json extension from property name
          const propertyName = fileName.replace(/\.json$/i, '');
          currentLevel[propertyName] = jsonContent;
          jsonFiles++;
        } catch (parseError) {
          errors.push({ 
            file: file.originalname, 
            error: `JSON parse error: ${parseError.message}` 
          });
        }
      } else {
        // Handle binary file
        try {
          const fileMetadata = await fileStorage.storeFile(
            file.buffer,
            fileName,
            file.mimetype || 'application/octet-stream'
          );

          // Generate download URL
          const downloadUrl = await fileStorage.generateDownloadUrl(fileMetadata);

          // Store file reference in structure (filename without extension as property name)
          const propertyName = getFileNameWithoutExtension(fileName);
          currentLevel[propertyName] = {
            _type: 'file',
            _metadata: {
              originalName: fileName,
              mimeType: file.mimetype || 'application/octet-stream',
              size: file.size,
              storageKey: fileMetadata.fileId,
              storageType: fileMetadata.storageType
            },
            _link: downloadUrl
          };
          binaryFiles++;
        } catch (storageError) {
          errors.push({ 
            file: file.originalname, 
            error: `Storage error: ${storageError.message}` 
          });
        }
      }

    } catch (error) {
      errors.push({ 
        file: file.originalname, 
        error: error.message 
      });
    }
  }

  return {
    structure,
    totalFiles: files.length,
    jsonFiles,
    binaryFiles,
    errors
  };
}

/**
 * Get file extension
 */
function getFileExtension(filename) {
  const lastDotIndex = filename.lastIndexOf('.');
  return lastDotIndex === -1 ? '' : filename.substring(lastDotIndex).toLowerCase();
}

/**
 * Get filename without extension
 */
function getFileNameWithoutExtension(filename) {
  const lastDotIndex = filename.lastIndexOf('.');
  return lastDotIndex === -1 ? filename : filename.substring(0, lastDotIndex);
}

module.exports = router;
