package testutil

import (
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"your.module/config-manager/internal/config"
	"your.module/config-manager/internal/logger"
	mongoClient "your.module/config-manager/internal/mongo"
)

// TestServer wraps test server components
type TestServer struct {
	Router  *gin.Engine
	DB      *mongoClient.Client
	Config  config.Config
	Logger  *logger.Logger
	Cleanup func()
}

// SetupTestServer creates a test server with all dependencies
func SetupTestServer(t *testing.T) *TestServer {
	t.Helper()

	gin.SetMode(gin.TestMode)

	// Setup test database
	db, cleanupDB := SetupTestDB(t)

	// Setup test config
	cfg := config.Config{
		JWTSecret:        "test-jwt-secret",
		APIKey:           "test-api-key",
		ServerPort:       "3004",
		MongoURI:         "mongodb://localhost:27017",
		MongoDB:          db.DB.Name(),
		StorageType:      "embedded",
		EmbeddedPath:     t.TempDir(),
		ServerBaseURL:    "http://localhost:3004",
		MongodumpPath:    "/usr/bin/mongodump",
		MongorestorePath: "/usr/bin/mongorestore",
	}

	// Setup logger
	log := logger.New(logger.InfoLevel) // info level for tests

	router := gin.New()
	router.Use(gin.Recovery())

	cleanup := func() {
		cleanupDB()
		log.Sync()
	}

	return &TestServer{
		Router:  router,
		DB:      db,
		Config:  cfg,
		Logger:  log,
		Cleanup: cleanup,
	}
}

// Request is a helper to make HTTP requests in tests
type Request struct {
	Method      string
	URL         string
	Body        interface{}
	Headers     map[string]string
	QueryParams map[string]string
}

// MakeRequest executes an HTTP request and returns the response
func (ts *TestServer) MakeRequest(req Request) *httptest.ResponseRecorder {
	// This is a placeholder - you would implement proper JSON marshaling,
	// header setting, etc.
	w := httptest.NewRecorder()
	httpReq := httptest.NewRequest(req.Method, req.URL, nil)

	for key, val := range req.Headers {
		httpReq.Header.Set(key, val)
	}

	ts.Router.ServeHTTP(w, httpReq)
	return w
}

// MakeAuthenticatedRequest makes a request with an auth token
func (ts *TestServer) MakeAuthenticatedRequest(req Request, token string) *httptest.ResponseRecorder {
	if req.Headers == nil {
		req.Headers = make(map[string]string)
	}
	req.Headers["Authorization"] = "Bearer " + token
	return ts.MakeRequest(req)
}
