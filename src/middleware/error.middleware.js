import multer from "multer";

const errorHandler = (err, req, res, next) => {
  const statusCode = err.status || 500;
  const message = err.message || "Internal Server Error.";

  if (err instanceof multer.MulterError) {
    let message = "File upload error";
    switch (err.code) {
      case "LIMIT_FILE_SIZE":
        message = "File is too large. Maximum size is 5MB.";
        break;
      case "LIMIT_UNEXPECTED_FILE":
        message = "Unexpected file field.";
        break;
      default:
        message = err.message;
    }
    return res.status(400).json({ message, error: err.message });
  }

  if (err.name === "SequelizeValidationError") {
    const validationErrors = err.errors.map((e) => e.message);
    return res
      .status(400)
      .json({ message: "Validation error", errors: validationErrors });
  }

  if (err.name === "TokenExpiredError") {
    return res.status(401).json({ message: "Refresh token expired." });
  }
  
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({ message: "Invalid refresh token." });
  }

  if (statusCode === 500) {
    console.error(
      `[${new Date().toISOString()}] [${req.method}] ${
        req.originalUrl
      } - User: ${req.user?.id || "Guest"}\n${err.stack}`
    );
  }
  res.status(statusCode).json({ message, error: err.message });
};

export default errorHandler;
