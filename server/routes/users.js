const express = require("express");
const Joi = require("joi");
const { User, Configuration } = require("../models");
const { authenticateToken, requireAdmin } = require("../middleware/auth");

const router = express.Router();

// Validation schemas
const updateRoleSchema = Joi.object({
  role: Joi.string().valid("ADMIN", "USER").required(),
});

// GET /api/users - List all users (admin only)
router.get("/", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const users = await User.findAll();
    res.json({ users });
  } catch (error) {
    console.error("List users error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/users/:id - Get user by ID
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    // Users can only view their own profile unless they're admin
    if (req.user.role !== "ADMIN" && req.user.id !== req.params.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ user });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/users/:id/role - Update user role (admin only)
router.put("/:id/role", authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Validate input
    const { error, value } = updateRoleSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { role } = value;

    // Prevent admin from changing their own role
    if (req.user.id === req.params.id) {
      return res.status(400).json({ error: "Cannot change your own role" });
    }

    const updatedUser = await User.updateRole(req.params.id, role);
    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      message: "User role updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Update user role error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/users/:id - Delete user (admin only)
router.delete("/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Prevent admin from deleting themselves
    if (req.user.id === req.params.id) {
      return res.status(400).json({ error: "Cannot delete your own account" });
    }

    // Check if user has any configurations
    const userConfigs = await Configuration.findByCreatedBy(req.params.id);
    if (userConfigs.length > 0) {
      return res.status(400).json({
        error: "Cannot delete user with existing configurations",
        configCount: userConfigs.length,
      });
    }

    const deletedUser = await User.delete(req.params.id);
    if (!deletedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      message: "User deleted successfully",
      user: deletedUser,
    });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/users/:id/configurations - Get user's configurations
router.get("/:id/configurations", authenticateToken, async (req, res) => {
  try {
    // Users can only view their own configurations unless they're admin
    if (req.user.role !== "ADMIN" && req.user.id !== req.params.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    const configurations = await Configuration.findByCreatedBy(req.params.id);
    res.json({ configurations });
  } catch (error) {
    console.error("Get user configurations error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
