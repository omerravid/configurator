const express = require("express");
const jwt = require("jsonwebtoken");
const Joi = require("joi");
const { User } = require("../models");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

// Validation schemas
const loginSchema = Joi.object({
  username: Joi.string().min(3).max(50).required(),
  password: Joi.string().min(6).required(),
});

const registerSchema = Joi.object({
  username: Joi.string().min(3).max(50).required(),
  password: Joi.string().min(6).required(),
  role: Joi.string().valid("ADMIN", "USER").default("USER"),
});

// Generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    { userId: user.id, username: user.username, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "24h" },
  );
};

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    // Validate input
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { username, password } = value;

    // Authenticate user
    const user = await User.authenticate(username, password);
    if (!user) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    // Generate token
    const token = generateToken(user);

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    // Validate input
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { username, password, role } = value;

    // Check if user already exists
    const existingUser = await User.findByUsername(username);
    if (existingUser) {
      return res.status(409).json({ error: "Username already exists" });
    }

    // Create user
    const newUser = await User.create({ username, password, role });

    // Generate token
    const token = generateToken(newUser);

    res.status(201).json({
      message: "User created successfully",
      token,
      user: {
        id: newUser.id,
        username: newUser.username,
        role: newUser.role,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/auth/me
router.get("/me", authenticateToken, async (req, res) => {
  try {
    res.json({
      user: {
        id: req.user.id,
        username: req.user.username,
        role: req.user.role,
        created_at: req.user.created_at,
      },
    });
  } catch (error) {
    console.error("Get current user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/refresh
router.post("/refresh", authenticateToken, async (req, res) => {
  try {
    const token = generateToken(req.user);
    res.json({ token });
  } catch (error) {
    console.error("Token refresh error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
