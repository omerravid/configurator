package rules

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.mongodb.org/mongo-driver/mongo"

	"your.module/config-manager/tests/fixtures"
	"your.module/config-manager/tests/testutil"
)

// Example of integration-style unit test using real database
// This tests actual MongoDB interactions

func TestValidateNumeric_AllOperators_WorksCorrectly(t *testing.T) {
	// Table-driven test for numeric validation
	tests := []struct {
		name     string
		operator string
		ruleVal  float64
		testVal  interface{}
		want     bool
	}{
		// Greater than
		{"greater - true", "greater", 10.0, 15.0, true},
		{"greater - false", "greater", 10.0, 5.0, false},
		{"greater - equal", "greater", 10.0, 10.0, false},

		// Smaller than
		{"smaller - true", "smaller", 10.0, 5.0, true},
		{"smaller - false", "smaller", 10.0, 15.0, false},
		{"smaller - equal", "smaller", 10.0, 10.0, false},

		// Equals
		{"equals - true", "equals", 10.0, 10.0, true},
		{"equals - false int", "equals", 10.0, 11.0, false},
		{"equals - false float", "equals", 10.5, 10.6, false},

		// Greater or equals
		{"greaterEquals - greater", "greaterEquals", 10.0, 15.0, true},
		{"greaterEquals - equal", "greaterEquals", 10.0, 10.0, true},
		{"greaterEquals - smaller", "greaterEquals", 10.0, 5.0, false},

		// Smaller or equals
		{"smallerEquals - smaller", "smallerEquals", 10.0, 5.0, true},
		{"smallerEquals - equal", "smallerEquals", 10.0, 10.0, true},
		{"smallerEquals - greater", "smallerEquals", 10.0, 15.0, false},

		// Type conversions
		{"int to float", "equals", 10.0, 10, true},
		{"string number", "equals", 10.0, "10", true},
		{"float32", "equals", 10.0, float32(10.0), true},
		{"int64", "equals", 10.0, int64(10), true},

		// Edge cases
		{"negative numbers", "greater", -5.0, -3.0, true},
		{"zero comparison", "greater", 0.0, 1.0, true},
		{"decimal precision", "equals", 10.123, 10.123, true},

		// Invalid operator
		{"invalid operator", "invalid", 10.0, 10.0, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Arrange
			s := &Service{} // No DB needed for this pure logic
			config := map[string]interface{}{
				"operator": tt.operator,
				"value":    tt.ruleVal,
			}

			// Act
			result := s.validateNumeric(config, tt.testVal)

			// Assert
			assert.Equal(t, tt.want, result)
		})
	}
}

func TestValidatePattern_RegexMatching_WorksCorrectly(t *testing.T) {
	tests := []struct {
		name    string
		pattern string
		flags   string
		value   interface{}
		want    bool
	}{
		{"simple match", "^hello$", "", "hello", true},
		{"simple no match", "^hello$", "", "world", false},
		{"email pattern valid", `^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$`, "", "test@example.com", true},
		{"email pattern invalid", `^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$`, "", "invalid-email", false},
		{"numeric pattern", `^\d+$`, "", "12345", true},
		{"numeric pattern non-match", `^\d+$`, "", "abc123", false},
		{"partial match", "world", "", "hello world", true},
		{"case sensitive", "^Hello$", "", "hello", false},
		{"with special chars", `^\+\d{1,3}-\d{3}-\d{4}$`, "", "+1-555-1234", true},
		{"number as string", `^\d+$`, "", 12345, true}, // Converted to string
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Arrange
			s := &Service{}
			config := map[string]interface{}{
				"pattern": tt.pattern,
				"flags":   tt.flags,
			}

			// Act
			result := s.validatePattern(config, tt.value)

			// Assert
			assert.Equal(t, tt.want, result, "Pattern validation result mismatch")
		})
	}
}

func TestValidatePattern_InvalidRegex_ReturnsFalse(t *testing.T) {
	// Arrange
	s := &Service{}
	config := map[string]interface{}{
		"pattern": "[invalid(regex",
		"flags":   "",
	}

	// Act
	result := s.validatePattern(config, "test")

	// Assert
	assert.False(t, result, "Invalid regex should return false")
}

func TestValidateCollection_EnumValues_WorksCorrectly(t *testing.T) {
	tests := []struct {
		name        string
		validValues []interface{}
		testValue   interface{}
		want        bool
	}{
		{"string in list", []interface{}{"red", "green", "blue"}, "red", true},
		{"string not in list", []interface{}{"red", "green", "blue"}, "yellow", false},
		{"number in list", []interface{}{1, 2, 3}, 2, true},
		{"number not in list", []interface{}{1, 2, 3}, 5, false},
		{"mixed types", []interface{}{"red", 1, true}, true, true},
		{"empty list", []interface{}{}, "anything", false},
		{"nil value", []interface{}{"red", "green"}, nil, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Arrange
			s := &Service{}
			config := map[string]interface{}{
				"validValues": tt.validValues,
			}

			// Act
			result := s.validateCollection(config, tt.testValue)

			// Assert
			assert.Equal(t, tt.want, result)
		})
	}
}

