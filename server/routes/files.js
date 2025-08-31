const express = require("express");
const { authenticateTokenOrApiKey } = require("../middleware/auth");
const FileStorageService = require("../services/FileStorageService");

const router = express.Router();
const fileStorage = new FileStorageService();

// GET /api/files/:storageKey - Serve file from embedded storage
router.get("/:storageKey", authenticateTokenOrApiKey, async (req, res) => {
  try {
    const { storageKey } = req.params;
    
    // Only serve from embedded storage
    if (fileStorage.storageType !== 'embedded') {
      return res.status(400).json({ 
        error: "This endpoint only serves embedded storage files" 
      });
    }

    const { content, metadata } = await fileStorage.getFileContent(storageKey);

    // Set appropriate headers
    res.set({
      'Content-Type': metadata.mimeType,
      'Content-Length': content.length,
      'Content-Disposition': `attachment; filename="${metadata.originalName}"`,
      'Cache-Control': 'private, max-age=3600' // Cache for 1 hour
    });

    res.send(content);
  } catch (error) {
    console.error("File serving error:", error);
    
    if (error.message.includes('File not found')) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    res.status(500).json({ error: 'Failed to serve file' });
  }
});

// GET /api/files/:storageKey/info - Get file metadata
router.get("/:storageKey/info", authenticateToken, async (req, res) => {
  try {
    const { storageKey } = req.params;
    
    if (fileStorage.storageType === 'embedded') {
      const { metadata } = await fileStorage.getFileContent(storageKey);
      
      res.json({
        success: true,
        metadata: {
          ...metadata,
          downloadUrl: fileStorage.generateEmbeddedDownloadUrl({ storageKey })
        }
      });
    } else {
      // For S3, we would need to store metadata separately or retrieve from S3
      res.status(501).json({ 
        error: "Metadata retrieval for S3 files not implemented in this endpoint" 
      });
    }
  } catch (error) {
    console.error("File metadata error:", error);
    
    if (error.message.includes('File not found')) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    res.status(500).json({ error: 'Failed to get file metadata' });
  }
});

module.exports = router;
