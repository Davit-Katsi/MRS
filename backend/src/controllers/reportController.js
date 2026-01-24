const { Sequelize } = require("sequelize");
const { Product, Supplier, PriceUpdate } = require("../models");
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");

exports.getLatestPricesByProductCode = async (req, res) => {
  try {
    const productCode = String(req.params.productCode || "").trim();
    if (!productCode) return res.status(400).json({ message: "productCode is required" });

    const product = await Product.findOne({ where: { product_code: productCode } });
    if (!product) return res.status(404).json({ message: "Product not found" });

    // Latest price update per supplier for this product
    // Postgres DISTINCT ON trick (fast + simple)
    const rows = await PriceUpdate.findAll({
      where: { product_id: product.id },
      attributes: [
        "supplier_id",
        "price",
        "currency",
        "effective_date",
        "created_at",
      ],
      include: [
        {
          model: Supplier,
          attributes: ["id", "company_name"],
        },
      ],
      order: [
        [Sequelize.literal('"PriceUpdate"."supplier_id"'), "ASC"],
        ["effective_date", "DESC"],
        ["created_at", "DESC"],
      ],
    });

    // Because Sequelize doesn't expose DISTINCT ON easily, we'll reduce in JS:
    const latestBySupplier = new Map();
    for (const r of rows) {
      const sid = r.supplier_id;
      if (!latestBySupplier.has(sid)) latestBySupplier.set(sid, r);
    }

    const latest = Array.from(latestBySupplier.values()).map((r) => ({
      supplierId: r.Supplier?.id,
      supplierName: r.Supplier?.company_name,
      price: r.price,
      currency: r.currency,
      effective_date: r.effective_date,
      created_at: r.created_at,
    }));

    // Add simple comparison stats
    const pricesNumeric = latest
      .map((x) => Number(x.price))
      .filter((n) => Number.isFinite(n));

    const min = pricesNumeric.length ? Math.min(...pricesNumeric) : null;
    const max = pricesNumeric.length ? Math.max(...pricesNumeric) : null;

    return res.json({
      product: {
        id: product.id,
        product_code: product.product_code,
        name: product.name,
        unit: product.unit,
        category: product.category,
      },
      latestPrices: latest,
      summary: {
        supplierCount: latest.length,
        minPrice: min,
        maxPrice: max,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.exportLatestPricesByProductCodeCSV = async (req, res) => {
  try {
    const productCode = String(req.params.productCode || "").trim();
    if (!productCode) return res.status(400).json({ message: "productCode is required" });

    // reuse your existing JSON method logic by calling it internally is messy,
    // so we copy minimal logic here:
    const { Product, Supplier, PriceUpdate } = require("../models");
    const { Sequelize } = require("sequelize");

    const product = await Product.findOne({ where: { product_code: productCode } });
    if (!product) return res.status(404).json({ message: "Product not found" });

    const rows = await PriceUpdate.findAll({
      where: { product_id: product.id },
      attributes: ["supplier_id", "price", "currency", "effective_date", "created_at"],
      include: [{ model: Supplier, attributes: ["id", "company_name"] }],
      order: [
        [Sequelize.literal('"PriceUpdate"."supplier_id"'), "ASC"],
        ["effective_date", "DESC"],
        ["created_at", "DESC"],
      ],
    });

    const latestBySupplier = new Map();
    for (const r of rows) {
      if (!latestBySupplier.has(r.supplier_id)) latestBySupplier.set(r.supplier_id, r);
    }

    const latest = Array.from(latestBySupplier.values());

    // Build CSV
    const header = ["product_code","product_name","supplier_name","price","currency","effective_date"];
    const lines = [header.join(",")];

    const esc = (v) => {
      const s = String(v ?? "");
      // wrap in quotes if contains comma or quote
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    for (const r of latest) {
      lines.push([
        esc(product.product_code),
        esc(product.name),
        esc(r.Supplier?.company_name || ""),
        esc(r.price),
        esc(r.currency),
        esc(r.effective_date),
      ].join(","));
    }

    const csv = lines.join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="report_${productCode}.csv"`);
    return res.send(csv);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.exportLatestPricesByProductCodeExcel = async (req, res) => {
  try {
    const productCode = String(req.params.productCode || "").trim();
    if (!productCode) return res.status(400).json({ message: "productCode is required" });

    const product = await Product.findOne({ where: { product_code: productCode } });
    if (!product) return res.status(404).json({ message: "Product not found" });

    const rows = await PriceUpdate.findAll({
      where: { product_id: product.id },
      attributes: ["supplier_id", "price", "currency", "effective_date", "created_at"],
      include: [{ model: Supplier, attributes: ["id", "company_name"] }],
      order: [
        [Sequelize.literal('"PriceUpdate"."supplier_id"'), "ASC"],
        ["effective_date", "DESC"],
        ["created_at", "DESC"],
      ],
    });

    const latestBySupplier = new Map();
    for (const r of rows) {
      if (!latestBySupplier.has(r.supplier_id)) latestBySupplier.set(r.supplier_id, r);
    }

    const latest = Array.from(latestBySupplier.values());

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Report");

    ws.addRow(["Product Code", "Product Name", "Supplier", "Price", "Currency", "Effective Date"]);
    for (const r of latest) {
      ws.addRow([
        product.product_code,
        product.name,
        r.Supplier?.company_name || "",
        Number(r.price),
        r.currency,
        r.effective_date,
      ]);
    }

    ws.columns.forEach((c) => (c.width = 20));

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="report_${productCode}.xlsx"`);

    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.exportLatestPricesByProductCodePDF = async (req, res) => {
  try {
    const productCode = String(req.params.productCode || "").trim();
    if (!productCode) return res.status(400).json({ message: "productCode is required" });

    const product = await Product.findOne({ where: { product_code: productCode } });
    if (!product) return res.status(404).json({ message: "Product not found" });

    const rows = await PriceUpdate.findAll({
      where: { product_id: product.id },
      attributes: ["supplier_id", "price", "currency", "effective_date", "created_at"],
      include: [{ model: Supplier, attributes: ["id", "company_name"] }],
      order: [
        [Sequelize.literal('"PriceUpdate"."supplier_id"'), "ASC"],
        ["effective_date", "DESC"],
        ["created_at", "DESC"],
      ],
    });

    const latestBySupplier = new Map();
    for (const r of rows) {
      if (!latestBySupplier.has(r.supplier_id)) latestBySupplier.set(r.supplier_id, r);
    }
    const latest = Array.from(latestBySupplier.values());

    // Response headers
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="report_${productCode}.pdf"`);

    const doc = new PDFDocument({ margin: 40, size: "A4" });
    doc.pipe(res);

    // Title
    doc.fontSize(18).text("MRS Price Comparison Report", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(12).text(`Product: ${product.product_code} — ${product.name}`);
    if (product.unit) doc.text(`Unit: ${product.unit}`);
    if (product.category) doc.text(`Category: ${product.category}`);
    doc.moveDown(1);

    // Table header
    const startX = 40;
    let y = doc.y;

    const colSupplier = startX;
    const colPrice = 300;
    const colCurrency = 380;
    const colDate = 450;

    doc.fontSize(11).text("Supplier", colSupplier, y);
    doc.text("Price", colPrice, y);
    doc.text("Cur", colCurrency, y);
    doc.text("Effective Date", colDate, y);
    y += 18;

    doc.moveTo(startX, y - 4).lineTo(555, y - 4).stroke();

    // Rows
    doc.fontSize(10);
    for (const r of latest) {
      const supplierName = r.Supplier?.company_name || "";
      const price = String(r.price);
      const currency = String(r.currency || "");
      const eff = String(r.effective_date || "");

      // new page if needed
      if (y > 780) {
        doc.addPage();
        y = 60;
      }

      doc.text(supplierName, colSupplier, y, { width: 250 });
      doc.text(price, colPrice, y);
      doc.text(currency, colCurrency, y);
      doc.text(eff, colDate, y);
      y += 16;
    }

    doc.moveDown(1);
    doc.text(`Suppliers: ${latest.length}`, startX, y + 10);

    doc.end();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};
