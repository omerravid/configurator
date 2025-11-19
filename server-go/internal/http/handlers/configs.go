package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	mongodrv "go.mongodb.org/mongo-driver/mongo"

	"your.module/config-manager/internal/configs"
	"your.module/config-manager/internal/files"
	"your.module/config-manager/internal/logger"
	db "your.module/config-manager/internal/mongo"
	"your.module/config-manager/internal/types"
)

type ConfigsHandler struct {
	db      *db.Client
	svc     *configs.Service
	storage *files.StorageManager
	log     *logger.Logger
}

func NewConfigsHandler(dbClient *db.Client, storage *files.StorageManager, log *logger.Logger) *ConfigsHandler {
	return &ConfigsHandler{
		db:      dbClient,
		svc:     configs.New(dbClient.Configurations),
		storage: storage,
		log:     log,
	}
}

func (h *ConfigsHandler) Register(r *gin.RouterGroup, checkPermissions, requireAdmin gin.HandlerFunc) {
	// Public read endpoints (still require auth via group)
	r.GET("/configs", h.list)
	r.GET("/configs/:id", h.getResolved)
	r.GET("/configs/:id/data", h.getResolvedData)
	r.GET("/configs/:id/children", h.children)
	r.GET("/configs/by-name/:name/data", h.byNameData)

	// Create - has inline permission check for PRODUCT/INSTANCE/COMPONENT
	r.POST("/configs", h.create)

	// Update - requires permission check
	r.PUT("/configs/:id", checkPermissions, h.update)

	// Admin-only operations
	r.PUT("/configs/:id/rename", requireAdmin, h.rename)
	r.POST("/configs/:id/archive", requireAdmin, h.archive)
	r.POST("/configs/:id/restore", requireAdmin, h.restore)

	// Commit - requires permission check (allows DRAFT owners)
	r.POST("/configs/:id/commit", checkPermissions, h.commit)
}

func (h *ConfigsHandler) list(c *gin.Context) {
	typeFilter := c.Query("type")
	includeArchived := c.Query("includeArchived") == "true"

	filter := bson.M{}
	if typeFilter != "" {
		filter["type"] = typeFilter
	}
	if !includeArchived {
		filter["archived"] = false
	}

	cur, err := h.db.Configurations.Find(c, filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
		return
	}
	defer cur.Close(c)

	var cfgs []types.Configuration
	for cur.Next(c) {
		var it types.Configuration
		if err := cur.Decode(&it); err == nil {
			cfgs = append(cfgs, it)
		}
	}
	c.JSON(http.StatusOK, gin.H{"configs": cfgs})
}

func (h *ConfigsHandler) create(c *gin.Context) {
	var req types.CreateConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}
	// auth user
	uc, ok := c.Get("user")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	
	// Handle jwt.MapClaims (same pattern as other handlers)
	var ucm map[string]any
	ucm, ok = uc.(map[string]any)
	if !ok {
		// Try jwt.MapClaims
		if jwtClaims, ok := uc.(jwt.MapClaims); ok {
			ucm = map[string]any(jwtClaims)
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user context"})
			return
		}
	}
	
	createdBy, _ := ucm["username"].(string)
	userRole, _ := ucm["role"].(string)

	// Check permissions: only admins can create PRODUCT/INSTANCE/COMPONENT configs
	if (req.Type == types.ConfigProduct ||
		req.Type == types.ConfigInstance ||
		req.Type == types.ConfigComponent) && userRole != "ADMIN" {
		c.JSON(http.StatusForbidden, gin.H{
			"error": "Only admins can create Product/Instance/Component configurations",
		})
		return
	}

	// uniqueness by (name,type)
	err := h.db.Configurations.FindOne(c, bson.M{"name": req.Name, "type": req.Type}).Err()
	if err == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Configuration with this name already exists"})
		return
	}
	if err != mongodrv.ErrNoDocuments {
		// proceed if not found; other errors will surface on insert
	}

	status := types.StatusCommitted
	if req.Type == types.ConfigUser || req.Type == types.ConfigVersion {
		status = types.StatusDraft
	}

	cfg := types.Configuration{
		Name:        req.Name,
		Type:        req.Type,
		ParentID:    req.ParentID,
		Data:        req.Data,
		CreatedBy:   createdBy,
		Description: req.Description,
		Status:      status,
		Archived:    false,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	res, err := h.db.Configurations.InsertOne(c, cfg)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
		return
	}
	var idStr string
	if oid, ok := res.InsertedID.(primitive.ObjectID); ok {
		idStr = oid.Hex()
	} else if s, ok := res.InsertedID.(string); ok {
		idStr = s
	}
	c.JSON(http.StatusCreated, gin.H{"message": "Configuration created successfully", "config": gin.H{
		"id": idStr, "name": cfg.Name, "type": cfg.Type, "parent_id": cfg.ParentID,
		"data": cfg.Data, "created_by": cfg.CreatedBy, "description": cfg.Description,
		"status": cfg.Status, "archived": cfg.Archived, "created_at": cfg.CreatedAt, "updated_at": cfg.UpdatedAt,
	}})
}

