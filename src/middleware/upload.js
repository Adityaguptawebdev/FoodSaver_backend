import multer from "multer";

function fileFilter(req, file, cb) {
  if (/^image\/(jpeg|png|webp)$/.test(file.mimetype)) return cb(null, true);
  cb(new Error("Only jpeg, png or webp images are allowed"));
}

// Memory storage - files are uploaded straight to Cloudinary from the buffer,
// never touching local disk (which doesn't persist on platforms like Render).
export const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});
