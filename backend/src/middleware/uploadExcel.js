const multer = require("multer");

const storage = multer.memoryStorage();

const uploadExcel = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const ok =
      file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.originalname.toLowerCase().endsWith(".xlsx");

    if (!ok) return cb(new Error("Only .xlsx files are allowed"));
    cb(null, true);
  },
});

module.exports = uploadExcel;
