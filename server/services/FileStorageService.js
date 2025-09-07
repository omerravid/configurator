const fs = require('fs').promises;
const path = require('path');
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');

class FileStorageService {
  constructor() {
    this.storageType = process.env.STORAGE_TYPE || 'embedded';
    this.embeddedStoragePath = path.join(__dirname, '../storage/files');
    this.s3Client = null;
    this.s3BucketName = process.env.S3_BUCKET_NAME;
    
    this.initializeStorage();
  }

  async initializeStorage() {
    if (this.storageType === 's3') {
      this.s3Client = new S3Client({
        region: process.env.AWS_REGION || 'us-east-1',
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
      });
    } else {
      // Ensure embedded storage directory exists
      try {
        await fs.mkdir(this.embeddedStoragePath, { recursive: true });
      } catch (error) {
        console.warn('Could not create embedded storage directory:', error.message);
      }
    }
  }

  /**
   * Generate a unique file ID
   */
  generateFileId() {
    return crypto.randomUUID();
  }

  /**
   * Get file extension from filename
   */
  getFileExtension(filename) {
    return path.extname(filename).toLowerCase();
  }

  /**
   * Store a file and return metadata
   * @param {Buffer} fileBuffer - File content as buffer
   * @param {string} filename - Original filename
   * @param {string} mimeType - MIME type of the file
   * @returns {Object} File metadata with storage information
   */
  async storeFile(fileBuffer, filename, mimeType) {
    const fileId = this.generateFileId();
    const extension = this.getFileExtension(filename);
    const storageKey = `${fileId}${extension}`;
    
    if (this.storageType === 's3') {
      return await this.storeFileS3(fileBuffer, storageKey, filename, mimeType);
    } else {
      return await this.storeFileEmbedded(fileBuffer, storageKey, filename, mimeType);
    }
  }

  /**
   * Store file in S3
   */
  async storeFileS3(fileBuffer, storageKey, filename, mimeType) {
    if (!this.s3Client || !this.s3BucketName) {
      throw new Error('S3 storage not properly configured');
    }

    try {
      const command = new PutObjectCommand({
        Bucket: this.s3BucketName,
        Key: storageKey,
        Body: fileBuffer,
        ContentType: mimeType,
        Metadata: {
          originalName: filename,
          uploadDate: new Date().toISOString()
        }
      });

      await this.s3Client.send(command);

      return {
        fileId: storageKey,
        originalName: filename,
        mimeType: mimeType,
        size: fileBuffer.length,
        storageType: 's3',
        storageKey: storageKey,
        bucketName: this.s3BucketName,
        region: process.env.AWS_REGION || 'us-east-1'
      };
    } catch (error) {
      throw new Error(`Failed to store file in S3: ${error.message}`);
    }
  }

  /**
   * Store file in embedded storage
   */
  async storeFileEmbedded(fileBuffer, storageKey, filename, mimeType) {
    try {
      const filePath = path.join(this.embeddedStoragePath, storageKey);
      
      await fs.writeFile(filePath, fileBuffer);

      // Store metadata separately
      const metadataPath = path.join(this.embeddedStoragePath, `${storageKey}.meta.json`);
      const metadata = {
        originalName: filename,
        mimeType: mimeType,
        size: fileBuffer.length,
        uploadDate: new Date().toISOString(),
        storageKey: storageKey
      };
      
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

      return {
        fileId: storageKey,
        originalName: filename,
        mimeType: mimeType,
        size: fileBuffer.length,
        storageType: 'embedded',
        storageKey: storageKey,
        filePath: filePath
      };
    } catch (error) {
      throw new Error(`Failed to store file in embedded storage: ${error.message}`);
    }
  }

  /**
   * Generate a download URL for a file
   * @param {Object} fileMetadata - File metadata object
   * @param {number} expiresIn - URL expiration time in seconds (default: 1 hour)
   * @returns {string} Download URL
   */
  async generateDownloadUrl(fileMetadata, expiresIn = 3600) {
    if (fileMetadata.storageType === 's3') {
      return await this.generateS3DownloadUrl(fileMetadata, expiresIn);
    } else {
      return this.generateEmbeddedDownloadUrl(fileMetadata);
    }
  }

  /**
   * Generate S3 presigned URL
   */
  async generateS3DownloadUrl(fileMetadata, expiresIn) {
    if (!this.s3Client) {
      throw new Error('S3 storage not configured');
    }

    try {
      const command = new GetObjectCommand({
        Bucket: fileMetadata.bucketName || this.s3BucketName,
        Key: fileMetadata.storageKey
      });

      const url = await getSignedUrl(this.s3Client, command, {
        expiresIn: expiresIn
      });

      return url;
    } catch (error) {
      throw new Error(`Failed to generate S3 download URL: ${error.message}`);
    }
  }

