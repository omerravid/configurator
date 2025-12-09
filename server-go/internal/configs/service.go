package configs

import (
	"context"
	"errors"
	"fmt"
	"slices"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"

	"your.module/config-manager/internal/types"
)

type Service struct {
	cfgCol *mongo.Collection
}

func New(cfgCol *mongo.Collection) *Service {
	return &Service{cfgCol: cfgCol}
}

func (s *Service) defaultStatus(t types.ConfigType, provided types.ConfigStatus) types.ConfigStatus {
	if t == types.ConfigUser || t == types.ConfigVersion {
		if provided != "" {
			return provided
		}
		return types.StatusDraft
	}
	return types.StatusCommitted
}

// Resolve: load inheritance chain root→leaf and merge with full provenance tracking
func (s *Service) Resolve(ctx mongo.SessionContext, cfg types.Configuration, includeProv bool) (*types.ResolveResult, error) {
	chain, err := s.inheritanceChain(ctx, cfg)
	if err != nil {
		return nil, err
	}
	if len(chain) == 0 {
		return nil, errors.New("no inheritance chain")
	}

	resolved := make(map[string]interface{})
	var previousSource SourceInfo

	for i, level := range chain {
		source := SourceInfo{
			ID:        level.ID,
			Name:      level.Name,
			Type:      string(level.Type),
			CreatedBy: level.CreatedBy,
			CreatedAt: level.CreatedAt.Format("2006-01-02T15:04:05.000Z"),
			UpdatedAt: level.UpdatedAt.Format("2006-01-02T15:04:05.000Z"),
		}

		// Get level data
		levelData := level.Data
		if levelData == nil {
			levelData = make(map[string]interface{})
		}

		// If this is a PRODUCT configuration, expand component references
		if level.Type == types.ConfigProduct {
			expandedData, err := s.expandComponentReferences(ctx, levelData, includeProv)
			if err == nil {
				levelData = expandedData
			}
			// If error, just use original data
		}

		// For the first level, there's no previous source
		if i == 0 {
			resolved = deepMergeWithFullProvenance(
				make(map[string]interface{}),
				levelData,
				SourceInfo{},
				source,
				includeProv,
			)
		} else {
			resolved = deepMergeWithFullProvenance(
				resolved,
				levelData,
				previousSource,
				source,
				includeProv,
			)
		}

		previousSource = source
	}

	out := &types.ResolveResult{
		Resolved: resolved,
	}
	out.Metadata.ConfigID = cfg.ID
	out.Metadata.ConfigName = cfg.Name
	out.Metadata.ConfigType = string(cfg.Type)
	out.Metadata.ChainLength = len(chain)

	// Populate chain metadata
	for _, c := range chain {
		out.Metadata.Chain = append(out.Metadata.Chain, struct {
			ID   string `json:"id"`
			Name string `json:"name"`
			Type string `json:"type"`
		}{
			ID:   c.ID,
			Name: c.Name,
			Type: string(c.Type),
		})
	}

	return out, nil
}

// expandComponentReferences expands component/version references in PRODUCT configs
// When a PRODUCT contains { Battery: { versionId: "..." } }, it resolves and merges the version data
func (s *Service) expandComponentReferences(ctx context.Context, productData map[string]interface{}, includeProvenance bool) (map[string]interface{}, error) {
	if productData == nil {
		return productData, nil
	}

	expandedData := make(map[string]interface{})

	for componentName, reference := range productData {
		// Check if this is a component reference object
		refMap, isMap := reference.(map[string]interface{})
		if !isMap {
			// Not a map, keep as-is
			expandedData[componentName] = reference
			continue
		}

		versionID, hasVersionID := refMap["versionId"]
		if !hasVersionID {
			// Not a component reference, keep as-is (might be old-style data)
			expandedData[componentName] = reference
			continue
		}

		// This is a component reference - resolve it
		versionIDStr, ok := versionID.(string)
		if !ok {
			expandedData[componentName] = reference
			continue
		}

		// Convert to ObjectID
		oid, err := primitive.ObjectIDFromHex(versionIDStr)
		if err != nil {
			// Invalid ID, keep original
			expandedData[componentName] = reference
			continue
		}

		// Find the version/component configuration
		var versionConfig types.Configuration
		err = s.cfgCol.FindOne(ctx, bson.M{"_id": oid}).Decode(&versionConfig)
		if err != nil {
			// Version not found, return empty object
			fmt.Printf("Warning: Version/Component not found for reference: %v\n", reference)
			expandedData[componentName] = make(map[string]interface{})
			continue
		}

		// Verify it's a VERSION or COMPONENT type
		if versionConfig.Type != types.ConfigVersion && versionConfig.Type != types.ConfigComponent {
			fmt.Printf("Warning: Referenced config is not VERSION or COMPONENT: %s\n", versionConfig.Type)
			expandedData[componentName] = make(map[string]interface{})
			continue
		}

		// Resolve the version/component with its full inheritance chain
		// Create a session context wrapper if ctx is not already one
		var sessionCtx mongo.SessionContext
		if sc, ok := ctx.(mongo.SessionContext); ok {
			sessionCtx = sc
		} else {
			// Wrap in a nil-session context
			sessionCtx = mongo.NewSessionContext(ctx, nil)
		}

		resolvedVersion, err := s.Resolve(sessionCtx, versionConfig, includeProvenance)
		if err != nil {
			fmt.Printf("Error resolving component reference %s: %v\n", componentName, err)
			expandedData[componentName] = make(map[string]interface{})
			continue
		}

		// Merge the component reference metadata with resolved data
		expandedComponent := make(map[string]interface{})

		// Keep the original component reference metadata
		if componentID, ok := refMap["componentId"]; ok {
			expandedComponent["componentId"] = componentID
		}
		expandedComponent["versionId"] = versionID
		if componentNameVal, ok := refMap["componentName"]; ok {
			expandedComponent["componentName"] = componentNameVal
		}
		if versionName, ok := refMap["versionName"]; ok {
			expandedComponent["versionName"] = versionName
		}

		// Include all resolved properties from the component/version
		for key, value := range resolvedVersion.Resolved {
			expandedComponent[key] = value
		}

		expandedData[componentName] = expandedComponent
	}

	return expandedData, nil
}

// Basic iterative parent walk (Mongo)
func (s *Service) inheritanceChain(ctx mongo.SessionContext, leaf types.Configuration) ([]types.Configuration, error) {
	var chain []types.Configuration
	cur := &leaf
	for cur != nil {
		chain = append(chain, *cur)
		if cur.ParentID == nil || *cur.ParentID == "" {
			break
		}

		// Convert string parent ID to ObjectID
		parentOID, err := primitive.ObjectIDFromHex(*cur.ParentID)
		if err != nil {
			// Log the error but continue (invalid parent ID format)
			fmt.Printf("Warning: Invalid parent ID format: %s, error: %v\n", *cur.ParentID, err)
			break
		}

		var parent types.Configuration
		if err := s.cfgCol.FindOne(ctx, bson.M{"_id": parentOID}).Decode(&parent); err != nil {
			// Log the error for debugging
			fmt.Printf("Warning: Failed to find parent config with ID %s: %v\n", *cur.ParentID, err)
			break
		}
		cur = &parent
	}
	slices.Reverse(chain)
	return chain, nil
}
