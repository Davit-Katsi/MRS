const { Sequelize } = require("sequelize");
const { Product, Supplier, PriceUpdate } = require("../models");
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");
const path = require("path");
const fs = require("fs");
const archiver = require("archiver");
const { PassThrough } = require("stream");

// ✅ Georgian/Unicode font (OTF works with PDFKit)
const GEO_FONT_PATH = path.join(
  __dirname,
  "..",            // from controllers -> src
  "assets",
  "fonts",
  "firago-latin-300-normal.ttf"
);

// ✅ NEW: Logo for bulk PDF header
const LOGO_PATH = path.join(
  __dirname,
  "..",            // from controllers -> src
  "assets",
  "logo2.png"
);

// Safely apply Georgian font (won't crash if missing)
function applyGeoFont(doc) {
  try {
    if (!fs.existsSync(GEO_FONT_PATH)) {
      console.warn("⚠ Georgian font NOT FOUND:", GEO_FONT_PATH);
      return;
    }
    doc.font(GEO_FONT_PATH);
  } catch (e) {
    console.warn("⚠ Georgian font load FAILED:", e?.message || e);
  }
}

// ✅ NEW: exact generation date/time (Asia/Tbilisi)
function formatDateTimeTbilisi() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tbilisi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const get = (type) => parts.find((p) => p.type === type)?.value || "00";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

/**
 * GET /api/reports/product/:productCode
 */
