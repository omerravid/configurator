package fixtures

import (
	"time"

	"your.module/config-manager/internal/types"
)

// ProductConfig returns a basic PRODUCT configuration
func ProductConfig(name string) types.Configuration {
	return types.Configuration{
		ID:        "product-" + name,
		Name:      name,
		Type:      types.ConfigProduct,
		Status:    types.StatusCommitted,
		Data: map[string]interface{}{
			"price": 100,
			"weight": 50,
			"dimensions": map[string]interface{}{
				"width":  10,
				"height": 20,
				"depth":  5,
			},
		},
		CreatedBy: "admin",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
}

// InstanceConfig returns an INSTANCE configuration with a parent
func InstanceConfig(name, parentID string) types.Configuration {
	return types.Configuration{
		ID:       "instance-" + name,
		Name:     name,
		Type:     types.ConfigInstance,
		ParentID: &parentID,
		Status:   types.StatusCommitted,
		Data: map[string]interface{}{
			"price": 120, // Override parent price
			"color": "red",
		},
		CreatedBy: "admin",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
}

// UserConfig returns a USER configuration
func UserConfig(name, parentID, username string) types.Configuration {
	return types.Configuration{
		ID:       "user-" + name,
		Name:     name,
		Type:     types.ConfigUser,
		ParentID: &parentID,
		Status:   types.StatusDraft,
		Data: map[string]interface{}{
			"color": "blue", // Override instance color
		},
		CreatedBy: username,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
}

// VersionConfig returns a VERSION configuration
func VersionConfig(name, parentID, username string) types.Configuration {
	return types.Configuration{
		ID:       "version-" + name,
		Name:     name,
		Type:     types.ConfigVersion,
		ParentID: &parentID,
		Status:   types.StatusDraft,
		Data: map[string]interface{}{
			"weight": 60, // Override product weight
		},
		CreatedBy: username,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
}

// ComponentConfig returns a COMPONENT configuration
func ComponentConfig(name string) types.Configuration {
	return types.Configuration{
		ID:     "component-" + name,
		Name:   name,
		Type:   types.ConfigComponent,
		Status: types.StatusCommitted,
		Data: map[string]interface{}{
			"capacity": 5000,
			"voltage":  12,
		},
		CreatedBy: "admin",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
}

// ProductWithComponentRef returns a PRODUCT with component references
func ProductWithComponentRef(name, componentID, versionID string) types.Configuration {
	return types.Configuration{
		ID:     "product-" + name,
		Name:   name,
		Type:   types.ConfigProduct,
		Status: types.StatusCommitted,
		Data: map[string]interface{}{
			"price": 200,
			"Battery": map[string]interface{}{
				"componentId":   componentID,
				"versionId":     versionID,
				"componentName": "Battery",
				"versionName":   "v1.0",
			},
		},
		CreatedBy: "admin",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
}

