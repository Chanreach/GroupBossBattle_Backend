import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcrypt";

export default {
  async up(queryInterface, Sequelize) {
    try {
      await queryInterface.bulkInsert(
        "users",
        [
          {
            id: uuidv4(),
            username: "superadmin",
            email: "superadmin@uni.raid",
            password: await bcrypt.hash("@UniRAID%ihavesuperadminrights25", 10),
            role: "superadmin",
            last_active_at: new Date(),
          },
        ],
        {}
      );
    } catch (error) {
      console.error("Seeding superadmin user:", error);
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("users", { username: "superadmin" }, {});
  },
};