func (h *ConfigsHandler) getResolved(c *gin.Context) {
	id := c.Param("id")
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid id"})
		return
	}
	var cfg types.Configuration
	if err := h.db.Configurations.FindOne(c, bson.M{"_id": oid}).Decode(&cfg); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Configuration not found"})
		return
	}
	// provenance?
	includeProv := c.Query("provenance") == "true"

	// use a sessionless context wrapper (ctx first, session second)
	sc := mongodrv.NewSessionContext(c.Request.Context(), nil)
	out, err := h.svc.Resolve(sc, cfg, includeProv)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
		return
	}

	// Fix file URLs if storage is available
	if h.storage != nil {
		fixedResolved, err := files.FixFileURLs(c.Request.Context(), h.storage, out.Resolved)
		if err == nil {
			if fixedMap, ok := fixedResolved.(map[string]interface{}); ok {
				out.Resolved = fixedMap
			}
		}
	}

	c.JSON(http.StatusOK, out)
}

func (h *ConfigsHandler) getResolvedData(c *gin.Context) {
	id := c.Param("id")
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid id"})
		return
	}
	var cfg types.Configuration
	if err := h.db.Configurations.FindOne(c, bson.M{"_id": oid}).Decode(&cfg); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Configuration not found"})
		return
	}
	minimal := c.Query("minimal") == "true"
	includeProv := !minimal

	sc := mongodrv.NewSessionContext(c.Request.Context(), nil)
	out, err := h.svc.Resolve(sc, cfg, includeProv)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
		return
	}

	// Fix file URLs if storage is available
	if h.storage != nil {
		fixedResolved, err := files.FixFileURLs(c.Request.Context(), h.storage, out.Resolved)
		if err == nil {
			if fixedMap, ok := fixedResolved.(map[string]interface{}); ok {
				out.Resolved = fixedMap
			}
		}
	}

	if minimal {
		c.JSON(http.StatusOK, out.Resolved)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": out.Resolved, "metadata": out.Metadata})
}

// deepMerge merges src into dst (object/object merge; arrays and scalars replace)
func deepMerge(dst, src map[string]any) map[string]any {
	if dst == nil {
		dst = map[string]any{}
	}
	for k, v := range src {
		if vmap, ok := v.(map[string]any); ok {
			if dmap, ok2 := dst[k].(map[string]any); ok2 {
				dst[k] = deepMerge(dmap, vmap)
				continue
			}
		}
		dst[k] = v
	}
	return dst
}

func (h *ConfigsHandler) update(c *gin.Context) {
	id := c.Param("id")
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid id"})
		return
	}

	var req types.UpdateConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	var current types.Configuration
	if err := h.db.Configurations.FindOne(c, bson.M{"_id": oid}).Decode(&current); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Configuration not found"})
		return
	}

	update := bson.M{}
	if req.Data != nil {
		update["data"] = deepMerge(current.Data, req.Data)
	}
	if req.Description != nil {
		update["description"] = *req.Description
	}
	if len(update) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No fields to update"})
		return
	}
	update["updated_at"] = time.Now()

	if _, err := h.db.Configurations.UpdateByID(c, oid, bson.M{"$set": update}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
		return
	}

	var updated types.Configuration
	_ = h.db.Configurations.FindOne(c, bson.M{"_id": oid}).Decode(&updated)
	c.JSON(http.StatusOK, gin.H{"message": "Configuration updated successfully", "config": updated})
}

func (h *ConfigsHandler) rename(c *gin.Context) {
	id := c.Param("id")
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid id"})
		return
	}

	var req types.RenameConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	var cfg types.Configuration
	if err := h.db.Configurations.FindOne(c, bson.M{"_id": oid}).Decode(&cfg); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Configuration not found"})
		return
	}

	// unique by (name, type), excluding this id
	if err := h.db.Configurations.FindOne(
		c, bson.M{"name": req.Name, "type": cfg.Type, "_id": bson.M{"$ne": oid}},
	).Err(); err == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Configuration with this name already exists"})
		return
	}

	if _, err := h.db.Configurations.UpdateByID(c, oid, bson.M{"$set": bson.M{"name": req.Name, "updated_at": time.Now()}}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
		return
	}

	var updated types.Configuration
	_ = h.db.Configurations.FindOne(c, bson.M{"_id": oid}).Decode(&updated)
	c.JSON(http.StatusOK, gin.H{"message": "Configuration renamed successfully", "config": updated})
}

