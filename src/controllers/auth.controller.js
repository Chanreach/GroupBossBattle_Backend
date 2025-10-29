import { User } from "../../models/index.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import ApiError from "../utils/api-error.util.js";
import { generateGuestName } from "../utils/identity.util.js";
import { normalizeName, normalizeEmail } from "../utils/helper.js";

const signup = async (req, res, next) => {
  const { username, email, password } = req.body;

  try {
    const newUser = await User.create({
      username: normalizeName(username),
      email: normalizeEmail(email),
      password,
      isGuest: false,
    });

    res.status(201).json({
      message: "Signed up successfully!",
      user: newUser.getFullProfile(),
    });
  } catch (error) {
    next(error);
  }
};

// TESTING

const login = async (req, res, next) => {
  const { emailOrUsername, password } = req.body;

  try {
    const user = await User.scope([
      { method: ["emailOrUsername", emailOrUsername] },
    ]).findOne();
    if (!user) {
      throw new ApiError(401, "Invalid credentials.");
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new ApiError(401, "Invalid credentials.");
    }

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
      message: "Login successfully!",
      user: user.getFullProfile(),
      token: accessToken,
    });
  } catch (error) {
    next(error);
  }
};

const guestLogin = async (req, res, next) => {
  const guestId = req.cookies?.guestId;

  try {
    let guestUser;
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
      message: "Guest login successfully!",
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

    res.status(200).json({ message: "Logout successfully!" });
  } catch (error) {
    next(error);
  }
};

const me = async (req, res, next) => {
  const userId = req.user.id;

  try {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new ApiError(404, "User not found.");
    }

    res.status(200).json({
      user: user.getFullProfile(),
      type: user.isGuest ? "guest" : "user",
    });
  } catch (error) {
    next(error);
  }
};

const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.cookies;
    if (!refreshToken) {
      throw new ApiError(401, "No refresh token provided.");
    }

    const payload = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET || "refresh_secret"
    );
    if (payload.type !== "refresh") {
      throw new ApiError(401, "Invalid refresh token.");
    }

    const user = await User.findByPk(payload.id);
    if (!user) {
      throw new ApiError(404, "User not found.");
    }

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
