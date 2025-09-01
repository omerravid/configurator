namespace ConfigurationManager.Client.Services;

using ConfigurationManager.Client.Models.Files;
using ConfigurationManager.Client.Exceptions;
using System.Net.Http.Headers;

/// <summary>
/// File management service client
/// </summary>
public interface IFileService
{
    /// <summary>
    /// Download a file by storage key
    /// </summary>
    Task<FileDownloadResult> DownloadFileAsync(
        string storageKey,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Get file metadata and download URL
    /// </summary>
    Task<FileInfoResponse> GetFileInfoAsync(
        string storageKey,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Replace a file in an existing configuration
    /// </summary>
    Task<ReplaceFileResponse> ReplaceFileAsync(
        ReplaceFileRequest request,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Replace a file in an existing configuration (overload with file path)
    /// </summary>
    Task<ReplaceFileResponse> ReplaceFileAsync(
        string configId,
        string propertyPath,
        string filePath,
        string? contentType = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Replace a file in an existing configuration (overload with byte array)
    /// </summary>
    Task<ReplaceFileResponse> ReplaceFileAsync(
        string configId,
        string propertyPath,
        byte[] fileData,
        string fileName,
        string? contentType = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Import a folder structure with files
    /// </summary>
    Task<FolderImportResponse> ImportFolderAsync(
        FolderImportRequest request,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Save a downloaded file to disk
    /// </summary>
    Task SaveFileAsync(FileDownloadResult downloadResult, string destinationPath, CancellationToken cancellationToken = default);
}

/// <summary>
/// Implementation of file management service
/// </summary>
public class FileService : BaseHttpService, IFileService
{
    public FileService(HttpClient httpClient, IOptions<ConfigurationManagerClientOptions> options, ILogger<FileService> logger, IAuthenticationManager authManager)
        : base(httpClient, options, logger, authManager)
    {
    }

    /// <inheritdoc />
    public async Task<FileDownloadResult> DownloadFileAsync(
        string storageKey,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(storageKey))
            throw new ArgumentException("Storage key cannot be empty", nameof(storageKey));

        Logger.LogInformation("Downloading file with storage key: {StorageKey}", storageKey);

        var endpoint = $"files/{storageKey}";

        try
        {
            var response = await HttpClient.GetAsync(endpoint, HttpCompletionOption.ResponseHeadersRead, cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                var errorContent = await response.Content.ReadAsStringAsync(cancellationToken);
                Logger.LogError("Failed to download file {StorageKey}: {StatusCode} - {Error}", 
                    storageKey, response.StatusCode, errorContent);
                throw new ApiException($"Failed to download file: {response.StatusCode}");
            }

            var contentStream = await response.Content.ReadAsStreamAsync(cancellationToken);
            var contentType = response.Content.Headers.ContentType?.MediaType ?? "application/octet-stream";
            var contentLength = response.Content.Headers.ContentLength ?? 0;

            // Try to get filename from Content-Disposition header
            var fileName = storageKey;
            if (response.Content.Headers.ContentDisposition?.FileName != null)
            {
                fileName = response.Content.Headers.ContentDisposition.FileName.Trim('"');
            }

            return new FileDownloadResult
            {
                Content = contentStream,
                FileName = fileName,
                ContentType = contentType,
                ContentLength = contentLength
            };
        }
        catch (HttpRequestException ex)
        {
            Logger.LogError(ex, "HTTP request failed while downloading file {StorageKey}", storageKey);
            throw new ApiException($"Download failed for {storageKey}", ex);
        }
        catch (TaskCanceledException ex)
        {
            Logger.LogError(ex, "Download timeout for file {StorageKey}", storageKey);
            throw new ApiException($"Download timeout for {storageKey}", ex);
        }
    }

    /// <inheritdoc />
    public async Task<FileInfoResponse> GetFileInfoAsync(
        string storageKey,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(storageKey))
            throw new ArgumentException("Storage key cannot be empty", nameof(storageKey));

        Logger.LogDebug("Getting file info for storage key: {StorageKey}", storageKey);

        return await GetAsync<FileInfoResponse>($"files/{storageKey}/info", cancellationToken);
    }

    /// <inheritdoc />
    public async Task<ReplaceFileResponse> ReplaceFileAsync(
        ReplaceFileRequest request,
        CancellationToken cancellationToken = default)
    {
        if (request == null)
            throw new ArgumentNullException(nameof(request));

        if (string.IsNullOrWhiteSpace(request.ConfigId))
            throw new ArgumentException("Config ID cannot be empty", nameof(request));

        if (string.IsNullOrWhiteSpace(request.PropertyPath))
            throw new ArgumentException("Property path cannot be empty", nameof(request));

        if (request.FileStream == null)
            throw new ArgumentException("File stream cannot be null", nameof(request));

        if (string.IsNullOrWhiteSpace(request.FileName))
            throw new ArgumentException("File name cannot be empty", nameof(request));

        // Check file size
        if (request.FileStream.CanSeek && request.FileStream.Length > Options.MaxFileSize)
        {
            throw new ValidationException($"File size {request.FileStream.Length} exceeds maximum allowed size {Options.MaxFileSize}");
        }

        Logger.LogInformation("Replacing file in configuration {ConfigId} at path {PropertyPath} with file {FileName}", 
            request.ConfigId, request.PropertyPath, request.FileName);

        using var content = new MultipartFormDataContent();

        // Add file
        var fileContent = new StreamContent(request.FileStream);
        if (!string.IsNullOrEmpty(request.ContentType))
        {
            fileContent.Headers.ContentType = new MediaTypeHeaderValue(request.ContentType);
        }
        content.Add(fileContent, "file", request.FileName);

        // Add form fields
        content.Add(new StringContent(request.ConfigId), "configId");
        content.Add(new StringContent(request.PropertyPath), "propertyPath");

        return await PostMultipartAsync<ReplaceFileResponse>("file-management/replace", content, cancellationToken);
    }

    /// <inheritdoc />
    public async Task<ReplaceFileResponse> ReplaceFileAsync(
        string configId,
        string propertyPath,
        string filePath,
        string? contentType = null,
        CancellationToken cancellationToken = default)
    {
        if (!File.Exists(filePath))
            throw new FileNotFoundException($"File not found: {filePath}");

        var fileName = Path.GetFileName(filePath);
        contentType ??= GetContentTypeFromExtension(Path.GetExtension(filePath));

        using var fileStream = File.OpenRead(filePath);

        var request = new ReplaceFileRequest
        {
            ConfigId = configId,
            PropertyPath = propertyPath,
            FileStream = fileStream,
            FileName = fileName,
            ContentType = contentType
        };

        return await ReplaceFileAsync(request, cancellationToken);
    }

    /// <inheritdoc />
    public async Task<ReplaceFileResponse> ReplaceFileAsync(
        string configId,
        string propertyPath,
        byte[] fileData,
        string fileName,
        string? contentType = null,
        CancellationToken cancellationToken = default)
    {
        if (fileData == null || fileData.Length == 0)
            throw new ArgumentException("File data cannot be empty", nameof(fileData));

        contentType ??= GetContentTypeFromExtension(Path.GetExtension(fileName));

        using var fileStream = new MemoryStream(fileData);

        var request = new ReplaceFileRequest
        {
            ConfigId = configId,
            PropertyPath = propertyPath,
            FileStream = fileStream,
            FileName = fileName,
            ContentType = contentType
        };

        return await ReplaceFileAsync(request, cancellationToken);
    }

    /// <inheritdoc />
    public async Task<FolderImportResponse> ImportFolderAsync(
        FolderImportRequest request,
        CancellationToken cancellationToken = default)
    {
        if (request == null)
            throw new ArgumentNullException(nameof(request));

        if (request.Files == null || request.Files.Count == 0)
            throw new ArgumentException("Files list cannot be empty", nameof(request));

        Logger.LogInformation("Importing folder with {FileCount} files", request.Files.Count);

        using var content = new MultipartFormDataContent();

        // Add files
        for (int i = 0; i < request.Files.Count; i++)
        {
            var file = request.Files[i];
            if (file.FileStream == null)
                continue;

            // Check file size
            if (file.FileStream.CanSeek && file.FileStream.Length > Options.MaxFileSize)
            {
                Logger.LogWarning("Skipping file {FileName} - size {Size} exceeds maximum {MaxSize}", 
                    file.FileName, file.FileStream.Length, Options.MaxFileSize);
                continue;
            }

            var fileContent = new StreamContent(file.FileStream);
            if (!string.IsNullOrEmpty(file.ContentType))
            {
                fileContent.Headers.ContentType = new MediaTypeHeaderValue(file.ContentType);
            }

            content.Add(fileContent, "files", file.FileName);
        }

        // Add optional fields
        if (!string.IsNullOrEmpty(request.FolderName))
        {
            content.Add(new StringContent(request.FolderName), "folderName");
        }

        if (request.RelativePaths != null && request.RelativePaths.Count > 0)
        {
            for (int i = 0; i < request.RelativePaths.Count; i++)
            {
                content.Add(new StringContent(request.RelativePaths[i]), "relativePaths");
            }
        }

        return await PostMultipartAsync<FolderImportResponse>("folder-import", content, cancellationToken);
    }

    /// <inheritdoc />
    public async Task SaveFileAsync(FileDownloadResult downloadResult, string destinationPath, CancellationToken cancellationToken = default)
    {
        if (downloadResult == null)
            throw new ArgumentNullException(nameof(downloadResult));

        if (string.IsNullOrWhiteSpace(destinationPath))
            throw new ArgumentException("Destination path cannot be empty", nameof(destinationPath));

        // Create directory if it doesn't exist
        var directory = Path.GetDirectoryName(destinationPath);
        if (!string.IsNullOrEmpty(directory) && !Directory.Exists(directory))
        {
            Directory.CreateDirectory(directory);
        }

        Logger.LogInformation("Saving downloaded file to: {DestinationPath}", destinationPath);

        try
        {
            using var fileStream = File.Create(destinationPath);
            await downloadResult.Content.CopyToAsync(fileStream, cancellationToken);
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Failed to save file to {DestinationPath}", destinationPath);
            throw new ApiException($"Failed to save file to {destinationPath}", ex);
        }
        finally
        {
            downloadResult.Content.Dispose();
        }
    }

    /// <summary>
    /// Get content type from file extension
    /// </summary>
    private static string GetContentTypeFromExtension(string extension)
    {
        return extension.ToLowerInvariant() switch
        {
            ".txt" => "text/plain",
            ".html" => "text/html",
            ".css" => "text/css",
            ".js" => "application/javascript",
            ".json" => "application/json",
            ".xml" => "application/xml",
            ".pdf" => "application/pdf",
            ".jpg" or ".jpeg" => "image/jpeg",
            ".png" => "image/png",
            ".gif" => "image/gif",
            ".bmp" => "image/bmp",
            ".svg" => "image/svg+xml",
            ".mp4" => "video/mp4",
            ".avi" => "video/x-msvideo",
            ".mov" => "video/quicktime",
            ".mp3" => "audio/mpeg",
            ".wav" => "audio/wav",
            ".zip" => "application/zip",
            ".tar" => "application/x-tar",
            ".gz" => "application/gzip",
            ".doc" => "application/msword",
            ".docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ".xls" => "application/vnd.ms-excel",
            ".xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ".ppt" => "application/vnd.ms-powerpoint",
            ".pptx" => "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            _ => "application/octet-stream"
        };
    }
}
