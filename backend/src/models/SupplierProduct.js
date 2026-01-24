const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const SupplierProduct = sequelize.define(
  "SupplierProduct",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    supplier_sku: { type: DataTypes.STRING(80), allowNull: true },
    active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  {
    tableName: "supplier_products",
    timestamps: true,
    underscored: true,
    indexes: [{ unique: true, fields: ["supplier_id", "product_id"] }],
  }
);

module.exports = SupplierProduct;
