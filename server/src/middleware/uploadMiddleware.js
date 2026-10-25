import multer from "multer";

const storage = multer.memoryStorage();

const fileFilter = (_req, file, cb) => {
  if (!file.mimetype?.startsWith("image/")) {
    return cb(new Error("Only image uploads are allowed"));
  }
  cb(null, true);
};

export const uploadProfilePicture = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
}).single("profilePicture");

export const uploadCompanyLogo = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
}).single("companyLogo");

export const uploadCompanyCoverPicture = multer({
  storage,
  fileFilter,
  limits: { fileSize: 8 * 1024 * 1024 },
}).single("coverPicture");
