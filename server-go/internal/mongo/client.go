package mongo

import (
	"context"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	"your.module/config-manager/internal/config"
	"your.module/config-manager/internal/logger"
)

type Client struct {
	DB             *mongo.Database
	Users          *mongo.Collection
	Configurations *mongo.Collection
	Rules          *mongo.Collection
}

func Connect(cfg config.Config, log *logger.Logger) (*Client, func(context.Context) error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cl, err := mongo.Connect(ctx, options.Client().ApplyURI(cfg.MongoURI))
	if err != nil {
		panic(err)
	}

	db := cl.Database(cfg.MongoDB)
	c := &Client{
		DB:             db,
		Users:          db.Collection("users"),
		Configurations: db.Collection("configurations"),
		Rules:          db.Collection("rules"),
	}
	EnsureIndexes(ctx, c)
	return c, cl.Disconnect
}

func EnsureIndexes(ctx context.Context, c *Client) {
	// users.username unique
	_, _ = c.Users.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    bson.D{{Key: "username", Value: 1}},
		Options: options.Index().SetUnique(true).SetName("ux_users_username"),
	})
	// configurations: unique (name,type); type; parent_id; archived
	_, _ = c.Configurations.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "name", Value: 1}, {Key: "type", Value: 1}},
			Options: options.Index().SetUnique(true).SetName("ux_configs_name_type"),
		},
		{Keys: bson.D{{Key: "type", Value: 1}}, Options: options.Index().SetName("ix_configs_type")},
		{Keys: bson.D{{Key: "parent_id", Value: 1}}, Options: options.Index().SetName("ix_configs_parent")},
		{Keys: bson.D{{Key: "archived", Value: 1}}, Options: options.Index().SetName("ix_configs_archived")},
	})
	_, _ = c.Rules.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{Keys: bson.D{{Key: "configuration_id", Value: 1}}, Options: options.Index().SetName("ix_rules_config")},
		{Keys: bson.D{{Key: "property_path", Value: 1}}, Options: options.Index().SetName("ix_rules_path")},
		{Keys: bson.D{{Key: "enabled", Value: 1}}, Options: options.Index().SetName("ix_rules_enabled")},
	})
}
