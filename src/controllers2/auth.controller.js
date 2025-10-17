import { User } from "../../models/index.js";
import { Op } from "sequelize";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import ApiError from "../utils/api-error.util.js";
import { generateGuestName } from "../utils/identity.util.js";

const signup = async (req, res, next) => {
  try {
    const { username, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      username,
      email,
      password: hashedPassword,
      isGuest: false,
    });

    res.status(201).json({
      message: "User created successfully",
      user: newUser.getFullProfile(),
    });
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({
      where: { [Op.or]: [{ email }, { username: email }] },
    });
    if (!user) throw new ApiError(401, "Invalid credentials.");

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) throw new ApiError(401, "Invalid credentials.");

    const accessToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "30m" }
    );

    const refreshToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role, type: "refresh" },
      process.env.JWT_REFRESH_SECRET || "refresh_secret",
      { expiresIn: "7d" }
    );

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    user.lastActiveAt = new Date();
    await user.save();

    res.status(200).json({
      message: "Login successful",
      user: user.getFullProfile(),
      token: accessToken,
    });
  } catch (error) {
    next(error);
  }
};

const guestLogin = async (req, res, next) => {
  try {
    let guestUser;

    const guestId = req.cookies?.guestId;
    if (guestId) {
      const existingGuest = await User.findOne({
        where: { id: guestId, isGuest: true },
      });
      if (existingGuest) {
        existingGuest.lastActiveAt = new Date();
        await existingGuest.save();
        guestUser = existingGuest;
      }
    }

    if (!guestUser) {
      let guestName;
      let existingUser;

      do {
        guestName = generateGuestName();
        existingUser = await User.findOne({
          where: { username: guestName, isGuest: true },
        });
      } while (existingUser);

      guestUser = await User.create({
        username: guestName,
        isGuest: true,
      });
    }

    const accessToken = jwt.sign(
      { id: guestUser.id, username: guestUser.username, isGuest: true },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "30m" }
    );

    const refreshToken = jwt.sign(
      {
        id: guestUser.id,
        username: guestUser.username,
        isGuest: true,
        type: "refresh",
      },
      process.env.JWT_REFRESH_SECRET || "refresh_secret",
      { expiresIn: "7d" }
    );

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.cookie("guestId", guestUser.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      message: "Guest login successful",
      user: guestUser.getFullProfile(),
      token: accessToken,
    });
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    res.status(200).json({ message: "Logout successful" });
  } catch (error) {
    next(error);
  }
};

const me = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const user = await User.findByPk(userId);
    if (!user) throw new ApiError(404, "User not found.");

    user.lastActiveAt = new Date();
    await user.save();

    res.status(200).json({ user: user.getFullProfile() });
  } catch (error) {
    next(error);
  }
};

const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.cookies;
    if (!refreshToken) throw new ApiError(401, "No refresh token provided.");

    const payload = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET || "refresh_secret"
    );
    if (payload.type !== "refresh")
      throw new ApiError(401, "Invalid refresh token.");

    const user = await User.findByPk(payload.id);
    if (!user) throw new ApiError(401, "User not found.");

    const newAccessToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "30m" }
    );

    res.status(200).json({ token: newAccessToken });
  } catch (error) {
    next(error);
  }
};

export default {
  signup,
  login,
  guestLogin,
  logout,
  me,
  refresh,
};
