import { Model } from "sequelize";
import { Op } from "sequelize";
import validator from "validator";
import bcrypt from "bcrypt";

export default (sequelize, DataTypes) => {
  class User extends Model {
    static associate(models) {
      User.hasMany(models.Event, {
        foreignKey: "creatorId",
        as: "createdEvents",
      });
      User.hasMany(models.Boss, {
        foreignKey: "creatorId",
        as: "createdBosses",
      });
      User.hasMany(models.Category, {
        foreignKey: "creatorId",
        as: "createdCategories",
      });
      User.hasMany(models.Question, {
        foreignKey: "authorId",
        as: "createdQuestions",
      });
      User.hasMany(models.UserBadge, {
        foreignKey: "userId",
        as: "userBadges",
      });
      User.hasMany(models.Leaderboard, {
        foreignKey: "userId",
        as: "leaderboards",
      });
    }

    getProfileImageUrl() {
      const baseUrl =
        process.env.NODE_ENV === "production"
          ? process.env.APP_URL
          : "http://localhost:3000";
      return this.profileImage
        ? `${baseUrl}/api/uploads/${this.profileImage}`
        : null;
    }

    getFullProfile() {
      return {
        id: this.id,
        username: this.username,
        email: this.email,
        profileImage: this.getProfileImageUrl(),
        role: this.role,
        isGuest: this.isGuest,
        lastActiveAt: this.lastActiveAt,
      };
    }
  }

  User.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      username: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
          notEmpty: { msg: "Username cannot be empty." },
          len: {
            args: [3, 32],
            msg: "Username length must be between 3 and 32 characters.",
          },
          isValidUsername(value) {
            const usernameRegex = /^[a-zA-Z][a-zA-Z0-9_-]+$/;
            if (!usernameRegex.test(value)) {
              throw new Error(
                "Username must start with a letter and can only contain letters, numbers, underscores, and hyphens."
              );
            }
          },
          isUnique: async function (value) {
            const user = await User.findOne({ where: { username: value } });
            if (user && user.id !== this.id) {
              throw new Error("Username already in use.");
            }
          },
          notGuestPrefix(value) {
            if (!this.isGuest && /^guest_/i.test(value)) {
              throw new Error(
                'Username cannot start with "guest_" as it is reserved for guest users.'
              );
            }
          },
        },
      },
      profileImage: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true,
        validate: {
          notEmpty(value) {
            if (this.isGuest) return;
            if (!value || value.trim() === "") {
              throw new Error("Email cannot be empty.");
            }
          },
          isEmail(value) {
            if (this.isGuest) return;
            if (value && !validator.isEmail(value)) {
              throw new Error("Email must be a valid email address.");
            }
          },
          isUnique: async function (value) {
            if (this.isGuest) return;
            const user = await User.findOne({ where: { email: value } });
            if (user && user.id !== this.id) {
              throw new Error("Email address already in use.");
            }
          },
        },
      },
      password: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
          notEmpty(value) {
            if (this.isGuest) return;
            if (!value || value.trim() === "") {
              throw new Error("Password cannot be empty");
            }
          },
          len(value) {
            if (this.isGuest) return;
            if (value.length < 12 || value.length > 64) {
              throw new Error(
                "Password length must be between 12 and 64 characters"
              );
            }
          },
          isStrongPassword(value) {
            if (this.isGuest) return;
            if (value.length < 12 || value.length > 64) return;
            const passwordRegex =
              /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,64}$/;
            if (!passwordRegex.test(value)) {
              throw new Error(
                "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character."
              );
            }
          },
        },
      },
      role: {
        type: DataTypes.ENUM("player", "host", "admin", "superadmin"),
        defaultValue: "player",
        validate: {
          isIn: {
            args: [["player", "host", "admin", "superadmin"]],
            msg: "Role must be one of: player, host, admin, superadmin.",
          },
        },
      },
      isGuest: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      lastActiveAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      modelName: "User",
      tableName: "users",
      timestamps: true,
      underscored: true,
      hooks: {
        beforeCreate: async (user) => {
          user.lastActiveAt = new Date();
          if (user.password && !user.isGuest) {
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(user.password, saltRounds);
            user.password = hashedPassword;
          }
        },
        beforeUpdate: async (user) => {
          user.lastActiveAt = new Date();
          if (user.changed("password") && !user.isGuest) {
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(user.password, saltRounds);
            user.password = hashedPassword;
          }
        },
      },
      defaultScope: {
        attributes: { exclude: ["password", "createdAt", "updatedAt"] },
      },
      scopes: {
        player: {
          where: { role: "player" },
        },
        host: {
          where: { role: "host" },
        },
        admin: {
          where: { role: "admin" },
        },
        superadmin: {
          where: { role: "superadmin" },
        },
        guest: {
          where: { isGuest: true },
        },
        emailOrUsername: (value) => ({
          where: {
            [Op.or]: [{ email: value }, { username: value }],
          },
        }),
        byRoles: (roles) => ({
          where: {
            role: {
              [Op.in]: roles,
            },
          },
        }),
      },
    }
  );
  return User;
};
