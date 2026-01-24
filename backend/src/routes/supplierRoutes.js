const express = require("express");
const router = express.Router();

const supplierController = require("../controllers/supplierController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.get("/products", authMiddleware, roleMiddleware("supplier"), supplierController.getMyProducts);
router.post("/prices", authMiddleware, roleMiddleware("supplier"), supplierController.submitPriceUpdate);

module.exports = router;