exports.getLatestPricesByProductCode = async (req, res) => {
  try {
    const productCode = String(req.params.productCode || "").trim();
    if (!productCode)
      return res.status(400).json({ message: "productCode is required" });

    const product = await Product.findOne({
      where: { product_code: productCode },
    });
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

/**
 * GET /api/reports/product/:productCode/export/csv
 */
exports.exportLatestPricesByProductCodeCSV = async (req, res) => {
  try {
    const productCode = String(req.params.productCode || "").trim();
    if (!productCode)
      return res.status(400).json({ message: "productCode is required" });

    const product = await Product.findOne({
      where: { product_code: productCode },
    });
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

    const header = [
      "product_code",
      "product_name",
      "supplier_name",
      "price",
      "currency",
      "effective_date",
    ];
    const lines = [header.join(",")];

    const esc = (v) => {
      const s = String(v ?? "");
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    for (const r of latest) {
      lines.push(
        [
          esc(product.product_code),
          esc(product.name),
          esc(r.Supplier?.company_name || ""),
          esc(r.price),
          esc(r.currency),
          esc(r.effective_date),
        ].join(",")
      );
    }

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="report_${productCode}.csv"`
    );
    return res.send(lines.join("\n"));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * GET /api/reports/product/:productCode/export/excel
 */
exports.exportLatestPricesByProductCodeExcel = async (req, res) => {
  try {
    const productCode = String(req.params.productCode || "").trim();
    if (!productCode)
      return res.status(400).json({ message: "productCode is required" });

    const product = await Product.findOne({
      where: { product_code: productCode },
    });
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

    ws.addRow([
      "Product Code",
      "Product Name",
      "Supplier",
      "Price",
      "Currency",
      "Effective Date",
    ]);

    for (const r of latest) {
      ws.addRow([
        product.product_code,
        product.name,
        r.Supplier?.company_name || "",
        r.price !== null && r.price !== undefined ? Number(r.price) : "",
        r.currency || "",
        r.effective_date || "",
      ]);
    }

    ws.columns.forEach((c) => (c.width = 20));

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="report_${productCode}.xlsx"`
    );

    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * GET /api/reports/product/:productCode/export/pdf
 */
exports.exportLatestPricesByProductCodePDF = async (req, res) => {
  try {
    const productCode = String(req.params.productCode || "").trim();
    if (!productCode)
      return res.status(400).json({ message: "productCode is required" });

    const product = await Product.findOne({
      where: { product_code: productCode },
    });
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

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="report_${productCode}.pdf"`
    );

    const doc = new PDFDocument({ margin: 40, size: "A4" });
    doc.pipe(res);

    // ✅ Apply Georgian font
    applyGeoFont(doc);

    // ✅ generation time
    const generatedAt = formatDateTimeTbilisi();

    doc.fontSize(18).text("MRS Price Comparison Report", { align: "center" });
    doc.fontSize(9).text(`Generated at: ${generatedAt}`, { align: "right" });
    doc.moveDown(0.5);

    doc.fontSize(12).text(`Product: ${product.product_code} — ${product.name}`);
    if (product.unit) doc.text(`Unit: ${product.unit}`);
    if (product.category) doc.text(`Category: ${product.category}`);
    doc.moveDown(1);

    const startX = doc.page.margins.left;
    let y = doc.y;

    const colSupplier = startX;
    const colPrice = 320;
    const colCurrency = 410;
    const colDate = 470;

    doc.fontSize(11).text("Supplier", colSupplier, y);
    doc.text("Price", colPrice, y);
    doc.text("Cur", colCurrency, y);
    doc.text("Effective Date", colDate, y);
    y += 18;

    doc
      .moveTo(startX, y - 4)
      .lineTo(doc.page.width - doc.page.margins.right, y - 4)
      .stroke();

    doc.fontSize(10);
    for (const r of latest) {
      const supplierName = r.Supplier?.company_name || "";
      const price = String(r.price ?? "");
      const currency = String(r.currency || "");
      const eff = String(r.effective_date || "");

      if (y > 780) {
        doc.addPage();
        applyGeoFont(doc);
        y = 60;
      }

      doc.text(supplierName, colSupplier, y, { width: 280 });
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

// =====================================================
// BULK: Upload Excel with product codes -> lowest prices
// POST /api/reports/bulk/lowest (multipart: file, minSuppliers)
// =====================================================
exports.getBulkLowestPricesFromExcel = async (req, res) => {
  try {
    const uploadedFile = req.file || (Array.isArray(req.files) ? req.files[0] : null);
    if (!uploadedFile) return res.status(400).json({ message: "Excel file is required" });

    const minSuppliers = Math.max(1, Number(req.body?.minSuppliers || 3));

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(uploadedFile.buffer);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) return res.status(400).json({ message: "Excel file has no sheets" });

    const headerRow = worksheet.getRow(1);
    const headers = (headerRow.values || []).map((v) =>
      String(v || "").trim().toLowerCase()
    );

    const findHeaderIndex = (names) => {
      for (const n of names) {
        const idx = headers.indexOf(String(n).toLowerCase());
        if (idx !== -1) return idx;
      }
      return -1;
    };

    const headerIdx = findHeaderIndex(["product_code", "code", "product code", "კოდი"]);
    const idxCode = headerIdx !== -1 ? headerIdx : 1; // ExcelJS is 1-based

    const codes = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const val = row.getCell(idxCode).value;
      const code = String(val || "").trim();
      if (code) codes.push(code);
    });

    const uniqueCodes = Array.from(new Set(codes)).slice(0, 500);

    // Use shared helper so UI and export match
    const { results, notFound, insufficientSuppliers } =
      await buildBulkLowestResults(uniqueCodes, minSuppliers);

    return res.json({
      requestedCount: uniqueCodes.length,
      minSuppliers,
      results,
      notFound,
      insufficientSuppliers,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error", error: String(err.message || err) });
  }
};

// ================================
// Shared helper for bulk lowest prices
// ================================
async function buildBulkLowestResults(productCodes, minSuppliers = 3) {
  const uniqueCodes = Array.from(
    new Set((productCodes || []).map((c) => String(c || "").trim()).filter(Boolean))
  ).slice(0, 500);

  const results = [];
  const notFound = [];
  const insufficientSuppliers = [];

  for (const productCode of uniqueCodes) {
    const product = await Product.findOne({ where: { product_code: productCode } });

    if (!product) {
      notFound.push(productCode);
      results.push({
        productCode,
        found: false,
        product: null,
        supplierCount: 0,
        topSuppliers: [],
      });
      continue;
    }

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

    const latest = Array.from(latestBySupplier.values()).map((r) => ({
      supplierId: r.Supplier?.id,
      supplierName: r.Supplier?.company_name,
      price: r.price,
      currency: r.currency,
      effective_date: r.effective_date,
    }));

    const sorted = latest
      .map((x) => ({ ...x, _n: Number(x.price) }))
      .filter((x) => Number.isFinite(x._n))
      .sort((a, b) => a._n - b._n)
      .map(({ _n, ...rest }) => rest);

    const topSuppliers = sorted.slice(0, minSuppliers);
    if (latest.length < minSuppliers) insufficientSuppliers.push(productCode);

    results.push({
      productCode,
      found: true,
      product: {
        id: product.id,
        product_code: product.product_code,
        name: product.name,
        unit: product.unit,
        category: product.category,
      },
      supplierCount: latest.length,
      topSuppliers,
    });
  }

  return { uniqueCodes, results, notFound, insufficientSuppliers };
}

// Helper: parse codes from query "codes=1,2,3"
function parseCodesQuery(req) {
  const raw = String(req.query.codes || "").trim();
  if (!raw) return [];
  return raw.split(",").map((x) => String(x || "").trim()).filter(Boolean);
}

/**
 * GET /api/reports/bulk/lowest/export/csv?codes=...&minSuppliers=3
 */
exports.exportBulkLowestCSV = async (req, res) => {
  try {
    const minSuppliers = Math.max(1, Number(req.query.minSuppliers || 3));
    const codes = parseCodesQuery(req);
    if (!codes.length) return res.status(400).json({ message: "codes query param is required" });

    const { results } = await buildBulkLowestResults(codes, minSuppliers);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="bulk_lowest_prices.csv"`);

    const header = [
      "product_code",
      "product_name",
      "supplier_1",
      "price_1",
      "currency_1",
      "supplier_2",
      "price_2",
      "currency_2",
      "supplier_3",
      "price_3",
      "currency_3",
      "supplierCount",
    ];

    const escape = (v) => {
      const s = String(v ?? "");
      if (s.includes('"') || s.includes(",") || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    const lines = [header.join(",")];

    for (const r of results) {
      const pName = r.product?.name || (r.found ? "" : "NOT_FOUND");
      const s1 = r.topSuppliers?.[0];
      const s2 = r.topSuppliers?.[1];
      const s3 = r.topSuppliers?.[2];

      lines.push(
        [
          r.productCode,
          pName,
          s1?.supplierName || "",
          s1?.price || "",
          s1?.currency || "",
          s2?.supplierName || "",
          s2?.price || "",
          s2?.currency || "",
          s3?.supplierName || "",
          s3?.price || "",
          s3?.currency || "",
          r.supplierCount ?? 0,
        ].map(escape).join(",")
      );
    }

    return res.send(lines.join("\n"));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * GET /api/reports/bulk/lowest/export/excel?codes=...&minSuppliers=3
 */
exports.exportBulkLowestExcel = async (req, res) => {
  try {
    const minSuppliers = Math.max(1, Number(req.query.minSuppliers || 3));
    const codes = parseCodesQuery(req);
    if (!codes.length) return res.status(400).json({ message: "codes query param is required" });

    const { results } = await buildBulkLowestResults(codes, minSuppliers);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Bulk Lowest Prices");

    ws.addRow([
      "Product Code",
      "Product Name",
      "Supplier #1",
      "Price #1",
      "Currency #1",
      "Supplier #2",
      "Price #2",
      "Currency #2",
      "Supplier #3",
      "Price #3",
      "Currency #3",
      "Supplier Count",
    ]);

    for (const r of results) {
      const s1 = r.topSuppliers?.[0];
      const s2 = r.topSuppliers?.[1];
      const s3 = r.topSuppliers?.[2];

      ws.addRow([
        r.productCode,
        r.product?.name || (r.found ? "" : "NOT_FOUND"),
        s1?.supplierName || "",
        s1?.price ? Number(s1.price) : "",
        s1?.currency || "",
        s2?.supplierName || "",
        s2?.price ? Number(s2.price) : "",
        s2?.currency || "",
        s3?.supplierName || "",
        s3?.price ? Number(s3.price) : "",
        s3?.currency || "",
        r.supplierCount ?? 0,
      ]);
    }

    ws.columns.forEach((c) => (c.width = 20));

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="bulk_lowest_prices.xlsx"`
    );

    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * GET /api/reports/bulk/lowest/export/pdf?codes=...&minSuppliers=3
 */
exports.exportBulkLowestPDF = async (req, res) => {
  try {
    const minSuppliers = Math.max(1, Number(req.query.minSuppliers || 3));
    const codes = parseCodesQuery(req);
    if (!codes.length) return res.status(400).json({ message: "codes query param is required" });

    const { results } = await buildBulkLowestResults(codes, minSuppliers);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="bulk_lowest_prices.pdf"`
    );

    const doc = new PDFDocument({ margin: 30, size: "A4", layout: "landscape" });
    doc.pipe(res);

    // ✅ Apply Georgian font
    applyGeoFont(doc);

    // ✅ generation time
    const generatedAt = formatDateTimeTbilisi();

    const left = doc.page.margins.left;
    const right = doc.page.margins.right;

    // ✅ Header: logo bottom-left + title + generated time (fit within logo height)
    const headerY = doc.y;
    const logoH = 52;
    let logoW = 0;

    try {
      if (fs.existsSync(LOGO_PATH)) {
        const img = doc.openImage(LOGO_PATH);
        logoW = (img.width / img.height) * logoH;
        doc.image(LOGO_PATH, left, headerY, { height: logoH });
      } else {
        console.warn("⚠ logo NOT FOUND:", LOGO_PATH);
      }
    } catch (e) {
      console.warn("⚠ logo load FAILED:", e?.message || e);
    }

    const textX = left + (logoW ? (logoW + 12) : 0);
    const textWidth = doc.page.width - textX - right;

    // Fit 2 lines within logo height
    let titleFont = 14;
    const dateFont = 9;

    doc.fontSize(titleFont);
    const titleLineH = doc.currentLineHeight(true);
    doc.fontSize(dateFont);
    const dateLineH = doc.currentLineHeight(true);

    if (titleLineH + dateLineH > logoH) titleFont = 12;

    doc.fontSize(titleFont).text("ბაზრის კვლევის სისტემის შედეგი", textX, headerY + 2, {
      width: textWidth,
      align: "left",
    });

    doc.fontSize(dateFont).text(`დაგენერირდა: ${generatedAt}`, textX, headerY + 2 + doc.currentLineHeight(true) * 0 + (titleFont === 12 ? 14 : 16), {
      width: textWidth,
      align: "left",
    });

    // move below header block
    doc.y = headerY + logoH + 8;

    doc.fontSize(10).text(
      `ნივთების რაოდენობა: ${results.length} | ყველაზე დაბალი ფასის მქონე მომწოდებლების რაოდენობა: ${minSuppliers}`
    );
    doc.moveDown(0.7);

    // ✅ Columns: reduce space between supplier & price (narrower columns)
    const wCode = 55;
    const wName = 200;
    const wSup = 105;
    const wPrice = 50;

    const xCode = left;
    const xName = xCode + wCode;
    const xS1 = xName + wName;
    const xP1 = xS1 + wSup;
    const xS2 = xP1 + wPrice;
    const xP2 = xS2 + wSup;
    const xS3 = xP2 + wPrice;
    const xP3 = xS3 + wSup;

    // Header row
    let y = doc.y;
    doc.fontSize(9);
    doc.text("კოდი", xCode, y, { width: wCode });
    doc.text("დასახელება", xName, y, { width: wName });
    doc.text("მომწოდებელი #1", xS1, y, { width: wSup });
    doc.text("ფასი #1", xP1, y, { width: wPrice });
    doc.text("მომწოდებელი #2", xS2, y, { width: wSup });
    doc.text("ფასი #2", xP2, y, { width: wPrice });
    doc.text("მომწოდებელი #3", xS3, y, { width: wSup });
    doc.text("ფასი #3", xP3, y, { width: wPrice });

    y += 14;
    doc
      .moveTo(left, y - 3)
      .lineTo(doc.page.width - right, y - 3)
      .stroke();

    doc.fontSize(8);

    // ✅ Fixed row height for all rows (enough for 2 lines)
    const bottomLimit = doc.page.height - doc.page.margins.bottom - 20;
    const lineH = doc.currentLineHeight(true);
    const rowH = Math.ceil(lineH * 2 + 4); // enough for 2 lines + padding

    const redrawHeaderOnNewPage = () => {
      doc.fontSize(9);
      doc.text("კოდი", xCode, y, { width: wCode });
      doc.text("დასახელება", xName, y, { width: wName });
      doc.text("მომწოდებელი #1", xS1, y, { width: wSup });
      doc.text("ფასი #1", xP1, y, { width: wPrice });
      doc.text("მომწოდებელი #2", xS2, y, { width: wSup });
      doc.text("ფასი #2", xP2, y, { width: wPrice });
      doc.text("მომწოდებელი #3", xS3, y, { width: wSup });
      doc.text("ფასი #3", xP3, y, { width: wPrice });

      y += 14;
      doc
        .moveTo(left, y - 3)
        .lineTo(doc.page.width - right, y - 3)
        .stroke();

      doc.fontSize(8);
    };

    for (const r of results) {
      const s1 = r.topSuppliers?.[0];
      const s2 = r.topSuppliers?.[1];
      const s3 = r.topSuppliers?.[2];

      const codeText = String(r.productCode || "");
      const nameText = String(r.product?.name || (r.found ? "" : "NOT_FOUND"));

      const s1Name = String(s1?.supplierName || "");
      const s2Name = String(s2?.supplierName || "");
      const s3Name = String(s3?.supplierName || "");

      const p1Text = s1 ? `${s1.price} ${s1.currency || ""}` : "";
      const p2Text = s2 ? `${s2.price} ${s2.currency || ""}` : "";
      const p3Text = s3 ? `${s3.price} ${s3.currency || ""}` : "";

      if (y + rowH > bottomLimit) {
        doc.addPage();
        applyGeoFont(doc);
        y = 40;
        redrawHeaderOnNewPage();
      }

      doc.text(codeText, xCode, y, { width: wCode, height: rowH, ellipsis: true });
      doc.text(nameText, xName, y, { width: wName, height: rowH, ellipsis: true });

      doc.text(s1Name, xS1, y, { width: wSup, height: rowH, ellipsis: true });
      doc.text(p1Text, xP1, y, { width: wPrice, height: rowH, lineBreak: false });

      doc.text(s2Name, xS2, y, { width: wSup, height: rowH, ellipsis: true });
      doc.text(p2Text, xP2, y, { width: wPrice, height: rowH, lineBreak: false });

      doc.text(s3Name, xS3, y, { width: wSup, height: rowH, ellipsis: true });
      doc.text(p3Text, xP3, y, { width: wPrice, height: rowH, lineBreak: false });

      y += rowH;

      // ✅ row separator line
      doc
        .moveTo(left, y - 2)
        .lineTo(doc.page.width - right, y - 2)
        .strokeColor("#D8D2C2")
        .lineWidth(0.5)
        .stroke();

      // reset defaults so next strokes look normal
      doc.strokeColor("black").lineWidth(1);
    }

    doc.end();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * POST /api/reports/bulk/vouchers/pdf-zip
 * multipart/form-data: file (excel)
 *
 * Excel MUST include:
 * - product_code (or code / product code / კოდი)
 * - beneficiary_name
 * - beneficiary_id
 *
 * For each row -> generates ONE PDF voucher (lowest price only) -> returns ZIP.
 */
exports.exportBulkVouchersPDFZip = async (req, res) => {
  try {
    const uploadedFile =
      req.file || (Array.isArray(req.files) ? req.files[0] : null);
    if (!uploadedFile)
      return res.status(400).json({ message: "Excel file is required" });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(uploadedFile.buffer);

    const worksheet = workbook.worksheets[0];
    if (!worksheet)
      return res.status(400).json({ message: "Excel file has no sheets" });

    const headerRow = worksheet.getRow(1);
    const headers = (headerRow.values || []).map((v) =>
      String(v || "").trim().toLowerCase()
    );

    const findHeaderIndex = (names) => {
      for (const n of names) {
        const idx = headers.indexOf(String(n).toLowerCase());
        if (idx !== -1) return idx;
      }
      return -1;
    };

    const headerIdxCode = findHeaderIndex([
      "product_code",
      "code",
      "product code",
      "კოდი",
    ]);
    const headerIdxBenName = findHeaderIndex([
      "beneficiary_name",
      "beneficiary name",
      "beneficiary",
      "ბენეფიციარი",
      "ბენეფიციარის სახელი",
      "beneficiaryname",
    ]);
    const headerIdxBenId = findHeaderIndex([
      "beneficiary_id",
      "beneficiary id",
      "id",
      "პირადი ნომერი",
      "ბენეფიციარის id",
      "beneficiaryid",
    ]);

    if (headerIdxCode === -1) {
      return res.status(400).json({
        message:
          "Excel must include product_code column (e.g. product_code / code / კოდი)",
      });
    }
    if (headerIdxBenName === -1 || headerIdxBenId === -1) {
      return res.status(400).json({
        message:
          "Excel must include beneficiary_name and beneficiary_id columns to generate vouchers",
      });
    }

    // headers[] is 0-based; row.getCell() is 1-based.
    // Your previous code already uses header indexes directly; keep same style:
    const idxCode = headerIdxCode;
    const idxBenName = headerIdxBenName;
    const idxBenId = headerIdxBenId;

    const rows = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      const code = String(row.getCell(idxCode).value || "").trim();
      const beneficiaryName = String(
        row.getCell(idxBenName).value || ""
      ).trim();
      const beneficiaryId = String(row.getCell(idxBenId).value || "").trim();

      if (!code && !beneficiaryName && !beneficiaryId) return;

      rows.push({
        productCode: code,
        beneficiaryName,
        beneficiaryId,
        rowNumber,
      });
    });

    if (!rows.length) {
      return res.status(400).json({ message: "Excel file has no data rows" });
    }

    const missingBen = rows.filter(
      (r) => !r.productCode || !r.beneficiaryName || !r.beneficiaryId
    );
    if (missingBen.length) {
      return res.status(400).json({
        message:
          "Cannot generate vouchers: some rows are missing product_code, beneficiary_name, or beneficiary_id",
        sampleMissingRows: missingBen.slice(0, 10).map((x) => x.rowNumber),
      });
    }

    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="vouchers.zip"'
    );

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (err) => {
      console.error("ZIP error:", err);
      try {
        res.status(500).end();
      } catch (_) {}
    });

    archive.pipe(res);

    const generatedAt = formatDateTimeTbilisi();

    for (let i = 0; i < rows.length; i++) {
      const item = rows[i];

      const product = await Product.findOne({
        where: { product_code: item.productCode },
      });

      // Append a PDF stream into ZIP
      const pdfStream = new PassThrough();

      if (!product) {
        archive.append(pdfStream, {
          name: `voucher_${sanitizeFileName(item.productCode)}_${sanitizeFileName(
            item.beneficiaryId
          )}_NOT_FOUND.pdf`,
        });

        const doc = new PDFDocument({ margin: 40, size: "A4" });
        doc.pipe(pdfStream);
        applyGeoFont(doc);

        doc.fontSize(16).text("ვაუჩერი", { align: "center" });
        doc.moveDown(0.5);

        doc.fontSize(11).text(`დაგენერირდა: ${generatedAt}`);
        doc.moveDown(0.8);

        doc.fontSize(12).text(`ბენეფიციარი: ${item.beneficiaryName}`);
        doc.fontSize(12).text(`ბენეფიციარის ID: ${item.beneficiaryId}`);
        doc.moveDown(0.8);

        doc.fontSize(12).text(`პროდუქტის კოდი: ${item.productCode}`);
        doc.fontSize(12).text("პროდუქტი: ვერ მოიძებნა (NOT FOUND)");
        doc.moveDown(0.8);

        doc.fontSize(11).text(
          "შენიშვნა: აღნიშნული კოდით პროდუქტი სისტემაში ვერ მოიძებნა."
        );

        doc.end();
        continue;
      }

      // Find lowest among latest prices per supplier
      const updates = await PriceUpdate.findAll({
        where: { product_id: product.id },
        attributes: [
          "supplier_id",
          "price",
          "currency",
          "effective_date",
          "created_at",
        ],
        include: [{ model: Supplier, attributes: ["id", "company_name"] }],
        order: [
          [Sequelize.literal('"PriceUpdate"."supplier_id"'), "ASC"],
          ["effective_date", "DESC"],
          ["created_at", "DESC"],
        ],
      });

      const latestBySupplier = new Map();
      for (const u of updates) {
        if (!latestBySupplier.has(u.supplier_id)) latestBySupplier.set(u.supplier_id, u);
      }

      const latest = Array.from(latestBySupplier.values()).map((u) => ({
        supplierId: u.Supplier?.id,
        supplierName: u.Supplier?.company_name,
        price: u.price,
        currency: u.currency,
        effective_date: u.effective_date,
      }));

      const lowest = latest
        .map((x) => ({ ...x, _n: Number(x.price) }))
        .filter((x) => Number.isFinite(x._n))
        .sort((a, b) => a._n - b._n)[0];

      const fileSafeCode = sanitizeFileName(item.productCode);
      const fileSafeBen = sanitizeFileName(item.beneficiaryId);

      archive.append(pdfStream, {
        name: `voucher_${fileSafeCode}_${fileSafeBen}.pdf`,
      });

      const doc = new PDFDocument({ margin: 40, size: "A4" });
      doc.pipe(pdfStream);
      applyGeoFont(doc);

      doc.fontSize(16).text("ვაუჩერი", { align: "center" });
      doc.moveDown(0.5);

      doc.fontSize(10).text(`დაგენერირდა: ${generatedAt}`);
      doc.moveDown(0.8);

      doc.fontSize(12).text(`ბენეფიციარი: ${item.beneficiaryName}`);
      doc.fontSize(12).text(`ბენეფიციარის ID: ${item.beneficiaryId}`);
      doc.moveDown(0.8);

      doc.fontSize(12).text(`პროდუქტის კოდი: ${product.product_code}`);
      doc.fontSize(12).text(`პროდუქტი: ${product.name}`);
      if (product.unit) doc.fontSize(11).text(`ერთეული: ${product.unit}`);
      if (product.category) doc.fontSize(11).text(`კატეგორია: ${product.category}`);
      doc.moveDown(0.8);

      doc.fontSize(12).text("ყველაზე დაბალი ფასი", { underline: true });
      doc.moveDown(0.4);

      if (!lowest) {
        doc.fontSize(11).text("ფასი ვერ მოიძებნა (NO PRICE DATA)");
        doc.fontSize(10).text("შენიშვნა: ამ პროდუქტზე მომწოდებლების ფასები არ არის განახლებული.");
      } else {
        doc.fontSize(11).text(`მომწოდებელი: ${lowest.supplierName || ""}`);
        doc.fontSize(11).text(`ფასი: ${lowest.price} ${lowest.currency || ""}`);
        doc.fontSize(11).text(`თარიღი: ${lowest.effective_date || ""}`);
      }

      doc.moveDown(1.2);
      doc
        .fontSize(10)
        .text(
          "დოკუმენტი გენერირებულია სისტემის მიერ და წარმოადგენს ინფორმაციულ ვაუჩერს.",
          { align: "left" }
        );

      doc.end();
    }

    await archive.finalize();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};

// Helper: safe file names for zip entries
function sanitizeFileName(input) {
  return String(input || "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 80) || "item";
}
