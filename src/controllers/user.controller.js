import { User } from "../../models/index.js";
import { Op } from "sequelize";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import ApiError from "../utils/api-error.util.js";
import { normalizeName, normalizeEmail } from "../utils/helper.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const getAllUsers = async (req, res, next) => {
  const requesterRole = req.user.role;
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

    const users = await User.scope({
      method: [
        "byRoles",
        requesterRole === "superadmin"
          ? ["superadmin", "admin", "host", "player"]
          : ["admin", "host", "player"],
      ],
    }).findAll({
      where: whereClause,
      order: [["username", "DESC"]],
    });

    const userProfiles = users.map((user) => user.getFullProfile());

    res.status(200).json(userProfiles);
  } catch (error) {
    next(error);
  }
};

const getUserById = async (req, res, next) => {
  const { id } = req.params;

  try {
    const user = await User.findByPk(id);
    if (!user) {
      throw new ApiError(404, "User not found.");
    }

    res.status(200).json(user.getFullProfile());
  } catch (error) {
    next(error);
  }
};

const updateUser = async (req, res, next) => {
  const { id } = req.params;
  const { username, email, role } = req.body;

  try {
    const user = await User.findByPk(id);
    if (!user) {
      throw new ApiError(404, "User not found.");
    }

    const updatedFields = {};
    if (username) updatedFields.username = normalizeName(username);
    if (email) updatedFields.email = normalizeEmail(email);
    if (role) updatedFields.role = role;

    if (Object.keys(updatedFields).length > 0) {
      await user.update(updatedFields);
    }

    res.status(200).json({
      message: "User updated successfully!",
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
    if (!user) {
      throw new ApiError(404, "User not found");
    }

    if (requester.id === user.id) {
      throw new ApiError(
        403,
        "Forbidden: You are not allowed to perform this action."
      );
    }

    if (
      requester.role === "admin" &&
      ["superadmin", "admin"].includes(user.role)
    ) {
      throw new ApiError(
        403,
        "Forbidden: You are not allowed to perform this action."
      );
    }

    if (user.profileImage) {
      const imagePath = path.join(
        __dirname,
        "../../uploads/",
        path.basename(user.profileImage)
      );
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath).catch((err) => {
          console.error("Deleting profile image error:", err);
        });
      }
    }

    await user.destroy();

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

const getProfile = async (req, res, next) => {
  const requesterId = req.user.id;

  try {
    const user = await User.findByPk(requesterId);
    if (!user) {
      throw new ApiError(404, "User not found.");
    }

    res.status(200).json(user.getFullProfile());
  } catch (error) {
    next(error);
  }
};

const updateProfile = async (req, res, next) => {
  const requesterId = req.user.id;
  const { username, email, password } = req.body;

  try {
    const user = await User.findByPk(requesterId);
    if (!user) {
      throw new ApiError(404, "User not found.");
    }

    const updatedFields = {};
    if (username) updatedFields.username = normalizeName(username);
    if (email) updatedFields.email = normalizeEmail(email);
    if (password) updatedFields.password = password;
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
      updatedFields.profileImage = `profiles/${req.file.filename}`;
    }

    if (Object.keys(updatedFields).length === 0) {
      return res.status(200).json({
        message: "No changes detected. Profile remains unchanged.",
        user: user.getFullProfile(),
      });
    }

    await user.update(updatedFields);

    res.status(200).json({
      message: "Profile updated successfully!",
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
