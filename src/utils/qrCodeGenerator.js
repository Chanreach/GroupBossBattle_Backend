import QRCode from "qrcode";
import path from "path";
import fs from "fs/promises";

/**
 * Generates a QR code as a data URL (base64 encoded image)
 * @param {string} text - The text to encode in the QR code
 * @param {Object} options - QR code generation options
 * @returns {Promise<string>} Base64 data URL of the QR code
 */
export async function generateQRCodeDataURL(text, options = {}) {
  try {
    const defaultOptions = {
      type: 'image/png',
      quality: 0.92,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: 256,
      ...options
    };

    const dataURL = await QRCode.toDataURL(text, defaultOptions);
    return dataURL;
  } catch (error) {
    console.error('Error generating QR code data URL:', error);
    throw new Error('Failed to generate QR code');
  }
}

/**
 * Generates a QR code and saves it as a file
 * @param {string} text - The text to encode in the QR code
 * @param {string} filename - The filename to save the QR code as
 * @param {string} outputDir - Directory to save the file (optional)
 * @param {Object} options - QR code generation options
 * @returns {Promise<string>} Path to the generated file
 */
export async function generateQRCodeFile(text, filename, outputDir = './uploads/qr-codes', options = {}) {
  try {
    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });

    const defaultOptions = {
      type: 'png',
      quality: 0.92,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: 512,
      ...options
    };

    const filePath = path.join(outputDir, filename);
    await QRCode.toFile(filePath, text, defaultOptions);
    
    return filePath;
  } catch (error) {
    console.error('Error generating QR code file:', error);
    throw new Error('Failed to generate QR code file');
  }
}

/**
 * Generates a QR code for a boss join URL
 * @param {string} joinCode - The unique join code for the boss
 * @param {string} baseURL - Base URL of the application (optional)
 * @returns {Promise<string>} Base64 data URL of the QR code
 */
export async function generateBossJoinQRCode(joinCode, baseURL = process.env.FRONTEND_URL || 'http://localhost:5173') {
  try {
    const joinURL = `${baseURL}/player/join?code=${joinCode}`;
    
    const qrCodeOptions = {
      width: 300,
      margin: 2,
      color: {
        dark: '#1f2937', // Dark gray
        light: '#ffffff'  // White
      }
    };

    return await generateQRCodeDataURL(joinURL, qrCodeOptions);
  } catch (error) {
    console.error('Error generating boss join QR code:', error);
    throw new Error('Failed to generate boss join QR code');
  }
}

/**
 * Generates a QR code SVG string
 * @param {string} text - The text to encode in the QR code
 * @param {Object} options - QR code generation options
 * @returns {Promise<string>} SVG string of the QR code
 */
export async function generateQRCodeSVG(text, options = {}) {
  try {
    const defaultOptions = {
      type: 'svg',
      quality: 0.92,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: 256,
      ...options
    };

    const svgString = await QRCode.toString(text, defaultOptions);
    return svgString;
  } catch (error) {
    console.error('Error generating QR code SVG:', error);
    throw new Error('Failed to generate QR code SVG');
  }
}

export default {
  generateQRCodeDataURL,
  generateQRCodeFile,
  generateBossJoinQRCode,
  generateQRCodeSVG
};
