const express = require("express");
const router = express.Router();

const reportController = require("../controllers/reportController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const uploadExcel = require("../middleware/uploadExcel"); 

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

// ✅ NEW: Bulk lowest prices by Excel upload (product codes)
router.post(
  "/bulk/lowest",
  authMiddleware,
  roleMiddleware("admin"),
  uploadExcel.single("file"),
  reportController.getBulkLowestPricesFromExcel
);

// ✅ NEW: Bulk export endpoints
router.get(
  "/bulk/lowest/export/csv",
  authMiddleware,
  roleMiddleware("admin"),
  reportController.exportBulkLowestCSV
);

router.get(
  "/bulk/lowest/export/excel",
  authMiddleware,
  roleMiddleware("admin"),
  reportController.exportBulkLowestExcel
);

router.get(
  "/bulk/lowest/export/pdf",
  authMiddleware,
  roleMiddleware("admin"),
  reportController.exportBulkLowestPDF
);

// ✅ NEW: Voucher PDFs ZIP (requires beneficiary_name + beneficiary_id in Excel)
router.post(
  "/bulk/vouchers/pdf-zip",
  authMiddleware,
  roleMiddleware("admin"),
  uploadExcel.single("file"),
  reportController.exportBulkVouchersPDFZip
);

module.exports = router;
