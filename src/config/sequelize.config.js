import dotenv from 'dotenv';
dotenv.config();

export default {
    development: {
      username: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'groupbossbattle',
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      dialect: 'mysql',
      charset: process.env.DB_CHARSET || 'utf8mb4',
      collate: process.env.DB_COLLATION || 'utf8mb4_general_ci',
      logging: false,
    },
};