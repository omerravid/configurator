.PHONY: help test test-unit test-integration test-coverage test-race test-verbose clean mocks

# Default target
help:
	@echo "Available targets:"
	@echo "  test               - Run all tests"
	@echo "  test-unit          - Run only unit tests (fast)"
	@echo "  test-integration   - Run only integration tests"
	@echo "  test-coverage      - Run tests with coverage report"
	@echo "  test-race          - Run tests with race detector"
	@echo "  test-verbose       - Run tests with verbose output"
	@echo "  mocks              - Generate mocks for testing"
	@echo "  clean              - Clean test cache and artifacts"

# Run all tests
test:
	@echo "Running all tests..."
	go test ./... -timeout 30s

# Run only unit tests (using short flag)
test-unit:
	@echo "Running unit tests..."
	go test -short ./... -timeout 10s

# Run only integration tests
test-integration:
	@echo "Running integration tests..."
	go test -run Integration ./... -timeout 60s

# Run tests with coverage
test-coverage:
	@echo "Running tests with coverage..."
	go test ./... -coverprofile=coverage.out -covermode=atomic -timeout 30s
	@echo "\nCoverage Summary:"
	go tool cover -func=coverage.out | grep total
	@echo "\nTo view detailed HTML coverage report, run:"
	@echo "  go tool cover -html=coverage.out"

# View coverage in browser
coverage-html: test-coverage
	go tool cover -html=coverage.out

# Run tests with race detector
test-race:
	@echo "Running tests with race detector..."
	go test -race ./... -timeout 60s

# Run tests with verbose output
test-verbose:
	@echo "Running tests with verbose output..."
	go test -v ./... -timeout 30s

# Run specific package tests
test-auth:
	@echo "Running auth tests..."
	go test -v ./internal/auth/... ./internal/http/handlers/auth_test.go

test-configs:
	@echo "Running configs tests..."
	go test -v ./internal/configs/...

test-rules:
	@echo "Running rules tests..."
	go test -v ./internal/rules/...

test-middleware:
	@echo "Running middleware tests..."
	go test -v ./internal/http/middleware/...

# Generate mocks (requires gomock)
mocks:
	@echo "Generating mocks..."
	@echo "Installing mockgen if not present..."
	go install go.uber.org/mock/mockgen@latest
	@echo "Generating storage mock..."
	mockgen -source=internal/files/storage.go -destination=internal/files/mocks/storage_mock.go -package=mocks
	@echo "Mocks generated successfully!"

# Clean test cache and artifacts
clean:
	@echo "Cleaning test cache and artifacts..."
	go clean -testcache
	rm -f coverage.out
	rm -f coverage.html
	@echo "Clean complete!"

# Install test dependencies
install-deps:
	@echo "Installing test dependencies..."
	go get github.com/stretchr/testify
	go get go.uber.org/mock
	@echo "Dependencies installed!"

# Run tests in CI mode (with coverage and race detector)
test-ci:
	@echo "Running tests in CI mode..."
	go test -v -race -coverprofile=coverage.out -covermode=atomic ./... -timeout 60s

# Watch mode (requires entr or similar)
# Usage: make test-watch
test-watch:
	@echo "Watching for changes..."
	find . -name "*.go" | entr -c make test

# Benchmark tests
benchmark:
	@echo "Running benchmarks..."
	go test -bench=. -benchmem ./...

# Test a specific function
# Usage: make test-func FUNC=TestLogin
test-func:
	@echo "Running test function: $(FUNC)"
	go test -v -run $(FUNC) ./...

# Quick test (no cache, short)
test-quick:
	go test -short -count=1 ./...










