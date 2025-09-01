package configmanager

import (
	"encoding/json"
	"time"
)

// Rule represents a validation rule entity
type Rule struct {
	ID              string          `json:"id"`
	ConfigurationID string          `json:"configurationId"`
	PropertyPath    string          `json:"propertyPath"`
	RuleType        RuleType        `json:"ruleType"`
	RuleConfig      json.RawMessage `json:"ruleConfig"`
	ErrorMessage    *string         `json:"errorMessage,omitempty"`
	Enabled         bool            `json:"enabled"`
	CreatedAt       time.Time       `json:"created_at"`
	UpdatedAt       time.Time       `json:"updated_at"`
}

// RulesListResponse represents rules list response
type RulesListResponse struct {
	Rules []Rule `json:"rules"`
}

// CreateRuleRequest represents create rule request
type CreateRuleRequest struct {
	ConfigurationID string      `json:"configurationId"`
	PropertyPath    string      `json:"propertyPath"`
	RuleType        RuleType    `json:"ruleType"`
	RuleConfig      interface{} `json:"ruleConfig"`
	ErrorMessage    *string     `json:"errorMessage,omitempty"`
	Enabled         *bool       `json:"enabled,omitempty"`
}

// UpdateRuleRequest represents update rule request
type UpdateRuleRequest struct {
	PropertyPath *string     `json:"propertyPath,omitempty"`
	RuleType     *RuleType   `json:"ruleType,omitempty"`
	RuleConfig   interface{} `json:"ruleConfig,omitempty"`
	ErrorMessage *string     `json:"errorMessage,omitempty"`
	Enabled      *bool       `json:"enabled,omitempty"`
}

// RuleResponse represents rule response
type RuleResponse struct {
	Rule Rule `json:"rule"`
}

// ValidateRuleRequest represents rule validation request
type ValidateRuleRequest struct {
	ConfigurationID string          `json:"configurationId"`
	PropertyPath    string          `json:"propertyPath"`
	Value           json.RawMessage `json:"value"`
}

// RuleValidationResponse represents rule validation response
type RuleValidationResponse struct {
	Valid    bool     `json:"valid"`
	Errors   []string `json:"errors,omitempty"`
	Warnings []string `json:"warnings,omitempty"`
}

// GetRulesOptions represents options for getting rules
type GetRulesOptions struct {
	ConfigurationID string `json:"configurationId"`
}

// GetRulesForPathOptions represents options for getting rules for a specific path
type GetRulesForPathOptions struct {
	IncludeInherited *bool `json:"includeInherited,omitempty"`
}

// NumericRuleConfig represents numeric rule configuration
type NumericRuleConfig struct {
	Min      *float64 `json:"min,omitempty"`
	Max      *float64 `json:"max,omitempty"`
	Step     *float64 `json:"step,omitempty"`
	Required bool     `json:"required"`
}

// PatternRuleConfig represents pattern rule configuration
type PatternRuleConfig struct {
	Pattern  string  `json:"pattern"`
	Flags    *string `json:"flags,omitempty"`
	Required bool    `json:"required"`
}

// CollectionRuleConfig represents collection rule configuration
type CollectionRuleConfig struct {
	AllowedValues []json.RawMessage `json:"allowedValues,omitempty"`
	MinItems      *int              `json:"minItems,omitempty"`
	MaxItems      *int              `json:"maxItems,omitempty"`
	UniqueItems   bool              `json:"uniqueItems"`
	Required      bool              `json:"required"`
}

// RulesService provides validation rules operations
type RulesService struct {
	client *HTTPClient
}

// NewRulesService creates a new rules service
func NewRulesService(client *HTTPClient) *RulesService {
	return &RulesService{client: client}
}
