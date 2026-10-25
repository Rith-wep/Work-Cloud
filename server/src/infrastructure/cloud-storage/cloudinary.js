import { v2 as cloudinary } from "cloudinary";
const cleanEnv = (value) => String(value || "").trim().replace(/^['"]|['"]$/g, "");
const getCloudinaryEnv = () => ({ cloudName: cleanEnv(process.env.CLOUDINARY_CLOUD_NAME), apiKey: cleanEnv(process.env.CLOUDINARY_API_KEY), apiSecret: cleanEnv(process.env.CLOUDINARY_API_SECRET) });
export const configureCloudinary = () => {
  const { cloudName, apiKey, apiSecret } = getCloudinaryEnv();
  if (!cloudName || !apiKey || !apiSecret) return false;
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
  return true;
};
export const isCloudinaryConfigured = () => { const { cloudName, apiKey, apiSecret } = getCloudinaryEnv(); return Boolean(cloudName && apiKey && apiSecret); };
export default cloudinary;
