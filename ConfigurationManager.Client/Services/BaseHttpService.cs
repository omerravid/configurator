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
    protected readonly IAuthenticationManager AuthManager;

    protected BaseHttpService(HttpClient httpClient, IOptions<ConfigurationManagerClientOptions> options, ILogger logger, IAuthenticationManager authManager)
    {
        HttpClient = httpClient;
        Options = options.Value;
        Logger = logger;
        AuthManager = authManager;

        ConfigureHttpClient();
    }

    private void ConfigureHttpClient()
    {
        // Ensure BaseAddress is set (fallback if DI configuration failed)
        if (HttpClient.BaseAddress == null && !string.IsNullOrEmpty(Options.BaseUrl))
        {
            // Ensure the base URL ends with a slash for proper relative path combination
            var baseUrl = Options.BaseUrl.TrimEnd('/') + "/";
            HttpClient.BaseAddress = new Uri(baseUrl);
        }

        // Set timeout
        HttpClient.Timeout = Options.Timeout;

        // Use authentication manager to configure auth headers
        AuthManager.ConfigureHttpClient(HttpClient);

        // Set common headers
        HttpClient.DefaultRequestHeaders.Accept.Clear();
        HttpClient.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
    }

    /// <summary>
    /// Update JWT token for authentication
    /// </summary>
    protected void UpdateJwtToken(string token)
    {
        AuthManager.SetJwtToken(token);
        AuthManager.ConfigureHttpClient(HttpClient);
    }

    /// <summary>
    /// Set JWT token for authentication (public method)
    /// </summary>
    public void SetJwtToken(string token)
    {
        if (string.IsNullOrWhiteSpace(token))
            throw new ArgumentException("Token cannot be empty", nameof(token));

        UpdateJwtToken(token);
    }

    /// <summary>
    /// Ensure HttpClient has latest authentication before making request
    /// </summary>
    private void EnsureAuthentication()
    {
        AuthManager.ConfigureHttpClient(HttpClient);
    }

    /// <summary>
    /// Send GET request and deserialize response
    /// </summary>
    protected async Task<T> GetAsync<T>(string endpoint, CancellationToken cancellationToken = default)
    {
        try
        {
            EnsureAuthentication();
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
            EnsureAuthentication();
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
            EnsureAuthentication();
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
            EnsureAuthentication();
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
            EnsureAuthentication();
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
            EnsureAuthentication();
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

            // Log all responses for debugging
            Logger.LogDebug("Response received - Type: {Type}, Content: '{Content}', Length: {Length}",
                typeof(T).Name, content, content?.Length ?? 0);

            if (typeof(T) == typeof(string))
            {
                return (T)(object)content;
            }

            // Define JSON options outside try block so it's accessible in catch block
            var options = new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true,
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            };

            try
            {
                var result = JsonSerializer.Deserialize<T>(content, options);
                Logger.LogDebug("Successfully deserialized response to {Type}", typeof(T).Name);
                return result ?? throw new ApiException("Failed to deserialize response");
            }
            catch (JsonException ex)
            {
                // Special handling for ConfigurationValueResponse when minimal=true
                // Server returns raw value instead of wrapped object
                if (typeof(T).Name == "ConfigurationValueResponse")
                {
                    Logger.LogInformation("Handling minimal response for ConfigurationValueResponse - Content: '{Content}', Length: {Length}",
                        content, content?.Length ?? 0);

                    return CreateConfigurationValueResponse<T>(content, options);
                }

                Logger.LogError(ex, "Failed to deserialize response: {Content}", content);
                throw new ApiException("Failed to deserialize response", ex);
            }
        }

        await HandleErrorResponse(response);
        throw new ApiException("Unexpected error occurred");
    }

    /// <summary>
    /// Create ConfigurationValueResponse from raw content when minimal=true
    /// </summary>
    private T CreateConfigurationValueResponse<T>(string content, JsonSerializerOptions options)
    {
        Logger.LogInformation("CreateConfigurationValueResponse called with content length: {Length}", content?.Length ?? 0);
        Logger.LogDebug("Raw content: {Content}", content);

        // Handle empty or whitespace content
        if (string.IsNullOrWhiteSpace(content))
        {
            Logger.LogWarning("Content is null or whitespace, creating response with null value");
            var nullJson = "{\"value\": null}";
            var nullResult = JsonSerializer.Deserialize<T>(nullJson, options);
            return nullResult ?? throw new ApiException("Failed to create null ConfigurationValueResponse");
        }

        // Handle explicit null response
        if (content.Trim() == "null")
        {
            Logger.LogDebug("Content is explicit null, creating response with null value");
            var nullJson = "{\"value\": null}";
            var nullResult = JsonSerializer.Deserialize<T>(nullJson, options);
            return nullResult ?? throw new ApiException("Failed to create null ConfigurationValueResponse");
        }

        try
        {
            // The content should be valid JSON - let's validate it first
            using var document = JsonDocument.Parse(content);
            var rootElement = document.RootElement;
            Logger.LogDebug("Content parsed successfully - ValueKind: {ValueKind}", rootElement.ValueKind);

            // Create the wrapped response directly as a string
            // We need to embed the original JSON as the value property
            var wrappedJson = "{\"value\": " + content + "}";

            Logger.LogDebug("Created wrapped JSON: {WrappedJson}", wrappedJson);

            // Deserialize the wrapped JSON to the expected type
            var result = JsonSerializer.Deserialize<T>(wrappedJson, options);
            if (result == null)
            {
                Logger.LogError("Failed to deserialize wrapped JSON to type {Type}", typeof(T).Name);
                throw new ApiException("Failed to create ConfigurationValueResponse from minimal response");
            }

            Logger.LogDebug("Successfully created ConfigurationValueResponse of type {Type}", typeof(T).Name);
            return result;
        }
        catch (JsonException jsonEx)
        {
            Logger.LogError(jsonEx, "Content is not valid JSON: {Content}", content);

            // Fallback: treat as a string value
            var stringValue = content.Trim('"'); // Remove surrounding quotes if present
            var escapedString = JsonSerializer.Serialize(stringValue);
            var stringWrappedJson = $"""
                {{
                    "value": {escapedString}
                }}
                """;

            Logger.LogDebug("Created fallback string JSON: {StringJson}", stringWrappedJson);

            var stringResult = JsonSerializer.Deserialize<T>(stringWrappedJson, options);
            return stringResult ?? throw new ApiException("Failed to create fallback ConfigurationValueResponse");
        }
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
