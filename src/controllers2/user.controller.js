import { User } from "../../models/index.js";
import { Op } from "sequelize";
import bcrypt from "bcrypt";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import ApiError from "../utils/api-error.util.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const getAllUsers = async (req, res, next) => {
  const currentUserRole = req.user.role;
  const { search = "" } = req.query;

  try {
    const whereClause = search
      ? {
          [Op.or]: [
            { username: { [Op.like]: `%${search}%` } },
            { email: { [Op.like]: `%${search}%` } },
          ],
        }
      : {};

    let scope = [];
    if (currentUserRole === "admin") {
      scope.push("player", "host");
    } else if (currentUserRole === "superadmin") {
      scope.push("player", "host", "admin");
    } else {
      throw new ApiError(403, "Forbidden: Insufficient permissions.");
    }

    const users = await User.scope(...scope).findAll({
      where: whereClause,
      attributes: ["id", "username", "email", "role", "isGuest"],
      order: [["username", "DESC"]],
    });

    res.status(200).json({ users });
  } catch (error) {
    next(error);
  }
};

const getUserById = async (req, res, next) => {
  const { id } = req.params;

  try {
    const user = await User.findByPk(id, {
      attributes: ["id", "username", "email", "role", "isGuest"],
    });
    if (!user) throw new ApiError(404, "User not found");

    res.status(200).json({ user: user.getFullProfile() });
  } catch (error) {
    next(error);
  }
};

const updateUser = async (req, res, next) => {
  const { id } = req.params;
  const { username, email, role } = req.body;
  const requesterRole = req.user.role;

  try {
    const user = await User.findByPk(id);
    if (!user) throw new ApiError(404, "User not found");

    if (
      requesterRole === "admin" &&
      ["admin", "superadmin"].includes(user.role)
    )
      throw new ApiError(
        403,
        "Forbidden: Cannot modify admin or superadmin users."
      );

    const updateData = {};
    if (username) updateData.username = username;
    if (email) updateData.email = email;
    if (role) updateData.role = role;
    await user.update(updateData);

    res.status(200).json({
      message: "User updated successfully",
      user: user.getFullProfile(),
    });
  } catch (error) {
    next(error);
  }
};

const deleteUser = async (req, res, next) => {
  const { id } = req.params;
  const requester = req.user;

  try {
    const user = await User.findByPk(id);
    if (!user) throw new ApiError(404, "User not found");

    if (requester.id === user.id)
      throw new ApiError(403, "Forbidden: Cannot delete your own account.");

    if (
      requester.role === "admin" &&
      ["admin", "superadmin"].includes(user.role)
    )
      throw new ApiError(
        403,
        "Forbidden: Cannot delete admin or superadmin users."
      );

    await user.destroy();

    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    next(error);
  }
};

const getProfile = async (req, res, next) => {
  const userId = req.user.id;

  try {
    const user = await User.findByPk(userId);
    if (!user) throw new ApiError(404, "User not found");

    res.status(200).json({ user: user.getFullProfile() });
  } catch (error) {
    next(error);
  }
};

const updateProfile = async (req, res, next) => {
  const userId = req.user.id;
  const { username, email, password } = req.body;

  try {
    const user = await User.findByPk(userId);
    if (!user) throw new ApiError(404, "User not found");

    const updateData = {};
    if (username) updateData.username = username;
    if (email) updateData.email = email;
    if (password) updateData.password = await bcrypt.hash(password, 10);
    if (req.file) {
      if (user.profileImage) {
        const oldImagePath = path.join(
          __dirname,
          "../../uploads/",
          path.basename(user.profileImage)
        );
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath).catch((err) => {
            console.error("Deleting old profile image error:", err);
          });
        }
      }
      updateData.profileImage = `profiles/${req.file.filename}`;
    }

    await user.update(updateData);

    res.status(200).json({
      message: "Profile updated successfully",
      user: user.getFullProfile(),
    });
  } catch (error) {
    next(error);
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
