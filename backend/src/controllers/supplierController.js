const { Op } = require("sequelize");
const { SupplierProduct, Product, PriceUpdate } = require("../models");

exports.getMyProducts = async (req, res) => {
  try {
    const supplierId = req.user?.supplierId;
    if (!supplierId) return res.status(400).json({ message: "Supplier account not linked" });

    // 1) Assigned products
    const links = await SupplierProduct.findAll({
      where: { supplier_id: supplierId, active: true },
      include: [{ model: Product }],
      order: [[{ model: Product }, "name", "ASC"]],
    });

    const productIds = links.map((l) => l.Product?.id).filter(Boolean);

    // 2) Price updates for THIS supplier and assigned products
    const updates = productIds.length
      ? await PriceUpdate.findAll({
          where: {
            supplier_id: supplierId,
            product_id: { [Op.in]: productIds },
          },
          attributes: ["product_id", "price", "currency", "effective_date", "created_at"],
          order: [
            ["product_id", "ASC"],
            ["effective_date", "DESC"],
            ["created_at", "DESC"],
          ],
        })
      : [];

    // Latest update per product_id
    const latestByProductId = new Map();
    for (const u of updates) {
      if (!latestByProductId.has(u.product_id)) latestByProductId.set(u.product_id, u);
    }

    // 3) Build response
    const products = links
      .filter((l) => l.Product) // safety
      .map((l) => {
        const p = l.Product;
        const latest = latestByProductId.get(p.id);

        return {
          productId: p.id,
          product_code: p.product_code,
          name: p.name,
          unit: p.unit,
          category: p.category,
          supplier_sku: l.supplier_sku,

          // ✅ NEW fields for Supplier Dashboard
          latest_price: latest ? String(latest.price) : null,
          latest_currency: latest ? latest.currency : null,
          latest_effective_date: latest ? latest.effective_date : null,
        };
      });

    return res.json({ products });
  } catch (err) {
    console.error("getMyProducts error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.submitPriceUpdate = async (req, res) => {
  try {
    const supplierId = req.user?.supplierId;
    const userId = req.user?.id;

    const { product_code, price, currency, effective_date } = req.body || {};

    if (!supplierId) return res.status(400).json({ message: "Supplier account not linked" });
    if (!product_code || !price || !currency || !effective_date) {
      return res.status(400).json({ message: "product_code, price, currency, effective_date are required" });
    }

    // ensure assigned product
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

    return res.status(201).json({ message: "Price update saved", id: created.id });
  } catch (err) {
    console.error("submitPriceUpdate error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
