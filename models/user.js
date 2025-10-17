import { Model } from "sequelize";

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
          notEmpty: { msg: "Username cannot be empty" },
          len: {
            args: [3, 50],
            msg: "Username length must be between 3 and 50 characters",
          },
          isUnique: async function (value, next) {
            const user = await User.findOne({ where: { username: value } });
            if (user && user.id !== this.id) {
              return next("Username already in use!");
            }
            next();
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
              throw new Error("Email cannot be empty");
            }
          },
          isEmail(value) {
            if (this.isGuest) return;
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(value)) {
              throw new Error("Must be a valid email address");
            }
          },
          isUnique: async function (value, next) {
            if (this.isGuest) return next();
            const user = await User.findOne({ where: { email: value } });
            if (user && user.id !== this.id) {
              return next("Email address already in use!");
            }
            next();
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
            if (value.length < 8 || value.length > 100) {
              throw new Error(
                "Password length must be between 8 and 100 characters"
              );
            }
          },
          isStrongPassword(value) {
            if (this.isGuest) return;
            const passwordRegex =
              /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,100}$/;
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
        beforeCreate: (user) => {
          user.lastActiveAt = new Date();
        },
        beforeUpdate: (user) => {
          user.lastActiveAt = new Date();
        },
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
        guest: {
          where: { isGuest: true },
        },
      },
    }
  );
  return User;
};
