package configmanager

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// HTTPClient provides HTTP operations with authentication
type HTTPClient struct {
	baseURL    string
	apiKey     string
	jwtToken   string
	httpClient *http.Client
	userAgent  string
}

// NewHTTPClient creates a new HTTP client with the specified options
func NewHTTPClient(options *ClientOptions) *HTTPClient {
	httpClient := options.HTTPClient
	if httpClient == nil {
		httpClient = &http.Client{
			Timeout: options.Timeout,
		}
	}

	return &HTTPClient{
		baseURL:    strings.TrimSuffix(options.BaseURL, "/"),
		apiKey:     options.APIKey,
		jwtToken:   options.JWTToken,
		httpClient: httpClient,
		userAgent:  options.UserAgent,
	}
}

// SetJWTToken updates the JWT token for authentication
func (c *HTTPClient) SetJWTToken(token string) {
	c.jwtToken = token
}

// SetAPIKey updates the API key for authentication
func (c *HTTPClient) SetAPIKey(apiKey string) {
	c.apiKey = apiKey
}

// Get performs a GET request
func (c *HTTPClient) Get(ctx context.Context, path string) (*http.Response, error) {
	return c.do(ctx, http.MethodGet, path, nil, nil)
}

// GetWithQuery performs a GET request with query parameters
func (c *HTTPClient) GetWithQuery(ctx context.Context, path string, params url.Values) (*http.Response, error) {
	if len(params) > 0 {
		path = path + "?" + params.Encode()
	}
	return c.Get(ctx, path)
}

// Post performs a POST request with JSON body
func (c *HTTPClient) Post(ctx context.Context, path string, body interface{}) (*http.Response, error) {
	return c.do(ctx, http.MethodPost, path, body, map[string]string{
		"Content-Type": "application/json",
	})
}

// PostForm performs a POST request with form data
func (c *HTTPClient) PostForm(ctx context.Context, path string, data url.Values) (*http.Response, error) {
	return c.do(ctx, http.MethodPost, path, strings.NewReader(data.Encode()), map[string]string{
		"Content-Type": "application/x-www-form-urlencoded",
	})
}

// PostMultipart performs a POST request with multipart form data
func (c *HTTPClient) PostMultipart(ctx context.Context, path string, body *bytes.Buffer, contentType string) (*http.Response, error) {
	return c.do(ctx, http.MethodPost, path, body, map[string]string{
		"Content-Type": contentType,
	})
}

// Put performs a PUT request with JSON body
func (c *HTTPClient) Put(ctx context.Context, path string, body interface{}) (*http.Response, error) {
	return c.do(ctx, http.MethodPut, path, body, map[string]string{
		"Content-Type": "application/json",
	})
}

// Delete performs a DELETE request
func (c *HTTPClient) Delete(ctx context.Context, path string) (*http.Response, error) {
	return c.do(ctx, http.MethodDelete, path, nil, nil)
}

// do performs the actual HTTP request
func (c *HTTPClient) do(ctx context.Context, method, path string, body interface{}, headers map[string]string) (*http.Response, error) {
	// Build URL
	fullURL := c.baseURL + path

	// Prepare body
	var reqBody io.Reader
	if body != nil {
		switch v := body.(type) {
		case io.Reader:
			reqBody = v
		case string:
			reqBody = strings.NewReader(v)
		case []byte:
			reqBody = bytes.NewReader(v)
		default:
			// JSON encode
			jsonData, err := json.Marshal(body)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal request body: %w", err)
			}
			reqBody = bytes.NewReader(jsonData)
		}
	}

	// Create request
	req, err := http.NewRequestWithContext(ctx, method, fullURL, reqBody)
	if err != nil {
		return nil, NewNetworkError(fmt.Sprintf("failed to create request: %v", err), err)
	}

	// Set headers
	c.setHeaders(req, headers)

	// Perform request
	resp, err := c.httpClient.Do(req)
	if err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			return nil, NewTimeoutError("request timed out", c.httpClient.Timeout)
		}
		return nil, NewNetworkError(fmt.Sprintf("request failed: %v", err), err)
	}

	// Check for HTTP errors
	if resp.StatusCode >= 400 {
		return resp, c.handleErrorResponse(resp)
	}

	return resp, nil
}

// setHeaders sets the appropriate headers for the request
func (c *HTTPClient) setHeaders(req *http.Request, additionalHeaders map[string]string) {
	// Set User-Agent
	if c.userAgent != "" {
		req.Header.Set("User-Agent", c.userAgent)
	}

	// Set authentication headers
	if c.jwtToken != "" {
		req.Header.Set("Authorization", "Bearer "+c.jwtToken)
	} else if c.apiKey != "" {
		req.Header.Set("X-API-Key", c.apiKey)
	}

	// Set additional headers
	for key, value := range additionalHeaders {
		req.Header.Set(key, value)
	}

	// Set Accept header if not already set
	if req.Header.Get("Accept") == "" {
		req.Header.Set("Accept", "application/json")
	}
}

// handleErrorResponse handles HTTP error responses and creates appropriate error types
func (c *HTTPClient) handleErrorResponse(resp *http.Response) error {
	defer resp.Body.Close()

	// Read response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return NewHTTPError(fmt.Sprintf("failed to read error response: %v", err), nil, resp)
	}

	// Try to parse as API error response
	var apiError APIErrorResponse
	if err := json.Unmarshal(body, &apiError); err != nil {
		// If parsing fails, use raw body as error message
		apiError.Error = string(body)
	}

	message := apiError.Error
	if message == "" {
		message = fmt.Sprintf("HTTP %d error", resp.StatusCode)
	}

	// Create specific error types based on status code
	switch resp.StatusCode {
	case http.StatusUnauthorized:
		return NewAuthenticationError(message, resp.StatusCode)
	case http.StatusForbidden:
		return NewAuthorizationError(message, resp.StatusCode)
	case http.StatusNotFound:
		return NewNotFoundError(message, resp.StatusCode)
	case http.StatusBadRequest:
		return NewValidationError(message, resp.StatusCode)
	case http.StatusConflict:
		return NewConflictError(message, resp.StatusCode)
	case http.StatusTooManyRequests:
		// Default retry after 1 minute if not specified
		retryAfter := time.Now().Add(time.Minute)
		return NewRateLimitError(message, resp.StatusCode, &retryAfter)
	default:
		return NewAPIError(message, resp.StatusCode, &apiError)
	}
}

// DecodeJSON decodes JSON response body into the provided interface
func (c *HTTPClient) DecodeJSON(resp *http.Response, v interface{}) error {
	defer resp.Body.Close()

	if err := json.NewDecoder(resp.Body).Decode(v); err != nil {
		return fmt.Errorf("failed to decode JSON response: %w", err)
	}

	return nil
}

// CreateMultipartForm creates a multipart form for file uploads
func (c *HTTPClient) CreateMultipartForm() (*bytes.Buffer, *multipart.Writer) {
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	return body, writer
}

// CloseResponse safely closes a response body
func (c *HTTPClient) CloseResponse(resp *http.Response) {
	if resp != nil && resp.Body != nil {
		resp.Body.Close()
	}
}
