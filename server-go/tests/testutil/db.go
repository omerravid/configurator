package testutil

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	mongoClient "your.module/config-manager/internal/mongo"
)

// SetupTestDB creates a test database with a unique name and returns a cleanup function
func SetupTestDB(t *testing.T) (*mongoClient.Client, func()) {
	t.Helper()

	uri := "mongodb://localhost:27017"
	dbName := fmt.Sprintf("test_db_%d", time.Now().UnixNano())

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	client, err := mongo.Connect(ctx, options.Client().ApplyURI(uri))
	require.NoError(t, err, "Failed to connect to MongoDB")

	// Ping to verify connection
	err = client.Ping(ctx, nil)
	require.NoError(t, err, "Failed to ping MongoDB")

	db := client.Database(dbName)

	// Create our custom client wrapper
	testClient := &mongoClient.Client{
		MongoClient:    client,
		DB:             db,
		Users:          db.Collection("users"),
		Configurations: db.Collection("configurations"),
		Rules:          db.Collection("rules"),
	}

	// Create indexes if the function exists
	// Note: You may need to implement this or comment it out
	// err = mongoClient.CreateIndexes(context.Background(), testClient)
	// require.NoError(t, err, "Failed to create indexes")

	cleanup := func() {
		ctx := context.Background()
		_ = db.Drop(ctx)
		_ = client.Disconnect(ctx)
	}

	return testClient, cleanup
}

// SetupTestDBWithData creates a test database and seeds it with initial data
func SetupTestDBWithData(t *testing.T, seedFunc func(*mongoClient.Client)) (*mongoClient.Client, func()) {
	t.Helper()

	client, cleanup := SetupTestDB(t)

	if seedFunc != nil {
		seedFunc(client)
	}

	return client, cleanup
}

