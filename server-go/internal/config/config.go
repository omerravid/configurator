// internal/config/config.go
package config

import "github.com/spf13/viper"

type Config struct {
	ServerPort       string
	MongoURI         string
	MongoDB          string
	JWTSecret        string
	APIKey           string
	StorageType      string // "embedded" | "s3"
	EmbeddedPath     string
	S3Bucket         string
	AWSRegion        string
	ServerBaseURL    string
	MongodumpPath    string
	MongorestorePath string
	LogLevel         string // "debug" | "info" | "warn" | "error"
}

func Load() Config {
	v := viper.New()
	v.AutomaticEnv()

	def := func(k, val string) {
		if !v.IsSet(k) {
			v.Set(k, val)
		}
	}
	def("SERVER_PORT", "3004")
	def("MONGO_DB_NAME", "config_manager")
	def("STORAGE_TYPE", "embedded")
	def("EMBEDDED_STORAGE_PATH", "./data/files")
	def("BACKUP_BIN_MONGODUMP", "/usr/bin/mongodump")
	def("BACKUP_BIN_MONGORESTORE", "/usr/bin/mongorestore")
	def("LOG_LEVEL", "info")

	return Config{
		ServerPort:       v.GetString("SERVER_PORT"),
		MongoURI:         v.GetString("MONGODB_URI"),
		MongoDB:          v.GetString("MONGO_DB_NAME"),
		JWTSecret:        v.GetString("JWT_SECRET"),
		APIKey:           v.GetString("API_KEY"),
		StorageType:      v.GetString("STORAGE_TYPE"),
		EmbeddedPath:     v.GetString("EMBEDDED_STORAGE_PATH"),
		S3Bucket:         v.GetString("S3_BUCKET_NAME"),
		AWSRegion:        v.GetString("AWS_REGION"),
		ServerBaseURL:    v.GetString("SERVER_BASE_URL"),
		MongodumpPath:    v.GetString("BACKUP_BIN_MONGODUMP"),
		MongorestorePath: v.GetString("BACKUP_BIN_MONGORESTORE"),
		LogLevel:         v.GetString("LOG_LEVEL"),
	}
}
