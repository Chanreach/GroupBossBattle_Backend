import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "secret";

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "No token provided." });
  }
  jwt.verify(token, JWT_SECRET, (error, user) => {
    if (error) {
      if (
        error.name === "TokenExpiredError" ||
        error.name === "JsonWebTokenError"
      ) {
        return res
          .status(401)
          .json({ message: "Invalid token.", error: error.name });
      }
      return res
        .status(500)
        .json({ message: "Internal Server Error.", error: error.message });
    }

    req.user = user;
    next();
  });
};

export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: "Forbidden: You are not allowed to perform this action.",
      });
    }
    next();
  };
};
