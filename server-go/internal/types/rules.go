package types

import "time"

type RuleType string

const (
	RuleNumeric    RuleType = "numeric"
	RulePattern    RuleType = "pattern"
	RuleCollection RuleType = "collection"
)

type Rule struct {
	ID              string         `bson:"_id,omitempty" json:"id"`
	ConfigurationID string         `bson:"configuration_id" json:"configurationId"`
	PropertyPath    string         `bson:"property_path" json:"propertyPath"`
	RuleType        RuleType       `bson:"rule_type" json:"ruleType"`
	RuleConfig      map[string]any `bson:"rule_config" json:"ruleConfig"`
	ErrorMessage    string         `bson:"error_message,omitempty" json:"errorMessage,omitempty"`
	Enabled         bool           `bson:"enabled" json:"enabled"`
	CreatedBy       string         `bson:"created_by" json:"created_by"`
	CreatedAt       time.Time      `bson:"created_at" json:"created_at"`
	UpdatedAt       time.Time      `bson:"updated_at" json:"updated_at"`
}

type CreateRuleRequest struct {
	ConfigurationID string         `json:"configurationId" binding:"required"`
	PropertyPath    string         `json:"propertyPath" binding:"required,min=1"`
	RuleType        RuleType       `json:"ruleType" binding:"required,oneof=numeric pattern collection"`
	RuleConfig      map[string]any `json:"ruleConfig" binding:"required"`
	ErrorMessage    string         `json:"errorMessage"`
	Enabled         *bool          `json:"enabled"`
}

type UpdateRuleRequest struct {
	PropertyPath *string        `json:"propertyPath,omitempty"`
	RuleType     *RuleType      `json:"ruleType,omitempty"`
	RuleConfig   map[string]any `json:"ruleConfig,omitempty"`
	ErrorMessage *string        `json:"errorMessage,omitempty"`
	Enabled      *bool          `json:"enabled,omitempty"`
}

type ValidateValueRequest struct {
	ConfigurationID string `json:"configurationId" binding:"required"`
	PropertyPath    string `json:"propertyPath" binding:"required,min=1"`
	Value           any    `json:"value" binding:"required"`
}

type ValidateResponse struct {
	IsValid bool     `json:"isValid"`
	Errors  []string `json:"errors"`
}
