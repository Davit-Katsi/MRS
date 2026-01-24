const express = require("express");
const router = express.Router();

const reportController = require("../controllers/reportController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

// Admin can see comparisons
router.get(
  "/product/:productCode",
  authMiddleware,
  roleMiddleware("admin"),
  reportController.getLatestPricesByProductCode
);

router.get(
  "/product/:productCode/export/csv",
  authMiddleware,
  roleMiddleware("admin"),
  reportController.exportLatestPricesByProductCodeCSV
);

router.get(
  "/product/:productCode/export/excel",
  authMiddleware,
  roleMiddleware("admin"),
  reportController.exportLatestPricesByProductCodeExcel
);

router.get(
  "/product/:productCode/export/pdf",
  authMiddleware,
  roleMiddleware("admin"),
  reportController.exportLatestPricesByProductCodePDF
);


module.exports = router;
