namespace ConfigurationManager.Client.Models.Common;

/// <summary>
/// Standard API error response
/// </summary>
public class ApiErrorResponse
{
    [JsonPropertyName("error")]
    public string Error { get; set; } = string.Empty;

    [JsonPropertyName("details")]
    public string? Details { get; set; }

    [JsonPropertyName("code")]
    public string? Code { get; set; }
}

/// <summary>
/// Standard success response
/// </summary>
public class ApiResponse<T>
{
    [JsonPropertyName("success")]
    public bool Success { get; set; }

    [JsonPropertyName("message")]
    public string? Message { get; set; }

    [JsonPropertyName("data")]
    public T? Data { get; set; }
}

/// <summary>
/// Pagination information
/// </summary>
public class PaginationInfo
{
    [JsonPropertyName("page")]
    public int Page { get; set; }

    [JsonPropertyName("pageSize")]
    public int PageSize { get; set; }

    [JsonPropertyName("total")]
    public int Total { get; set; }

    [JsonPropertyName("totalPages")]
    public int TotalPages { get; set; }
}

/// <summary>
/// File metadata
/// </summary>
public class FileMetadata
{
    [JsonPropertyName("storageKey")]
    public string StorageKey { get; set; } = string.Empty;

    [JsonPropertyName("originalName")]
    public string OriginalName { get; set; } = string.Empty;

    [JsonPropertyName("mimeType")]
    public string MimeType { get; set; } = string.Empty;

    [JsonPropertyName("size")]
    public long Size { get; set; }

    [JsonPropertyName("storageType")]
    public string StorageType { get; set; } = string.Empty;

    [JsonPropertyName("uploaded_at")]
    public DateTime UploadedAt { get; set; }
}

/// <summary>
/// File object as stored in configurations
/// </summary>
public class FileObject
{
    [JsonPropertyName("_type")]
    public string Type { get; set; } = "file";

    [JsonPropertyName("_metadata")]
    public FileMetadata Metadata { get; set; } = new();

    [JsonPropertyName("_link")]
    public string Link { get; set; } = string.Empty;
}
