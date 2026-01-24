const sequelize = require("../config/db");

const User = require("./User");
const Supplier = require("./Supplier");
const Product = require("./Product");
const SupplierProduct = require("./SupplierProduct");
const PriceUpdate = require("./PriceUpdate");

SupplierProduct.belongsTo(Product, { foreignKey: "product_id" });

Supplier.belongsTo(User, { foreignKey: "user_id", as: "user" });
User.hasOne(Supplier, { foreignKey: "user_id", as: "supplier" });

Supplier.belongsToMany(Product, { through: SupplierProduct, foreignKey: "supplier_id", otherKey: "product_id" });
Product.belongsToMany(Supplier, { through: SupplierProduct, foreignKey: "product_id", otherKey: "supplier_id" });

PriceUpdate.belongsTo(Supplier, { foreignKey: "supplier_id" });
PriceUpdate.belongsTo(Product, { foreignKey: "product_id" });
PriceUpdate.belongsTo(User, { foreignKey: "created_by", as: "creator" });

module.exports = { sequelize, User, Supplier, Product, SupplierProduct, PriceUpdate };
