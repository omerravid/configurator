package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	mongodrv "go.mongodb.org/mongo-driver/mongo"

	"your.module/config-manager/internal/logger"
	db "your.module/config-manager/internal/mongo"
	"your.module/config-manager/internal/rules"
	"your.module/config-manager/internal/types"
)

type RulesHandler struct {
	db  *db.Client
	svc *rules.Service
	log *logger.Logger
}

func NewRulesHandler(dbClient *db.Client, log *logger.Logger) *RulesHandler {
	return &RulesHandler{
		db:  dbClient,
		svc: rules.New(dbClient.Rules, dbClient.Configurations),
		log: log,
	}
}

func (h *RulesHandler) Register(r *gin.RouterGroup) {
	r.GET("/rules", h.list)
	r.POST("/rules", h.create)
	r.GET("/rules/:id", h.get)
	r.PUT("/rules/:id", h.update)
	r.DELETE("/rules/:id", h.delete)
	r.POST("/rules/validate", h.validate)
	r.GET("/rules/configuration/:configId/path/:path", h.byPath)
}

func (h *RulesHandler) list(c *gin.Context) {
	configID := c.Query("configurationId")
	if configID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "configurationId is required"})
		return
	}

	sc := mongodrv.NewSessionContext(c.Request.Context(), nil)
	rules, err := h.svc.FindByConfigurationID(sc, configID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch rules"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"rules": rules})
}

func (h *RulesHandler) create(c *gin.Context) {
	var req types.CreateRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

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

	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}

	rule := types.Rule{
		ConfigurationID: req.ConfigurationID,
		PropertyPath:    req.PropertyPath,
		RuleType:        req.RuleType,
		RuleConfig:      req.RuleConfig,
		ErrorMessage:    req.ErrorMessage,
		Enabled:         enabled,
		CreatedBy:       createdBy,
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}

	res, err := h.db.Rules.InsertOne(c, rule)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create rule"})
		return
	}

	var idStr string
	if oid, ok := res.InsertedID.(primitive.ObjectID); ok {
		idStr = oid.Hex()
	}

	var created types.Rule
	_ = h.db.Rules.FindOne(c, bson.M{"_id": res.InsertedID}).Decode(&created)
	created.ID = idStr
	c.JSON(http.StatusCreated, gin.H{"rule": created})
}

func (h *RulesHandler) get(c *gin.Context) {
	id := c.Param("id")
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid id"})
		return
	}

	var rule types.Rule
	if err := h.db.Rules.FindOne(c, bson.M{"_id": oid}).Decode(&rule); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Rule not found"})
		return
	}

	rule.ID = oid.Hex()
	c.JSON(http.StatusOK, gin.H{"rule": rule})
}

func (h *RulesHandler) update(c *gin.Context) {
	id := c.Param("id")
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid id"})
		return
	}

	var req types.UpdateRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	var existing types.Rule
	if err := h.db.Rules.FindOne(c, bson.M{"_id": oid}).Decode(&existing); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Rule not found"})
		return
	}

	update := bson.M{}
	if req.PropertyPath != nil {
		update["property_path"] = *req.PropertyPath
	}
	if req.RuleType != nil {
		update["rule_type"] = *req.RuleType
	}
	if req.RuleConfig != nil {
		update["rule_config"] = req.RuleConfig
	}
	if req.ErrorMessage != nil {
		update["error_message"] = *req.ErrorMessage
	}
	if req.Enabled != nil {
		update["enabled"] = *req.Enabled
	}
	if len(update) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No fields to update"})
		return
	}
	update["updated_at"] = time.Now()

	if _, err := h.db.Rules.UpdateByID(c, oid, bson.M{"$set": update}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update rule"})
		return
	}

	var updated types.Rule
	_ = h.db.Rules.FindOne(c, bson.M{"_id": oid}).Decode(&updated)
	updated.ID = oid.Hex()
	c.JSON(http.StatusOK, gin.H{"rule": updated})
}

func (h *RulesHandler) delete(c *gin.Context) {
	id := c.Param("id")
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid id"})
		return
	}

	var rule types.Rule
	if err := h.db.Rules.FindOne(c, bson.M{"_id": oid}).Decode(&rule); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Rule not found"})
		return
	}

	if _, err := h.db.Rules.DeleteOne(c, bson.M{"_id": oid}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete rule"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Rule deleted successfully"})
}

func (h *RulesHandler) validate(c *gin.Context) {
	var req types.ValidateValueRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	sc := mongodrv.NewSessionContext(c.Request.Context(), nil)
	result, err := h.svc.ValidateValue(sc, req.ConfigurationID, req.PropertyPath, req.Value)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to validate value"})
		return
	}

	c.JSON(http.StatusOK, result)
}

func (h *RulesHandler) byPath(c *gin.Context) {
	configID := c.Param("configId")
	path := c.Param("path")
	includeInherited := c.Query("includeInherited") != "false"

	sc := mongodrv.NewSessionContext(c.Request.Context(), nil)
	var rulesList []types.Rule
	var err error
	if includeInherited {
		rulesList, err = h.svc.FindByConfigurationAndPathWithInheritance(sc, configID, path)
	} else {
		rulesList, err = h.svc.FindByConfigurationAndPath(sc, configID, path)
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch rules for path"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"rules": rulesList})
}
