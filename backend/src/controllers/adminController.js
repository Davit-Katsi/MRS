const ExcelJS = require("exceljs");
const { sequelize, User, Supplier, SupplierProduct, Product } = require("../models");

exports.createSupplier = async (req, res) => {
  const { company_name, name, email, password } = req.body || {};

  if (!company_name || !name || !email || !password) {
    return res.status(400).json({
      message: "company_name, name, email, password are required",
    });
  }

  try {
    const existing = await User.findOne({ where: { email } });
    if (existing) {
      return res.status(409).json({ message: "Email already in use" });
    }

    const result = await sequelize.transaction(async (t) => {
      const user = User.build({
        name,
        email,
        role: "supplier",
        active: true,
        password_hash: "temp",
      });

      await user.setPassword(password);
      await user.save({ transaction: t });

      const supplier = await Supplier.create(
        {
          company_name,
          user_id: user.id,
          active: true,
        },
        { transaction: t }
      );

      return { user, supplier };
    });

    return res.status(201).json({
      message: "Supplier created",
      supplier: {
        id: result.supplier.id,
        company_name: result.supplier.company_name,
        active: result.supplier.active,
      },
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
        active: result.user.active,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.importSupplierProductsExcel = async (req, res) => {
  const supplierId = Number(req.params.supplierId);

  if (!supplierId) return res.status(400).json({ message: "Invalid supplierId" });
  const uploadedFile = req.file || (Array.isArray(req.files) ? req.files[0] : null);
    if (!uploadedFile) {
      return res.status(400).json({
        message: "Excel file is required",
        receivedFileFields: Array.isArray(req.files) ? req.files.map(f => f.fieldname) : [],
      });
    }

  try {
    // Load workbook from memory buffer
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(uploadedFile.buffer);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) return res.status(400).json({ message: "Excel file has no sheets" });

    // Read headers from first row
    const headerRow = worksheet.getRow(1);
    const headers = (headerRow.values || [])
      .map((v) => String(v || "").trim().toLowerCase());

    const colIndex = (name) => headers.indexOf(name.toLowerCase());

    const idxCode = colIndex("product_code");
    const idxName = colIndex("product_name");
    const idxUnit = colIndex("unit");
    const idxCategory = colIndex("category");
    const idxSku = colIndex("supplier_sku");

    if (idxCode === -1 || idxName === -1) {
      return res.status(400).json({
        message: "Missing required headers: product_code, product_name",
        foundHeaders: headers.filter(Boolean),
      });
    }

    // Convert rows into objects
    const rows = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // header
      const get = (idx) => {
        if (idx === -1) return "";
        const val = row.getCell(idx).value;
        // ExcelJS cell value might be object for rich text; String() is safe
        return String(val || "").trim();
      };

      rows.push({
        product_code: get(idxCode),
        product_name: get(idxName),
        unit: get(idxUnit),
        category: get(idxCategory),
        supplier_sku: get(idxSku),
        _rowNumber: rowNumber,
      });
    });

    let createdProducts = 0;
    let linkedProducts = 0;
    let skippedRows = 0;
    const errors = [];

    await sequelize.transaction(async (t) => {
      for (const r of rows) {
        const product_code = String(r.product_code || "").trim();
        const name = String(r.product_name || "").trim();
        const unit = r.unit ? String(r.unit).trim() : null;
        const category = r.category ? String(r.category).trim() : null;
        const supplier_sku = r.supplier_sku ? String(r.supplier_sku).trim() : null;

        if (!product_code || !name) {
          skippedRows++;
          errors.push({ row: r._rowNumber, message: "Missing product_code or product_name" });
          continue;
        }

        // find/create product
        let product = await Product.findOne({ where: { product_code }, transaction: t });

        if (!product) {
          product = await Product.create(
            { product_code, name, unit, category, active: true },
            { transaction: t }
          );
          createdProducts++;
        } else {
          // optional: only fill missing fields
          const updateData = {};
          if (!product.name && name) updateData.name = name;
          if (!product.unit && unit) updateData.unit = unit;
          if (!product.category && category) updateData.category = category;
          if (Object.keys(updateData).length) {
            await product.update(updateData, { transaction: t });
          }
        }

        // link supplier -> product
        const [link, created] = await SupplierProduct.findOrCreate({
          where: { supplier_id: supplierId, product_id: product.id },
          defaults: { supplier_sku, active: true },
          transaction: t,
        });

        if (!created && supplier_sku && link.supplier_sku !== supplier_sku) {
          await link.update({ supplier_sku }, { transaction: t });
        }

        linkedProducts++;
      }
    });

    return res.json({
      message: "Import completed",
      summary: { createdProducts, linkedProducts, skippedRows },
      errors: errors.slice(0, 50),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error", error: String(err.message || err) });
  }
};

// LIST SUPPLIERS (for Admin dashboard)
exports.listSuppliers = async (req, res) => {
  try {
    const suppliers = await Supplier.findAll({
      attributes: ["id", "company_name", "active", "user_id"],
      order: [["id", "ASC"]],
    });

    return res.json({ suppliers });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};

