import { User } from "../models/index.js";
import { Op } from "sequelize";
import bcrypt from "bcrypt";
import path from "path";
import fs from "fs";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "" } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = search ? {
      [Op.or]: [
        { username: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } }
      ]
    } : {};

    const users = await User.findAndCountAll({
      where: whereClause,
      attributes: ['id', 'username', 'email', 'role', 'createdAt', 'updatedAt'],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    res.status(200).json({
      users: users.rows,
      totalCount: users.count,
      currentPage: parseInt(page),
      totalPages: Math.ceil(users.count / limit),
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Error fetching users", error: error.message });
  }
};

const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await User.findByPk(id, {
      attributes: ['id', 'username', 'email', 'role', 'createdAt', 'updatedAt']
    });
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    res.status(200).json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ message: "Error fetching user", error: error.message });
  }
};

const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, role } = req.body;
    const adminId = req.user.id;

    // Validate input
    if (!username || !email || !role) {
      return res.status(400).json({ message: "Username, email, and role are required" });
    }

    // Validate role
    const validRoles = ['player', 'host', 'admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: "Invalid role. Must be player, host, or admin" });
    }

    // Find the user to update
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Prevent admin from demoting themselves
    if (user.id === adminId && user.role === 'admin' && role !== 'admin') {
      return res.status(403).json({ message: "You cannot demote yourself from admin role" });
    }

    // Check for duplicate username/email (excluding current user)
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [
          { username: username.trim() },
          { email: email.trim() }
        ],
        id: { [Op.ne]: id }
      }
    });

    if (existingUser) {
      if (existingUser.username === username.trim()) {
        return res.status(409).json({ message: "Username already exists" });
      }
      if (existingUser.email === email.trim()) {
        return res.status(409).json({ message: "Email already exists" });
      }
    }

    // Update user
    await user.update({
      username: username.trim(),
      email: email.trim(),
      role
    });

    // Return updated user without password
    const updatedUser = await User.findByPk(id, {
      attributes: ['id', 'username', 'email', 'role', 'createdAt', 'updatedAt']
    });

    res.status(200).json({ 
      message: "User updated successfully", 
      user: updatedUser 
    });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ message: "Error updating user", error: error.message });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Prevent admin from deleting themselves
    if (user.id === adminId) {
      return res.status(403).json({ message: "You cannot delete your own account" });
    }

    await user.destroy();
    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ message: "Error deleting user", error: error.message });
  }
};

// Get current user profile
const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const user = await User.findByPk(userId, {
      attributes: ['id', 'username', 'email', 'role', 'profileImage', 'createdAt', 'updatedAt']
    });
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    res.status(200).json(user);
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({ message: "Error fetching profile", error: error.message });
  }
};

// Update current user profile
const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { username, email, password } = req.body;
    
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if username is already taken by another user
    if (username && username !== user.username) {
      const existingUser = await User.findOne({ 
        where: { 
          username, 
          id: { [Op.ne]: userId } 
        } 
      });
      if (existingUser) {
        return res.status(400).json({ message: "Username already taken" });
      }
    }

    // Check if email is already taken by another user
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ 
        where: { 
          email, 
          id: { [Op.ne]: userId } 
        } 
      });
      if (existingUser) {
        return res.status(400).json({ message: "Email already taken" });
      }
    }

    // Prepare update data
    const updateData = {};
    if (username) updateData.username = username;
    if (email) updateData.email = email;
    
    // Hash password if provided
    if (password && password.trim() !== '') {
      if (password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters long" });
      }
      updateData.password = await bcrypt.hash(password, 10);
    }

    // Handle profile picture upload
    if (req.file) {
      // Delete old profile picture if it exists
      if (user.profileImage) {
        const oldImagePath = path.join(__dirname, '../../uploads/profiles', path.basename(user.profileImage));
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      
      // Set new profile picture path
      updateData.profileImage = `/uploads/profiles/${req.file.filename}`;
    }

    await user.update(updateData);

    // Return updated user without password
    const updatedUser = await User.findByPk(userId, {
      attributes: ['id', 'username', 'email', 'role', 'profileImage', 'createdAt', 'updatedAt']
    });

    res.status(200).json({
      message: "Profile updated successfully",
      user: updatedUser
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ message: "Error updating profile", error: error.message });
  }
};

export default {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  getProfile,
  updateProfile,
};
