namespace ConfigurationManager.Client.Services;

using ConfigurationManager.Client.Exceptions;
using ConfigurationManager.Client.Models.Common;
using System.Net;
using System.Net.Http.Headers;

/// <summary>
/// Base HTTP service with common functionality
/// </summary>
public abstract class BaseHttpService
{
    protected readonly HttpClient HttpClient;
    protected readonly ILogger Logger;
    protected readonly ConfigurationManagerClientOptions Options;

    protected BaseHttpService(HttpClient httpClient, IOptions<ConfigurationManagerClientOptions> options, ILogger logger)
    {
        HttpClient = httpClient;
        Options = options.Value;
        Logger = logger;

        ConfigureHttpClient();
    }

    private void ConfigureHttpClient()
    {
        // Ensure BaseAddress is set (fallback if DI configuration failed)
        if (HttpClient.BaseAddress == null && !string.IsNullOrEmpty(Options.BaseUrl))
        {
            HttpClient.BaseAddress = new Uri(Options.BaseUrl);
        }

        // Set timeout
        HttpClient.Timeout = Options.Timeout;

        // Set authentication headers
        if (!string.IsNullOrEmpty(Options.JwtToken))
        {
            HttpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", Options.JwtToken);
        }
        else if (!string.IsNullOrEmpty(Options.ApiKey))
        {
            HttpClient.DefaultRequestHeaders.Add("X-API-Key", Options.ApiKey);
        }

        // Set common headers
        HttpClient.DefaultRequestHeaders.Accept.Clear();
        HttpClient.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
    }

    /// <summary>
    /// Update JWT token for authentication
    /// </summary>
    protected void UpdateJwtToken(string token)
    {
        HttpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
    }

    /// <summary>
    /// Send GET request and deserialize response
    /// </summary>
    protected async Task<T> GetAsync<T>(string endpoint, CancellationToken cancellationToken = default)
    {
        try
        {
            Logger.LogDebug("Sending GET request to {Endpoint}", endpoint);
            
            using var response = await HttpClient.GetAsync(endpoint, cancellationToken);
            return await HandleResponse<T>(response);
        }
        catch (HttpRequestException ex)
        {
            Logger.LogError(ex, "HTTP request failed for GET {Endpoint}", endpoint);
            throw new ApiException($"Request to {endpoint} failed", ex);
        }
        catch (TaskCanceledException ex)
        {
            Logger.LogError(ex, "Request timeout for GET {Endpoint}", endpoint);
            throw new ApiException($"Request to {endpoint} timed out", ex);
        }
    }

    /// <summary>
    /// Send POST request with JSON body and deserialize response
    /// </summary>
    protected async Task<T> PostAsync<T>(string endpoint, object? data = null, CancellationToken cancellationToken = default)
    {
        try
        {
            Logger.LogDebug("Sending POST request to {Endpoint}", endpoint);

            using var response = data == null
                ? await HttpClient.PostAsync(endpoint, null, cancellationToken)
                : await HttpClient.PostAsJsonAsync(endpoint, data, cancellationToken);

            return await HandleResponse<T>(response);
        }
        catch (HttpRequestException ex)
        {
            Logger.LogError(ex, "HTTP request failed for POST {Endpoint}", endpoint);
            throw new ApiException($"Request to {endpoint} failed", ex);
        }
        catch (TaskCanceledException ex)
        {
            Logger.LogError(ex, "Request timeout for POST {Endpoint}", endpoint);
            throw new ApiException($"Request to {endpoint} timed out", ex);
        }
    }

    /// <summary>
    /// Send POST request with multipart form data
    /// </summary>
    protected async Task<T> PostMultipartAsync<T>(string endpoint, MultipartFormDataContent content, CancellationToken cancellationToken = default)
    {
        try
        {
            Logger.LogDebug("Sending POST multipart request to {Endpoint}", endpoint);

            using var response = await HttpClient.PostAsync(endpoint, content, cancellationToken);
            return await HandleResponse<T>(response);
        }
        catch (HttpRequestException ex)
        {
            Logger.LogError(ex, "HTTP request failed for POST multipart {Endpoint}", endpoint);
            throw new ApiException($"Request to {endpoint} failed", ex);
        }
        catch (TaskCanceledException ex)
        {
            Logger.LogError(ex, "Request timeout for POST multipart {Endpoint}", endpoint);
            throw new ApiException($"Request to {endpoint} timed out", ex);
        }
    }

    /// <summary>
    /// Send PUT request with JSON body and deserialize response
    /// </summary>
    protected async Task<T> PutAsync<T>(string endpoint, object data, CancellationToken cancellationToken = default)
    {
        try
        {
            Logger.LogDebug("Sending PUT request to {Endpoint}", endpoint);

            using var response = await HttpClient.PutAsJsonAsync(endpoint, data, cancellationToken);
            return await HandleResponse<T>(response);
        }
        catch (HttpRequestException ex)
        {
            Logger.LogError(ex, "HTTP request failed for PUT {Endpoint}", endpoint);
            throw new ApiException($"Request to {endpoint} failed", ex);
        }
        catch (TaskCanceledException ex)
        {
            Logger.LogError(ex, "Request timeout for PUT {Endpoint}", endpoint);
            throw new ApiException($"Request to {endpoint} timed out", ex);
        }
    }

