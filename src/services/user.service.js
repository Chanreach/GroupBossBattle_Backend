import { User } from "../../models/index.js";

class UserService {
  static async getUserById(userId) {
    const user = await User.findByPk(userId, {
      attributes: { exclude: ["password", "createdAt", "updatedAt"] },
    });
    return user;
  }
}

export default UserService;
