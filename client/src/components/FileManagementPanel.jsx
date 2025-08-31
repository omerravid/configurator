import React, { useState, useEffect } from "react";
import {
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  DocumentIcon,
  XMarkIcon,
  PencilIcon,
  EyeIcon,
  EyeSlashIcon,
} from "@heroicons/react/24/outline";
import { useToast } from "../context/ToastContext";
import { configAPI } from "../services/api";
import { useAuth } from "../context/AuthContext";
import PprmEditor from "./PprmEditor";
import VrmlPreview from "./VrmlPreview";
import * as UTIF from "utif";

const FileManagementPanel = ({ 
  fileValue, 
  configId, 
  propertyPath, 
  onFileUpdated,
  isEditable = false 
}) => {
  const { showToast } = useToast();
  const [isReplacing, setIsReplacing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showPprmEditor, setShowPprmEditor] = useState(false);
  const [pprmContent, setPprmContent] = useState('');
  const [loadingPprm, setLoadingPprm] = useState(false);
  const [showPprmPreview, setShowPprmPreview] = useState(false);
  const [pprmPreviewContent, setPprmPreviewContent] = useState('');
  const [pprmPreviewLoading, setPprmPreviewLoading] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');
  const [imageLoadError, setImageLoadError] = useState(false);
  const [loadingImagePreview, setLoadingImagePreview] = useState(false);
  const [showHdrPreview, setShowHdrPreview] = useState(false);
  const [hdrLoading, setHdrLoading] = useState(false);
  const [hdrContent, setHdrContent] = useState(null);
  const [showVrmlPreview, setShowVrmlPreview] = useState(false);

  // Cleanup blob URLs when component unmounts
  useEffect(() => {
    return () => {
      if (imagePreviewUrl && imagePreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  // Reset previews when switching to a different file/selection
  useEffect(() => {
    setShowHdrPreview(false);
    setHdrContent(null);
    setHdrLoading(false);
    if (showImagePreview && imagePreviewUrl && imagePreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setShowImagePreview(false);
    setImagePreviewUrl('');
    setImageLoadError(false);
    setLoadingImagePreview(false);
    setShowPprmPreview(false);
    setPprmPreviewContent('');
    setPprmPreviewLoading(false);
  }, [fileValue, propertyPath]);

  useEffect(() => {
    setShowVrmlPreview(false);
  }, [fileValue, propertyPath]);

  const metadata = fileValue._metadata || {};
  // We no longer need the downloadUrl since we're using authenticated fetch
  const canDownload = metadata.storageKey;
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  // Check if this is a PPRM file
  const isPprmFile = metadata.originalName?.toLowerCase().endsWith('.pprm') ||
                     metadata.mimeType === 'application/octet-stream' &&
                     metadata.originalName?.toLowerCase().includes('.pprm');

  // Check if this is an image file (now includes TIFF)
  const isTiffFile = (
    /image\/tiff/i.test(metadata.mimeType || '') || /\.(tif|tiff)$/i.test(metadata.originalName || '')
  );
  const isImageFile = (
    metadata.mimeType?.startsWith('image/')
  ) || (
    metadata.originalName && /\.(jpg|jpeg|png|gif|webp|bmp|svg|tif|tiff)$/i.test(metadata.originalName)
  );

  // Check if this is an HDR JSON file
  const isHdrFile = (metadata.originalName || '').toLowerCase().endsWith('.hdr');
  const isTxtFile = (metadata.originalName || '').toLowerCase().endsWith('.txt');
  const isVrmlFile = /\.(vrml|wrl)$/i.test(metadata.originalName || '');

  // Generate image preview URL
  const getImagePreviewUrl = () => {
    if (!metadata.storageKey) return '';
    return `/api/files/${metadata.storageKey}`;
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      // Use fetch with authentication headers instead of direct link
      const response = await fetch(`/api/files/${metadata.storageKey}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Download failed' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      // Get the file blob
      const blob = await response.blob();

      // Create a temporary URL for the blob and download it
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = metadata.originalName || 'download';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up the blob URL
      window.URL.revokeObjectURL(url);

      showToast(`Downloaded ${metadata.originalName}`, 'success');
    } catch (error) {
      console.error('Download error:', error);
      showToast(`Failed to download file: ${error.message}`, 'error');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    handleFileReplace(file);
  };

  const handleFileReplace = async (file) => {
    if (!configId || !propertyPath) {
      showToast('Missing configuration information for file replacement', 'error');
      return;
    }

    setIsReplacing(true);
    try {
      const response = await configAPI.replaceFile(configId, propertyPath, file);
      
      if (response.data.success) {
        showToast(`File "${file.name}" uploaded successfully`, 'success');
        // Notify parent component that the file was updated
        onFileUpdated?.(response.data.fileData);
      } else {
        throw new Error(response.data.error || 'File replacement failed');
      }
    } catch (error) {
      console.error('File replacement error:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to replace file';
      showToast(errorMessage, 'error');
    } finally {
      setIsReplacing(false);
    }
  };

  const handleEditPprm = async () => {
    setLoadingPprm(true);
    try {
      // Fetch the PPRM file content
      const response = await fetch(`/api/files/${metadata.storageKey}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch PPRM file: ${response.status}`);
      }

      const content = await response.text();
      setPprmContent(content);
      setShowPprmEditor(true);
    } catch (error) {
      showToast(`Failed to load PPRM file: ${error.message}`, 'error');
    } finally {
      setLoadingPprm(false);
    }
  };

  const handleSavePprm = async (editedContent) => {
    try {
      // Create a blob from the edited content
      const blob = new Blob([editedContent], { type: 'text/plain' });
      const file = new File([blob], metadata.originalName, { type: 'application/octet-stream' });

      // Use the existing file replacement logic
      const formData = new FormData();
      formData.append('file', file);
      formData.append('configId', configId);
      formData.append('propertyPath', propertyPath);

      const response = await configAPI.replaceFile(configId, propertyPath, file);

      if (response.data.success) {
        showToast('PPRM file saved successfully', 'success');
        onFileUpdated?.(response.data.fileData);
      } else {
        throw new Error(response.data.error || 'Failed to save PPRM file');
      }
    } catch (error) {
      console.error('PPRM save error:', error);
      throw new Error(error.response?.data?.error || error.message || 'Failed to save PPRM file');
    }
  };

  const toggleImagePreview = async () => {
    if (showImagePreview) {
      setShowImagePreview(false);
      if (imagePreviewUrl && imagePreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
      setImagePreviewUrl('');
      setImageLoadError(false);
      setLoadingImagePreview(false);
    } else {
      setShowImagePreview(true);
      setImageLoadError(false);
      setLoadingImagePreview(true);

      try {
        // Fetch image with authentication
        const response = await fetch(`/api/files/${metadata.storageKey}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.status}`);
        }

        if (isTiffFile) {
          const arrayBuffer = await response.arrayBuffer();
          const ifds = UTIF.decode(arrayBuffer);
          if (!ifds || ifds.length === 0) throw new Error('No IFDs in TIFF');
          UTIF.decodeImage(arrayBuffer, ifds[0]);
          const rgba = UTIF.toRGBA8(ifds[0]);
          const w = ifds[0].width || ifds[0].t256 || ifds[0].cols;
          const h = ifds[0].height || ifds[0].t257 || ifds[0].rows;
          if (!w || !h) throw new Error('Invalid TIFF dimensions');

          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          const imageData = ctx.createImageData(w, h);
          imageData.data.set(rgba);
          ctx.putImageData(imageData, 0, 0);
          const dataUrl = canvas.toDataURL('image/jpeg');
          setImagePreviewUrl(dataUrl);
        } else {
          const blob = await response.blob();
          const blobUrl = URL.createObjectURL(blob);
          setImagePreviewUrl(blobUrl);
        }
      } catch (error) {
        console.error('Image preview error:', error);
        setImageLoadError(true);
        showToast('Failed to load image preview', 'error');
      } finally {
        setLoadingImagePreview(false);
      }
    }
  };

  const handleImageLoadError = () => {
    setImageLoadError(true);
    showToast('Failed to load image preview', 'error');
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${Math.round(size * 10) / 10} ${units[unitIndex]}`;
  };

  const getFileTypeIcon = (mimeType) => {
    if (!mimeType) return DocumentIcon;
    
    if (mimeType.startsWith('image/')) {
      return () => (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    }
    
    if (mimeType.startsWith('video/')) {
      return () => (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      );
    }
    
    if (mimeType.includes('pdf')) {
      return () => (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      );
    }
    
    return DocumentIcon;
  };

  const FileTypeIcon = getFileTypeIcon(metadata.mimeType);

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-blue-50 dark:bg-blue-900/20">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0 text-blue-600 dark:text-blue-400">
            <FileTypeIcon />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
              {(metadata.originalName || 'Unknown File').replace(/\./g, '_')}
            </h4>
            <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400 mt-1">
              {metadata.mimeType && (
                <span className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                  {metadata.mimeType.split('/')[1]?.toUpperCase() || metadata.mimeType}
                </span>
              )}
              {metadata.size && (
                <span>{formatFileSize(metadata.size)}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* VRML 3D Preview Section */}
      {isVrmlFile && (
        <div className="mt-3">
          <button
            onClick={() => setShowVrmlPreview(v => !v)}
            className="flex items-center space-x-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 transition-colors"
          >
            {showVrmlPreview ? (
              <EyeSlashIcon className="w-4 h-4" />
            ) : (
              <EyeIcon className="w-4 h-4" />
            )}
            <span>{showVrmlPreview ? 'Hide 3D' : 'Show 3D'}</span>
          </button>
          {showVrmlPreview && (
            <div className="mt-3">
              <VrmlPreview storageKey={metadata.storageKey} authToken={localStorage.getItem('token')} />
            </div>
          )}
        </div>
      )}

      {/* HDR/TXT JSON Preview Section */}
      {(isHdrFile || isTxtFile) && (
        <div className="mt-3">
          <button
            onClick={async () => {
              if (showHdrPreview) {
                setShowHdrPreview(false);
                return;
              }
              setHdrLoading(true);
              try {
                const response = await fetch(`/api/files/${metadata.storageKey}`, {
                  headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });
                const text = await response.text();
                if (isTxtFile) {
                  setHdrContent(text);
                } else {
                  try {
                    const json = JSON.parse(text);
                    setHdrContent(json);
                  } catch (e) {
                    setHdrContent({ _previewError: 'Not valid JSON', _raw: text.slice(0, 2000) });
                  }
                }
                setShowHdrPreview(true);
              } catch (error) {
                showToast('Failed to load preview', 'error');
              } finally {
                setHdrLoading(false);
              }
            }}
            className="flex items-center space-x-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 transition-colors"
          >
            {showHdrPreview ? (
              <EyeSlashIcon className="w-4 h-4" />
            ) : (
              <EyeIcon className="w-4 h-4" />
            )}
            <span>{showHdrPreview ? 'Hide Preview' : (hdrLoading ? 'Loading…' : 'Show Preview')}</span>
          </button>

          {showHdrPreview && (
            <div className="mt-3 border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
              <div className="p-3 max-h-96 overflow-auto">
                <pre className="text-xs text-gray-800 dark:text-gray-100 whitespace-pre-wrap">
                  {hdrContent == null ? '' : (isTxtFile ? String(hdrContent) : JSON.stringify(hdrContent, null, 2))}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PPRM Plain Text Preview for non-admin users */}
      {isPprmFile && !isAdmin && (
        <div className="mt-3">
          <button
            onClick={async () => {
              if (showPprmPreview) {
                setShowPprmPreview(false);
                return;
              }
              setPprmPreviewLoading(true);
              try {
                const response = await fetch(`/api/files/${metadata.storageKey}`, {
                  headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const text = await response.text();
                setPprmPreviewContent(text);
                setShowPprmPreview(true);
              } catch (error) {
                showToast('Failed to load preview', 'error');
              } finally {
                setPprmPreviewLoading(false);
              }
            }}
            className="flex items-center space-x-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 transition-colors"
          >
            {showPprmPreview ? (
              <EyeSlashIcon className="w-4 h-4" />
            ) : (
              <EyeIcon className="w-4 h-4" />
            )}
            <span>{showPprmPreview ? 'Hide Preview' : (pprmPreviewLoading ? 'Loading…' : 'Show Preview')}</span>
          </button>

          {showPprmPreview && (
            <div className="mt-3 border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
              <div className="p-3 max-h-96 overflow-auto">
                <pre className="text-xs text-gray-800 dark:text-gray-100 whitespace-pre-wrap">
                  {pprmPreviewContent}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Image Preview Section */}
      {isImageFile && (
        <div className="mt-3">
          <button
            onClick={toggleImagePreview}
            className="flex items-center space-x-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 transition-colors"
          >
            {showImagePreview ? (
              <EyeSlashIcon className="w-4 h-4" />
            ) : (
              <EyeIcon className="w-4 h-4" />
            )}
            <span>{showImagePreview ? 'Hide Preview' : 'Show Preview'}</span>
          </button>

          {showImagePreview && (
            <div className="mt-3 border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
              {loadingImagePreview ? (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  <div className="flex flex-col items-center space-y-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <p className="text-sm">Loading image preview...</p>
                  </div>
                </div>
              ) : imageLoadError ? (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  <div className="flex flex-col items-center space-y-2">
                    <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <p className="text-sm">Failed to load image preview</p>
                    <p className="text-xs text-gray-400">The image may be corrupted or in an unsupported format</p>
                  </div>
                </div>
              ) : imagePreviewUrl ? (
                <div className="relative bg-gray-50 dark:bg-gray-700 p-4">
                  <img
                    src={imagePreviewUrl}
                    alt={(metadata.originalName || 'Image preview').replace(/\./g, '_')}
                    className="max-w-full max-h-96 mx-auto block object-contain rounded shadow-sm"
                    onError={handleImageLoadError}
                    style={{
                      maxHeight: '24rem'
                    }}
                  />
                  <div className="absolute top-6 right-6 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
                    {(metadata.originalName || '').replace(/\./g, '_')}
                  </div>
                  {metadata.size && (
                    <div className="absolute bottom-6 left-6 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
                      {formatFileSize(metadata.size)}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center space-x-2 mt-3">
        <button
          onClick={handleDownload}
          disabled={isDownloading || !canDownload}
          className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ArrowDownTrayIcon className="w-4 h-4" />
          <span>{isDownloading ? 'Downloading...' : 'Download'}</span>
        </button>

        {isEditable && isPprmFile && isAdmin && (
          <button
            onClick={handleEditPprm}
            disabled={loadingPprm || isDownloading}
            className="flex items-center space-x-2 px-3 py-2 bg-purple-600 text-white text-sm font-medium rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <PencilIcon className="w-4 h-4" />
            <span>{loadingPprm ? 'Loading...' : 'Edit'}</span>
          </button>
        )}

        {isEditable && (
          <div className="relative">
            <input
              type="file"
              id="file-replace"
              onChange={handleFileSelect}
              disabled={isReplacing}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
            />
            <button
              disabled={isReplacing}
              className="flex items-center space-x-2 px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ArrowUpTrayIcon className="w-4 h-4" />
              <span>{isReplacing ? 'Replacing...' : 'Replace'}</span>
            </button>
          </div>
        )}
      </div>

      {metadata.storageType && (
        <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          Storage: {metadata.storageType === 's3' ? 'Cloud Storage (S3)' : 'Local Storage'}
          {metadata.storageKey && (
            <span className="ml-2 font-mono">ID: {metadata.storageKey.substring(0, 8)}...</span>
          )}
        </div>
      )}

      {/* PPRM Editor Modal */}
      <PprmEditor
        isOpen={showPprmEditor}
        onClose={() => setShowPprmEditor(false)}
        pprmContent={pprmContent}
        filename={metadata.originalName}
        onSave={handleSavePprm}
      />
    </div>
  );
};

export default FileManagementPanel;
