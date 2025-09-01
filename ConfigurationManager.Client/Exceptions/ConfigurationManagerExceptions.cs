namespace ConfigurationManager.Client.Exceptions;

using ConfigurationManager.Client.Models.Common;

/// <summary>
/// Base exception for Configuration Manager client
/// </summary>
public abstract class ConfigurationManagerException : Exception
{
    public int? StatusCode { get; }
    public string? ErrorCode { get; }

    protected ConfigurationManagerException(string message, int? statusCode = null, string? errorCode = null)
        : base(message)
    {
        StatusCode = statusCode;
        ErrorCode = errorCode;
    }

    protected ConfigurationManagerException(string message, Exception innerException, int? statusCode = null, string? errorCode = null)
        : base(message, innerException)
    {
        StatusCode = statusCode;
        ErrorCode = errorCode;
    }
}

/// <summary>
/// Authentication-related exceptions
/// </summary>
public class AuthenticationException : ConfigurationManagerException
{
    public AuthenticationException(string message, int? statusCode = null)
        : base(message, statusCode)
    {
    }
}

/// <summary>
/// Authorization-related exceptions
/// </summary>
public class AuthorizationException : ConfigurationManagerException
{
    public AuthorizationException(string message, int? statusCode = null)
        : base(message, statusCode)
    {
    }
}

/// <summary>
/// Validation-related exceptions
/// </summary>
public class ValidationException : ConfigurationManagerException
{
    public ValidationException(string message, int? statusCode = null)
        : base(message, statusCode)
    {
    }
}

/// <summary>
/// Resource not found exceptions
/// </summary>
public class NotFoundException : ConfigurationManagerException
{
    public NotFoundException(string message, int? statusCode = null)
        : base(message, statusCode)
    {
    }
}

/// <summary>
/// Conflict exceptions (e.g., duplicate names)
/// </summary>
public class ConflictException : ConfigurationManagerException
{
    public ConflictException(string message, int? statusCode = null)
        : base(message, statusCode)
    {
    }
}

/// <summary>
/// Rate limiting exceptions
/// </summary>
public class RateLimitException : ConfigurationManagerException
{
    public DateTime? RetryAfter { get; }

    public RateLimitException(string message, DateTime? retryAfter = null, int? statusCode = null)
        : base(message, statusCode)
    {
        RetryAfter = retryAfter;
    }
}

/// <summary>
/// API communication exceptions
/// </summary>
public class ApiException : ConfigurationManagerException
{
    public ApiErrorResponse? ErrorResponse { get; }

    public ApiException(string message, ApiErrorResponse? errorResponse = null, int? statusCode = null)
        : base(message, statusCode)
    {
        ErrorResponse = errorResponse;
    }

    public ApiException(string message, Exception innerException, ApiErrorResponse? errorResponse = null, int? statusCode = null)
        : base(message, innerException, statusCode)
    {
        ErrorResponse = errorResponse;
    }
}