  /**
   * Generate embedded storage download URL
   */
  generateEmbeddedDownloadUrl(fileMetadata) {
    // Detect if we're in a deployed environment vs local development
    // Check for common deployment environment indicators
    const isDeployed = process.env.NODE_ENV === 'production' ||
                      process.env.FLY_APP_NAME ||
                      process.env.HEROKU_APP_NAME ||
                      process.env.VERCEL_URL ||
                      process.env.RENDER_EXTERNAL_HOSTNAME ||
                      !process.env.NODE_ENV; // Default to deployed if NODE_ENV not set

    let baseUrl;
    if (isDeployed) {
      // Use the deployed URL
      baseUrl = process.env.SERVER_BASE_URL ||
                'https://4c7d7582c7b445d6ac2dadf6cdd558ad-c2353b8c6b2e4daeb0ef650da.fly.dev';
    } else {
      // Use localhost for local development
      baseUrl = 'http://localhost:3003';
    }

    console.log(`Generating download URL - isDeployed: ${isDeployed}, baseUrl: ${baseUrl}`);
    return `${baseUrl}/api/files/${fileMetadata.storageKey}`;
  }

  /**
   * Get file content (for embedded storage)
   * @param {string} storageKey - Storage key of the file
   * @returns {Object} File content and metadata
   */
  async getFileContent(storageKey) {
    if (this.storageType === 's3') {
      throw new Error('Use generateDownloadUrl for S3 files');
    }

    try {
      const filePath = path.join(this.embeddedStoragePath, storageKey);
      const metadataPath = path.join(this.embeddedStoragePath, `${storageKey}.meta.json`);

      const [fileContent, metadataContent] = await Promise.all([
        fs.readFile(filePath),
        fs.readFile(metadataPath, 'utf8')
      ]);

      const metadata = JSON.parse(metadataContent);

      return {
        content: fileContent,
        metadata: metadata
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error('File not found');
      }
      throw new Error(`Failed to get file content: ${error.message}`);
    }
  }

  /**
   * Delete a file
   * @param {Object} fileMetadata - File metadata object
   */
  async deleteFile(fileMetadata) {
    if (fileMetadata.storageType === 's3') {
      return await this.deleteFileS3(fileMetadata);
    } else {
      return await this.deleteFileEmbedded(fileMetadata);
    }
  }

  /**
   * Delete file from S3
   */
  async deleteFileS3(fileMetadata) {
    if (!this.s3Client) {
      throw new Error('S3 storage not configured');
    }

    try {
      const command = new DeleteObjectCommand({
        Bucket: fileMetadata.bucketName || this.s3BucketName,
        Key: fileMetadata.storageKey
      });

      await this.s3Client.send(command);
      return { success: true };
    } catch (error) {
      throw new Error(`Failed to delete file from S3: ${error.message}`);
    }
  }

  /**
   * Delete file from embedded storage
   */
  async deleteFileEmbedded(fileMetadata) {
    try {
      const filePath = path.join(this.embeddedStoragePath, fileMetadata.storageKey);
      const metadataPath = path.join(this.embeddedStoragePath, `${fileMetadata.storageKey}.meta.json`);

      await Promise.all([
        fs.unlink(filePath).catch(() => {}), // Ignore if file doesn't exist
        fs.unlink(metadataPath).catch(() => {}) // Ignore if metadata doesn't exist
      ]);

      return { success: true };
    } catch (error) {
      throw new Error(`Failed to delete file from embedded storage: ${error.message}`);
    }
  }

  /**
   * Get current storage configuration
   */
  getStorageConfig() {
    return {
      storageType: this.storageType,
      embeddedStoragePath: this.embeddedStoragePath,
      s3BucketName: this.s3BucketName,
      s3Region: process.env.AWS_REGION
    };
  }

  /**
   * Update storage configuration
   * @param {Object} config - New storage configuration
   */
  async updateStorageConfig(config) {
    if (config.storageType) {
      this.storageType = config.storageType;
      process.env.STORAGE_TYPE = config.storageType;
    }

    if (config.s3BucketName) {
      this.s3BucketName = config.s3BucketName;
      process.env.S3_BUCKET_NAME = config.s3BucketName;
    }

    if (config.awsRegion) {
      process.env.AWS_REGION = config.awsRegion;
    }

    if (config.awsAccessKeyId) {
      process.env.AWS_ACCESS_KEY_ID = config.awsAccessKeyId;
    }

    if (config.awsSecretAccessKey) {
      process.env.AWS_SECRET_ACCESS_KEY = config.awsSecretAccessKey;
    }

    // Reinitialize storage with new configuration
    await this.initializeStorage();
  }

  /**
   * Test storage connection
   */
  async testConnection() {
    try {
      if (this.storageType === 's3') {
        if (!this.s3Client || !this.s3BucketName) {
          return {
            success: false,
            message: 'S3 configuration is incomplete'
          };
        }

        // Try to list objects to test connection
        const { ListObjectsV2Command } = require('@aws-sdk/client-s3');
        const command = new ListObjectsV2Command({
          Bucket: this.s3BucketName,
          MaxKeys: 1
        });

        await this.s3Client.send(command);
        
        return {
          success: true,
          message: 'S3 connection successful'
        };
      } else {
        // Test embedded storage
        await fs.access(this.embeddedStoragePath);
        
        return {
          success: true,
          message: 'Embedded storage accessible'
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Storage test failed: ${error.message}`
      };
    }
  }
}

module.exports = FileStorageService;