func (h *ConfigsHandler) children(c *gin.Context) {
	id := c.Param("id")
	if _, err := primitive.ObjectIDFromHex(id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid id"})
		return
	}

	includeArchived := c.Query("includeArchived") == "true"
	filter := bson.M{"parent_id": id} // stored as string

	if !includeArchived {
		filter["archived"] = false
	}

	cur, err := h.db.Configurations.Find(c, filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
		return
	}
	defer cur.Close(c)

	var items []types.Configuration
	for cur.Next(c) {
		var it types.Configuration
		if err := cur.Decode(&it); err == nil {
			items = append(items, it)
		}
	}
	c.JSON(http.StatusOK, gin.H{"children": items, "count": len(items)})
}

func (h *ConfigsHandler) byNameData(c *gin.Context) {
	name := c.Param("name")
	path := c.Query("path")
	minimal := c.Query("minimal") == "true"
	includeProv := !minimal

	var cfg types.Configuration
	if err := h.db.Configurations.FindOne(c, bson.M{"name": name}).Decode(&cfg); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Configuration not found"})
		return
	}

	sc := mongodrv.NewSessionContext(c.Request.Context(), nil)
	out, err := h.svc.Resolve(sc, cfg, includeProv)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
		return
	}

	// Fix file URLs if storage is available
	if h.storage != nil {
		fixedResolved, err := files.FixFileURLs(c.Request.Context(), h.storage, out.Resolved)
		if err == nil {
			if fixedMap, ok := fixedResolved.(map[string]interface{}); ok {
				out.Resolved = fixedMap
			}
		}
	}

	if path == "" {
		if minimal {
			// Unwrap provenance recursively for minimal mode
			unwrapped, _ := configs.GetValueAtPath(out.Resolved, "", true)
			if unwrapped != nil {
				c.JSON(http.StatusOK, unwrapped)
			} else {
				c.JSON(http.StatusOK, out.Resolved)
			}
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": out.Resolved, "metadata": out.Metadata})
		return
	}

	// Use new path traversal with array notation support
	val, err := configs.GetValueAtPath(out.Resolved, path, minimal)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	if minimal {
		c.JSON(http.StatusOK, val)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": val})
}

func (h *ConfigsHandler) commit(c *gin.Context) {
	id := c.Param("id")
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid id"})
		return
	}

	var cfg types.Configuration
	if err := h.db.Configurations.FindOne(c, bson.M{"_id": oid}).Decode(&cfg); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Configuration not found"})
		return
	}
	if cfg.Type != types.ConfigUser && cfg.Type != types.ConfigVersion {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Only user and version configurations can be committed"})
		return
	}
	if cfg.Status == types.StatusCommitted {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Configuration is already committed"})
		return
	}

	if _, err := h.db.Configurations.UpdateByID(c, oid, bson.M{"$set": bson.M{"status": types.StatusCommitted, "updated_at": time.Now()}}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
		return
	}

	_ = h.db.Configurations.FindOne(c, bson.M{"_id": oid}).Decode(&cfg)
	c.JSON(http.StatusOK, gin.H{"message": "Configuration committed successfully", "config": cfg})
}

func (h *ConfigsHandler) archive(c *gin.Context) {
	id := c.Param("id")
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid id"})
		return
	}

	if _, err := h.db.Configurations.UpdateByID(c, oid, bson.M{"$set": bson.M{"archived": true, "updated_at": time.Now()}}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
		return
	}

	var cfg types.Configuration
	_ = h.db.Configurations.FindOne(c, bson.M{"_id": oid}).Decode(&cfg)
	c.JSON(http.StatusOK, gin.H{"message": "Configuration archived successfully", "config": cfg})
}

func (h *ConfigsHandler) restore(c *gin.Context) {
	id := c.Param("id")
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid id"})
		return
	}

	if _, err := h.db.Configurations.UpdateByID(c, oid, bson.M{"$set": bson.M{"archived": false, "updated_at": time.Now()}}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
		return
	}

	var cfg types.Configuration
	_ = h.db.Configurations.FindOne(c, bson.M{"_id": oid}).Decode(&cfg)
	c.JSON(http.StatusOK, gin.H{"message": "Configuration restored successfully", "config": cfg})
}
