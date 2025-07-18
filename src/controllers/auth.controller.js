import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { User } from "../models/index.js";
import { Op } from "sequelize";
import { v4 as uuidv4 } from "uuid";
import generateGuestName from "../utils/generate-guest-name.js";

// Signup controller
const signup = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ message: "All fields are required." });
    }
    // Check for existing user by email or username
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [{ email: email }, { username: username }],
      },
    });
    if (existingUser) {
      if (existingUser.email === email) {
        return res.status(409).json({ message: "Email already in use." });
      }
      if (existingUser.username === username) {
        return res.status(409).json({ message: "Username already in use." });
      }
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      username,
      email,
      password: hashedPassword,
    });
    res.status(201).json({
      message: "User created successfully",
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Login controller
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "All fields are required." });
    }

    // Support login with either email or username
    const user = await User.findOne({
      where: {
        [Op.or]: [
          { email: email },
          { username: email }, // email field can contain username
        ],
      },
    });

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    // Include role in JWT payload
    const accessToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "30m" } // Short-lived access token
    );

    const refreshToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role, type: "refresh" },
      process.env.JWT_REFRESH_SECRET || "refresh_secret",
      { expiresIn: "7d" } // Long-lived refresh token
    );

    // Set refresh token as httpOnly cookie for security
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // HTTPS in production
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      message: "Login successful",
      token: accessToken, // Frontend gets the access token
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        profileImage: user.profileImage,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Add 'me' endpoint
const me = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      profileImage: user.profileImage,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Refresh token endpoint
const refresh = async (req, res) => {
  try {
    const { refreshToken } = req.cookies;

    if (!refreshToken) {
      return res.status(401).json({ message: "Refresh token not found" });
    }

    // Verify refresh token
    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET || "refresh_secret"
    );

    // Check if it's actually a refresh token
    if (decoded.type !== "refresh") {
      return res.status(401).json({ message: "Invalid token type" });
    }

    // Get user from database to ensure they still exist
    const user = await User.findByPk(decoded.id);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    // Generate new access token
    const newAccessToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "30m" }
    );

    res.json({
      token: newAccessToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      return res
        .status(401)
        .json({ message: "Invalid or expired refresh token" });
    }
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Logout endpoint
const logout = async (req, res) => {
  try {
    // Clear the refresh token cookie
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    res.json({ message: "Logged out successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const guestLogin = async (req, res) => {
  try {
    let guestId;
    let existingUser;

    // Generate a unique ID for the guest user and ensure it doesn't exist
    do {
      guestId = uuidv4();
      existingUser = await User.findOne({
        where: { id: guestId },
      });
    } while (existingUser);

    const guestUsername = generateGuestName();

    // Generate tokens for the guest user
    const accessToken = jwt.sign(
      { id: guestId, username: guestUsername, role: "guest", isGuest: true },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "30m" }
    );

    const refreshToken = jwt.sign(
      {
        id: guestId,
        username: guestUsername,
        role: "guest",
        type: "refresh",
        isGuest: true,
      },
      process.env.JWT_REFRESH_SECRET || "refresh_secret",
      { expiresIn: "7d" }
    );

    // Set refresh token as httpOnly cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      message: "Guest login successful",
      token: accessToken,
      user: {
        id: guestId,
        username: guestUsername,
        role: "guest",
        isGuest: true,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export default {
  signup,
  login,
  me,
  refresh,
  logout,
  guestLogin,
};
