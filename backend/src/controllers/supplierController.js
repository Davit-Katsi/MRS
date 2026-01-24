const { SupplierProduct, Product, PriceUpdate } = require("../models");

exports.getMyProducts = async (req, res) => {
  try {
    const supplierId = req.user.supplierId;
    if (!supplierId) return res.status(400).json({ message: "Supplier account not linked" });

    const links = await SupplierProduct.findAll({
      where: { supplier_id: supplierId, active: true },
      include: [{ model: Product }],
      order: [[{ model: Product }, "name", "ASC"]],
    });

    const products = links.map((l) => ({
      productId: l.Product.id,
      product_code: l.Product.product_code,
      name: l.Product.name,
      unit: l.Product.unit,
      category: l.Product.category,
      supplier_sku: l.supplier_sku,
    }));

    res.json({ products });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.submitPriceUpdate = async (req, res) => {
  try {
    const supplierId = req.user.supplierId;
    const userId = req.user.id;

    const { product_code, price, currency, effective_date } = req.body || {};

    if (!supplierId) return res.status(400).json({ message: "Supplier account not linked" });
    if (!product_code || !price || !currency || !effective_date) {
      return res.status(400).json({ message: "product_code, price, currency, effective_date are required" });
    }

    // Find assigned product for this supplier
    const link = await SupplierProduct.findOne({
      where: { supplier_id: supplierId, active: true },
      include: [{ model: Product, where: { product_code } }],
    });

    if (!link || !link.Product) {
      return res.status(403).json({ message: "This product is not assigned to you" });
    }

    const created = await PriceUpdate.create({
      supplier_id: supplierId,
      product_id: link.Product.id,
      price,
      currency: String(currency).toUpperCase(),
      effective_date,
      source: "portal",
      created_by: userId,
    });

    res.status(201).json({ message: "Price update saved", id: created.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
