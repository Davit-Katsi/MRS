const express = require("express");
const router = express.Router();
const uploadExcel = require("../middleware/uploadExcel");

const adminController = require("../controllers/adminController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.post(
  "/suppliers",
  authMiddleware,
  roleMiddleware("admin"),
  adminController.createSupplier
);

router.post(
  "/suppliers/:supplierId/products/import",
  authMiddleware,
  roleMiddleware("admin"),
  uploadExcel.any(),
  adminController.importSupplierProductsExcel
);


module.exports = router;
