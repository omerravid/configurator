namespace ConfigurationManager.Client.Models.Files;

using ConfigurationManager.Client.Models.Common;

/// <summary>
/// File replacement request
/// </summary>
public class ReplaceFileRequest
{
    public string ConfigId { get; set; } = string.Empty;
    public string PropertyPath { get; set; } = string.Empty;
    public Stream FileStream { get; set; } = Stream.Null;
    public string FileName { get; set; } = string.Empty;
    public string? ContentType { get; set; }
}

/// <summary>
/// File replacement response
/// </summary>
public class ReplaceFileResponse
{
    [JsonPropertyName("success")]
    public bool Success { get; set; }

    [JsonPropertyName("message")]
    public string Message { get; set; } = string.Empty;

    [JsonPropertyName("fileObject")]
    public FileObject? FileObject { get; set; }

    [JsonPropertyName("config")]
    public UpdatedConfigInfo? Config { get; set; }

    [JsonPropertyName("error")]
    public string? Error { get; set; }
}

/// <summary>
/// Updated configuration info
/// </summary>
public class UpdatedConfigInfo
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("updated_at")]
    public DateTime UpdatedAt { get; set; }
}

/// <summary>
/// File info response
/// </summary>
public class FileInfoResponse
{
    [JsonPropertyName("metadata")]
    public FileMetadata Metadata { get; set; } = new();

    [JsonPropertyName("downloadUrl")]
    public string DownloadUrl { get; set; } = string.Empty;
}

/// <summary>
/// Folder import request
/// </summary>
public class FolderImportRequest
{
    public List<FolderImportFile> Files { get; set; } = new();
    public string? FolderName { get; set; }
    public List<string>? RelativePaths { get; set; }
}

/// <summary>
/// File for folder import
/// </summary>
public class FolderImportFile
{
    public Stream FileStream { get; set; } = Stream.Null;
    public string FileName { get; set; } = string.Empty;
    public string? ContentType { get; set; }
    public string? RelativePath { get; set; }
}

/// <summary>
/// Folder import response
/// </summary>
public class FolderImportResponse
{
    [JsonPropertyName("success")]
    public bool Success { get; set; }

    [JsonPropertyName("message")]
    public string Message { get; set; } = string.Empty;

    [JsonPropertyName("data")]
    public JsonElement Data { get; set; }

    [JsonPropertyName("stats")]
    public FolderImportStats Stats { get; set; } = new();
}

/// <summary>
/// Folder import statistics
/// </summary>
public class FolderImportStats
{
    [JsonPropertyName("totalFiles")]
    public int TotalFiles { get; set; }

    [JsonPropertyName("jsonFiles")]
    public int JsonFiles { get; set; }

    [JsonPropertyName("binaryFiles")]
    public int BinaryFiles { get; set; }

    [JsonPropertyName("errors")]
    public int Errors { get; set; }

    [JsonPropertyName("errorDetails")]
    public List<string>? ErrorDetails { get; set; }
}

/// <summary>
/// File download result
/// </summary>
public class FileDownloadResult
{
    public Stream Content { get; set; } = Stream.Null;
    public string FileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long ContentLength { get; set; }
}
