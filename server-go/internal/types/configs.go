package types

import "time"

type ConfigType string

const (
	ConfigProduct   ConfigType = "PRODUCT"
	ConfigInstance  ConfigType = "INSTANCE"
	ConfigUser      ConfigType = "USER"
	ConfigComponent ConfigType = "COMPONENT"
	ConfigVersion   ConfigType = "VERSION"
)

type ConfigStatus string

const (
	StatusDraft     ConfigStatus = "DRAFT"
	StatusCommitted ConfigStatus = "COMMITTED"
)

type Configuration struct {
	ID          string         `bson:"_id,omitempty" json:"id"`
	Name        string         `bson:"name" json:"name"`
	Type        ConfigType     `bson:"type" json:"type"`
	ParentID    *string        `bson:"parent_id,omitempty" json:"parent_id,omitempty"`
	Data        map[string]any `bson:"data,omitempty" json:"data,omitempty"`
	CreatedBy   string         `bson:"created_by" json:"created_by"`
	Description string         `bson:"description,omitempty" json:"description,omitempty"`
	Status      ConfigStatus   `bson:"status" json:"status"`
	Archived    bool           `bson:"archived" json:"archived"`
	CreatedAt   time.Time      `bson:"created_at" json:"created_at"`
	UpdatedAt   time.Time      `bson:"updated_at" json:"updated_at"`
}

type CreateConfigRequest struct {
	Name        string         `json:"name" binding:"required,min=3,max=100"`
	Type        ConfigType     `json:"type" binding:"required,oneof=PRODUCT INSTANCE USER COMPONENT VERSION"`
	ParentID    *string        `json:"parent_id"`
	Data        map[string]any `json:"data"`
	Description string         `json:"description"`
}

type UpdateConfigRequest struct {
	Data        map[string]any `json:"data,omitempty"`
	Description *string        `json:"description,omitempty"`
}

type RenameConfigRequest struct {
	Name string `json:"name" binding:"required,min=3,max=100"`
}

type ResolveResult struct {
	Resolved map[string]any `json:"resolved"`
	Metadata struct {
		ConfigID    string `json:"configId"`
		ConfigName  string `json:"configName"`
		ConfigType  string `json:"configType"`
		ChainLength int    `json:"chainLength"`
	} `json:"metadata"`
}
