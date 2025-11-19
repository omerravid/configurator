package logger

import (
	"context"
	"os"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

// Logger wraps zap.Logger to provide structured logging with context support
type Logger struct {
	*zap.Logger
}

// LogLevel represents the logging level
type LogLevel string

const (
	DebugLevel LogLevel = "debug"
	InfoLevel  LogLevel = "info"
	WarnLevel  LogLevel = "warn"
	ErrorLevel LogLevel = "error"
)

// New creates a new Logger instance with the specified log level
// Logs are written to both stdout and can be collected by Docker logging drivers
func New(level LogLevel) *Logger {
	// Parse log level
	var zapLevel zapcore.Level
	switch level {
	case DebugLevel:
		zapLevel = zapcore.DebugLevel
	case InfoLevel:
		zapLevel = zapcore.InfoLevel
	case WarnLevel:
		zapLevel = zapcore.WarnLevel
	case ErrorLevel:
		zapLevel = zapcore.ErrorLevel
	default:
		zapLevel = zapcore.InfoLevel
	}

	// Create encoder config for human-readable output
	encoderConfig := zapcore.EncoderConfig{
		TimeKey:        "timestamp",
		LevelKey:       "level",
		NameKey:        "logger",
		CallerKey:      "caller",
		FunctionKey:    zapcore.OmitKey,
		MessageKey:     "message",
		StacktraceKey:  "stacktrace",
		LineEnding:     zapcore.DefaultLineEnding,
		EncodeLevel:    zapcore.CapitalColorLevelEncoder, // Colored output for readability
		EncodeTime:     zapcore.ISO8601TimeEncoder,
		EncodeDuration: zapcore.StringDurationEncoder,
		EncodeCaller:   zapcore.ShortCallerEncoder,
	}

	// Create core that writes to stdout (Docker will capture this)
	core := zapcore.NewCore(
		zapcore.NewConsoleEncoder(encoderConfig),
		zapcore.AddSync(os.Stdout),
		zapLevel,
	)

	// Build logger with caller information
	logger := zap.New(core, zap.AddCaller(), zap.AddCallerSkip(1))

	return &Logger{Logger: logger}
}

// Sync flushes any buffered log entries
func (l *Logger) Sync() {
	_ = l.Logger.Sync()
}

// Debug logs a debug message
func (l *Logger) Debug(msg string, fields ...zap.Field) {
	l.Logger.Debug(msg, fields...)
}

// DebugCtx logs a debug message with context
func (l *Logger) DebugCtx(ctx context.Context, msg string, fields ...zap.Field) {
	fields = append(fields, contextFields(ctx)...)
	l.Logger.Debug(msg, fields...)
}

// Debugf logs a debug message with formatting (convenience method)
func (l *Logger) Debugf(template string, args ...interface{}) {
	l.Logger.Sugar().Debugf(template, args...)
}

// Info logs an info message
func (l *Logger) Info(msg string, fields ...zap.Field) {
	l.Logger.Info(msg, fields...)
}

// InfoCtx logs an info message with context
func (l *Logger) InfoCtx(ctx context.Context, msg string, fields ...zap.Field) {
	fields = append(fields, contextFields(ctx)...)
	l.Logger.Info(msg, fields...)
}

// Infof logs an info message with formatting (convenience method)
func (l *Logger) Infof(template string, args ...interface{}) {
	l.Logger.Sugar().Infof(template, args...)
}

// Warn logs a warning message
func (l *Logger) Warn(msg string, fields ...zap.Field) {
	l.Logger.Warn(msg, fields...)
}

// WarnCtx logs a warning message with context
func (l *Logger) WarnCtx(ctx context.Context, msg string, fields ...zap.Field) {
	fields = append(fields, contextFields(ctx)...)
	l.Logger.Warn(msg, fields...)
}

// Warnf logs a warning message with formatting (convenience method)
func (l *Logger) Warnf(template string, args ...interface{}) {
	l.Logger.Sugar().Warnf(template, args...)
}

// Error logs an error message
func (l *Logger) Error(msg string, fields ...zap.Field) {
	l.Logger.Error(msg, fields...)
}

// ErrorCtx logs an error message with context
func (l *Logger) ErrorCtx(ctx context.Context, msg string, fields ...zap.Field) {
	fields = append(fields, contextFields(ctx)...)
	l.Logger.Error(msg, fields...)
}

// Errorf logs an error message with formatting (convenience method)
func (l *Logger) Errorf(template string, args ...interface{}) {
	l.Logger.Sugar().Errorf(template, args...)
}

// Fatal logs a fatal message and exits
func (l *Logger) Fatal(msg string, fields ...zap.Field) {
	l.Logger.Fatal(msg, fields...)
}

// FatalCtx logs a fatal message with context and exits
func (l *Logger) FatalCtx(ctx context.Context, msg string, fields ...zap.Field) {
	fields = append(fields, contextFields(ctx)...)
	l.Logger.Fatal(msg, fields...)
}

// Fatalf logs a fatal message with formatting and exits (convenience method)
func (l *Logger) Fatalf(template string, args ...interface{}) {
	l.Logger.Sugar().Fatalf(template, args...)
}

// With creates a child logger with additional fields
func (l *Logger) With(fields ...zap.Field) *Logger {
	return &Logger{Logger: l.Logger.With(fields...)}
}

// WithContext creates a child logger with context fields
func (l *Logger) WithContext(ctx context.Context) *Logger {
	return &Logger{Logger: l.Logger.With(contextFields(ctx)...)}
}

// contextFields extracts useful fields from context
// You can extend this to extract request IDs, user IDs, trace IDs, etc.
func contextFields(ctx context.Context) []zap.Field {
	fields := []zap.Field{}

	// Extract request ID if present
	if reqID := ctx.Value("requestId"); reqID != nil {
		if id, ok := reqID.(string); ok {
			fields = append(fields, zap.String("requestId", id))
		}
	}

	// Extract user ID if present
	if userID := ctx.Value("userId"); userID != nil {
		if id, ok := userID.(string); ok {
			fields = append(fields, zap.String("userId", id))
		}
	}

	// Extract username if present
	if username := ctx.Value("username"); username != nil {
		if name, ok := username.(string); ok {
			fields = append(fields, zap.String("username", name))
		}
	}

	return fields
}

// Convenience field constructors (re-export zap field constructors)
var (
	String   = zap.String
	Int      = zap.Int
	Int64    = zap.Int64
	Float64  = zap.Float64
	Bool     = zap.Bool
	Error    = zap.Error
	Any      = zap.Any
	Duration = zap.Duration
	Time     = zap.Time
	Strings  = zap.Strings
	Ints     = zap.Ints
)