func TestToFloat_TypeConversions_WorkCorrectly(t *testing.T) {
	tests := []struct {
		name      string
		input     interface{}
		wantVal   float64
		wantError bool
	}{
		{"float64", 10.5, 10.5, false},
		{"float32", float32(10.5), 10.5, false},
		{"int", 10, 10.0, false},
		{"int64", int64(10), 10.0, false},
		{"string valid", "10.5", 10.5, false},
		{"string invalid", "not-a-number", 0, true},
		{"bool", true, 0, true},
		{"nil", nil, 0, true},
		{"negative", -5.5, -5.5, false},
		{"zero", 0, 0.0, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Act
			result, err := toFloat(tt.input)

			// Assert
			if tt.wantError {
				assert.Error(t, err, "Expected an error")
			} else {
				require.NoError(t, err, "Should not return error")
				assert.Equal(t, tt.wantVal, result)
			}
		})
	}
}

// Example of test using real database
func TestValidateValue_WithDatabase_ValidatesCorrectly(t *testing.T) {
	// Arrange
	db, cleanup := testutil.SetupTestDB(t)
	defer cleanup()

	ctx := mongo.NewSessionContext(context.Background(), nil)

	service := New(db.Rules, db.Configurations)

	// Insert a test configuration
	config := fixtures.ProductConfig("TestProduct")
	_, err := db.Configurations.InsertOne(ctx, config)
	require.NoError(t, err)

	// Insert a numeric rule for price
	priceRule := fixtures.NumericRule(config.ID, "price", "greater", 50.0)
	_, err = db.Rules.InsertOne(ctx, priceRule)
	require.NoError(t, err)

	tests := []struct {
		name      string
		value     interface{}
		wantValid bool
	}{
		{"valid - greater than 50", 100, true},
		{"invalid - less than 50", 30, false},
		{"invalid - equal to 50", 50, false},
		{"valid - much greater", 1000, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Act
			result, err := service.ValidateValue(ctx, config.ID, "price", tt.value)

			// Assert
			require.NoError(t, err)
			assert.Equal(t, tt.wantValid, result.IsValid)

			if !tt.wantValid {
				assert.NotEmpty(t, result.Errors, "Should have error messages")
			}
		})
	}
}

func TestValidateValue_MultipleRules_AllMustPass(t *testing.T) {
	// Arrange
	db, cleanup := testutil.SetupTestDB(t)
	defer cleanup()

	ctx := mongo.NewSessionContext(context.Background(), nil)
	service := New(db.Rules, db.Configurations)

	// Create config
	config := fixtures.ProductConfig("TestProduct")
	_, err := db.Configurations.InsertOne(ctx, config)
	require.NoError(t, err)

	// Add multiple rules for the same property
	rule1 := fixtures.NumericRule(config.ID, "price", "greater", 50.0)
	rule1.ID = "rule1"
	rule2 := fixtures.NumericRule(config.ID, "price", "smaller", 1000.0)
	rule2.ID = "rule2"

	_, err = db.Rules.InsertMany(ctx, []interface{}{rule1, rule2})
	require.NoError(t, err)

	tests := []struct {
		name      string
		value     float64
		wantValid bool
	}{
		{"valid - between 50 and 1000", 100, true},
		{"invalid - too low", 30, false},
		{"invalid - too high", 1500, false},
		{"valid - at boundaries", 51, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Act
			result, err := service.ValidateValue(ctx, config.ID, "price", tt.value)

			// Assert
			require.NoError(t, err)
			assert.Equal(t, tt.wantValid, result.IsValid)
		})
	}
}

func TestFindByConfigurationAndPathWithInheritance_WalksParentChain(t *testing.T) {
	// Arrange
	db, cleanup := testutil.SetupTestDB(t)
	defer cleanup()

	ctx := mongo.NewSessionContext(context.Background(), nil)
	service := New(db.Rules, db.Configurations)

	// Create inheritance chain: Product -> Instance -> User
	product := fixtures.ProductConfig("Product")
	_, err := db.Configurations.InsertOne(ctx, product)
	require.NoError(t, err)

	instance := fixtures.InstanceConfig("Instance", product.ID)
	_, err = db.Configurations.InsertOne(ctx, instance)
	require.NoError(t, err)

	user := fixtures.UserConfig("User", instance.ID, "testuser")
	_, err = db.Configurations.InsertOne(ctx, user)
	require.NoError(t, err)

	// Add rules at different levels
	productRule := fixtures.NumericRule(product.ID, "price", "greater", 0.0)
	productRule.ID = "product-rule"
	instanceRule := fixtures.NumericRule(instance.ID, "price", "smaller", 1000.0)
	instanceRule.ID = "instance-rule"

	_, err = db.Rules.InsertMany(ctx, []interface{}{productRule, instanceRule})
	require.NoError(t, err)

	// Act
	rules, err := service.FindByConfigurationAndPathWithInheritance(ctx, user.ID, "price")

	// Assert
	require.NoError(t, err)
	assert.Len(t, rules, 2, "Should find rules from product and instance")

	// Verify both rules are present
	ruleIDs := make(map[string]bool)
	for _, rule := range rules {
		ruleIDs[rule.ID] = true
	}
	assert.True(t, ruleIDs["product-rule"], "Should include product rule")
	assert.True(t, ruleIDs["instance-rule"], "Should include instance rule")
}
