const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  password_hash: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['USER', 'ADMIN'],
    default: 'USER'
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      ret.id = ret._id.toString();
      ret.created_at = ret.createdAt;
      ret.updated_at = ret.updatedAt;
      delete ret._id;
      delete ret.__v;
      delete ret.password_hash;
      delete ret.createdAt;
      delete ret.updatedAt;
      return ret;
    }
  }
});

const UserModel = mongoose.model('User', userSchema);

class User {
  static async create({ username, password, role = "USER", passwordIsHashed = false }) {
    const passwordHash = passwordIsHashed ? password : await bcrypt.hash(password, 10);

    const user = new UserModel({
      username,
      password_hash: passwordHash,
      role
    });

    const savedUser = await user.save();
    return this.findById(savedUser._id);
  }

  static generateId() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  static async findById(id) {
    const user = await UserModel.findById(id);
    return user ? user.toJSON() : null;
  }

  static async findByUsername(username) {
    const user = await UserModel.findOne({ username });
    if (!user) return null;
    
    // Return with password_hash for authentication
    return {
      id: user._id.toString(),
      username: user.username,
      password_hash: user.password_hash,
      role: user.role,
      created_at: user.createdAt,
      updated_at: user.updatedAt
    };
  }

  static async authenticate(username, password) {
    const user = await this.findByUsername(username);
    if (!user) {
      return null;
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return null;
    }

    // Return user without password hash
    const { password_hash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  static async findAll() {
    const users = await UserModel.find({}).sort({ createdAt: -1 });
    return users.map(user => user.toJSON());
  }

  static async updateRole(id, role) {
    await UserModel.findByIdAndUpdate(id, { role }, { new: true });
    return await this.findById(id);
  }

  static async delete(id) {
    const user = await this.findById(id);
    await UserModel.findByIdAndDelete(id);
    return user;
  }
}

module.exports = User;
