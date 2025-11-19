package rules

import (
	"errors"
	"fmt"
	"regexp"
	"strconv"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"

	"your.module/config-manager/internal/types"
)

type Service struct {
	rulesCol *mongo.Collection
	cfgCol   *mongo.Collection
}

func New(rulesCol, cfgCol *mongo.Collection) *Service {
	return &Service{rulesCol: rulesCol, cfgCol: cfgCol}
}

func (s *Service) FindByConfigurationID(ctx mongo.SessionContext, configID string) ([]types.Rule, error) {
	cur, err := s.rulesCol.Find(ctx, bson.M{"configuration_id": configID})
	if err != nil {
		return nil, err
	}
	defer cur.Close(ctx)
	var rules []types.Rule
	for cur.Next(ctx) {
		var r types.Rule
		if err := cur.Decode(&r); err == nil {
			rules = append(rules, r)
		}
	}
	return rules, nil
}

func (s *Service) FindByConfigurationAndPath(ctx mongo.SessionContext, configID, path string) ([]types.Rule, error) {
	cur, err := s.rulesCol.Find(ctx, bson.M{
		"configuration_id": configID,
		"property_path":    path,
		"enabled":          true,
	})
	if err != nil {
		return nil, err
	}
	defer cur.Close(ctx)
	var rules []types.Rule
	for cur.Next(ctx) {
		var r types.Rule
		if err := cur.Decode(&r); err == nil {
			rules = append(rules, r)
		}
	}
	return rules, nil
}

// FindByConfigurationAndPathWithInheritance: walk parent chain and collect rules
func (s *Service) FindByConfigurationAndPathWithInheritance(ctx mongo.SessionContext, configID, path string) ([]types.Rule, error) {
	var allRules []types.Rule
	curID := configID
	seen := map[string]bool{}

	for curID != "" {
		if seen[curID] {
			break
		}
		seen[curID] = true

		rules, err := s.FindByConfigurationAndPath(ctx, curID, path)
		if err == nil {
			allRules = append(allRules, rules...)
		}

		// get parent
		var cfg types.Configuration
		if err := s.cfgCol.FindOne(ctx, bson.M{"_id": curID}).Decode(&cfg); err != nil {
			break
		}
		if cfg.ParentID == nil || *cfg.ParentID == "" {
			break
		}
		curID = *cfg.ParentID
	}

	return allRules, nil
}

func (s *Service) ValidateValue(ctx mongo.SessionContext, configID, path string, value any) (*types.ValidateResponse, error) {
	rules, err := s.FindByConfigurationAndPathWithInheritance(ctx, configID, path)
	if err != nil {
		return nil, err
	}

	var errors []string
	for _, rule := range rules {
		if !rule.Enabled {
			continue
		}
		if !s.validateSingleRule(rule, value) {
			msg := rule.ErrorMessage
			if msg == "" {
				msg = fmt.Sprintf("Value does not satisfy %s rule", rule.RuleType)
			}
			errors = append(errors, msg)
		}
	}

	return &types.ValidateResponse{
		IsValid: len(errors) == 0,
		Errors:  errors,
	}, nil
}

func (s *Service) validateSingleRule(rule types.Rule, value any) bool {
	switch rule.RuleType {
	case types.RuleNumeric:
		return s.validateNumeric(rule.RuleConfig, value)
	case types.RulePattern:
		return s.validatePattern(rule.RuleConfig, value)
	case types.RuleCollection:
		return s.validateCollection(rule.RuleConfig, value)
	default:
		return false
	}
}

func (s *Service) validateNumeric(config map[string]any, value any) bool {
	numVal, err := toFloat(value)
	if err != nil {
		return false
	}
	op, _ := config["operator"].(string)
	ruleVal, err := toFloat(config["value"])
	if err != nil {
		return false
	}
	switch op {
	case "greater":
		return numVal > ruleVal
	case "smaller":
		return numVal < ruleVal
	case "equals":
		return numVal == ruleVal
	case "greaterEquals":
		return numVal >= ruleVal
	case "smallerEquals":
		return numVal <= ruleVal
	default:
		return false
	}
}

func (s *Service) validatePattern(config map[string]any, value any) bool {
	pattern, _ := config["pattern"].(string)
	flags, _ := config["flags"].(string)
	re, err := regexp.Compile("(?m)" + flags + pattern)
	if err != nil {
		return false
	}
	return re.MatchString(fmt.Sprintf("%v", value))
}

func (s *Service) validateCollection(config map[string]any, value any) bool {
	validVals, ok := config["validValues"].([]any)
	if !ok {
		return false
	}
	for _, vv := range validVals {
		if vv == value {
			return true
		}
	}
	return false
}

func toFloat(v any) (float64, error) {
	switch t := v.(type) {
	case float64:
		return t, nil
	case float32:
		return float64(t), nil
	case int:
		return float64(t), nil
	case int64:
		return float64(t), nil
	case string:
		return strconv.ParseFloat(t, 64)
	default:
		return 0, errors.New("cannot convert to float")
	}
}