    /// <summary>
    /// Send DELETE request and deserialize response
    /// </summary>
    protected async Task<T> DeleteAsync<T>(string endpoint, CancellationToken cancellationToken = default)
    {
        try
        {
            Logger.LogDebug("Sending DELETE request to {Endpoint}", endpoint);

            using var response = await HttpClient.DeleteAsync(endpoint, cancellationToken);
            return await HandleResponse<T>(response);
        }
        catch (HttpRequestException ex)
        {
            Logger.LogError(ex, "HTTP request failed for DELETE {Endpoint}", endpoint);
            throw new ApiException($"Request to {endpoint} failed", ex);
        }
        catch (TaskCanceledException ex)
        {
            Logger.LogError(ex, "Request timeout for DELETE {Endpoint}", endpoint);
            throw new ApiException($"Request to {endpoint} timed out", ex);
        }
    }

    /// <summary>
    /// Download file as stream
    /// </summary>
    protected async Task<Stream> DownloadStreamAsync(string endpoint, CancellationToken cancellationToken = default)
    {
        try
        {
            Logger.LogDebug("Downloading file from {Endpoint}", endpoint);

            var response = await HttpClient.GetAsync(endpoint, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
            
            if (!response.IsSuccessStatusCode)
            {
                response.Dispose();
                await HandleErrorResponse(response);
            }

            return await response.Content.ReadAsStreamAsync(cancellationToken);
        }
        catch (HttpRequestException ex)
        {
            Logger.LogError(ex, "HTTP request failed for download {Endpoint}", endpoint);
            throw new ApiException($"Download from {endpoint} failed", ex);
        }
        catch (TaskCanceledException ex)
        {
            Logger.LogError(ex, "Request timeout for download {Endpoint}", endpoint);
            throw new ApiException($"Download from {endpoint} timed out", ex);
        }
    }

    /// <summary>
    /// Handle HTTP response and deserialize or throw exceptions
    /// </summary>
    private async Task<T> HandleResponse<T>(HttpResponseMessage response)
    {
        if (response.IsSuccessStatusCode)
        {
            var content = await response.Content.ReadAsStringAsync();
            
            if (typeof(T) == typeof(string))
            {
                return (T)(object)content;
            }

            try
            {
                var options = new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true,
                    PropertyNamingPolicy = JsonNamingPolicy.CamelCase
                };

                var result = JsonSerializer.Deserialize<T>(content, options);
                return result ?? throw new ApiException("Failed to deserialize response");
            }
            catch (JsonException ex)
            {
                Logger.LogError(ex, "Failed to deserialize response: {Content}", content);
                throw new ApiException("Failed to deserialize response", ex);
            }
        }

        await HandleErrorResponse(response);
        throw new ApiException("Unexpected error occurred");
    }

    /// <summary>
    /// Handle error responses and throw appropriate exceptions
    /// </summary>
    private async Task HandleErrorResponse(HttpResponseMessage response)
    {
        var content = await response.Content.ReadAsStringAsync();
        var statusCode = (int)response.StatusCode;

        ApiErrorResponse? errorResponse = null;
        try
        {
            var options = new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true,
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            };
            errorResponse = JsonSerializer.Deserialize<ApiErrorResponse>(content, options);
        }
        catch (JsonException)
        {
            // If we can't parse the error response, use the raw content
            errorResponse = new ApiErrorResponse { Error = content };
        }

        var errorMessage = errorResponse?.Error ?? $"HTTP {statusCode} error";

        Logger.LogError("API error: {StatusCode} - {Error}", statusCode, errorMessage);

        // Throw specific exceptions based on status code
        ConfigurationManagerException exception;
        switch (response.StatusCode)
        {
            case HttpStatusCode.Unauthorized:
                exception = new AuthenticationException(errorMessage, statusCode);
                break;
            case HttpStatusCode.Forbidden:
                exception = new AuthorizationException(errorMessage, statusCode);
                break;
            case HttpStatusCode.NotFound:
                exception = new NotFoundException(errorMessage, statusCode);
                break;
            case HttpStatusCode.BadRequest:
                exception = new ValidationException(errorMessage, statusCode);
                break;
            case HttpStatusCode.Conflict:
                exception = new ConflictException(errorMessage, statusCode);
                break;
            case HttpStatusCode.TooManyRequests:
                exception = new RateLimitException(errorMessage, DateTime.UtcNow.Add(TimeSpan.FromMinutes(1)), statusCode);
                break;
            default:
                exception = new ApiException(errorMessage, errorResponse, statusCode);
                break;
        }

        throw exception;
    }
}
