export const getImageUrl = (imagePath) => {
  if (!imagePath) return null;

  const baseUrl =
    process.env.NODE_ENV === "production"
      ? process.env.APP_URL
      : `http://localhost:${process.env.PORT || 3000}`;

  return `${baseUrl}/api/uploads/${imagePath}`;
};
