const { query, get, run } = require('../../config/database');

class ProductModel {
  static async getAll({ search = '', categoryId = null, brandId = null, activeOnly = true } = {}) {
    let sql = `
      SELECT p.*, c.name as category_name, b.name as brand_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN brands b ON p.brand_id = b.id
      WHERE 1=1
    `;
    const params = [];

    if (activeOnly) {
      sql += ` AND p.is_active = 1`;
    }

    if (categoryId) {
      sql += ` AND p.category_id = ?`;
      params.push(categoryId);
    }

    if (brandId) {
      sql += ` AND p.brand_id = ?`;
      params.push(brandId);
    }

    if (search && search.trim() !== '') {
      sql += ` AND (p.name LIKE ? OR p.barcode LIKE ? OR b.name LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    sql += ` ORDER BY p.name ASC`;
    return await query(sql, params);
  }

  static async getByBarcode(barcode) {
    const sql = `
      SELECT p.*, c.name as category_name, b.name as brand_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN brands b ON p.brand_id = b.id
      WHERE p.barcode = ? AND p.is_active = 1
    `;
    return await get(sql, [barcode.trim()]);
  }

  static async getById(barcodeOrId) {
    return await this.getByBarcode(barcodeOrId);
  }

  static async create(data) {
    const {
      barcode,
      name,
      brand_id = null,
      category_id = null,
      purchase_price = 0.00,
      sale_price = 0.00,
      stock = 0.000,
      min_stock = 5.000,
      expiration_date = null,
      status = 'DISPONIBLE',
      is_bulk = 0,
      unit_measure = 'UNIDAD',
      created_at = null,
      updated_at = null
    } = data;

    const existing = await this.getByBarcode(barcode);
    if (existing) {
      throw new Error(`El código/SKU "${barcode}" ya se encuentra registrado con el producto: ${existing.name}`);
    }

    const createDate = created_at || new Date().toISOString().replace('T', ' ').substring(0, 19);
    const updateDate = updated_at || createDate;

    const sql = `
      INSERT INTO products (barcode, name, brand_id, category_id, purchase_price, sale_price, stock, min_stock, expiration_date, status, is_bulk, unit_measure, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await run(sql, [
      barcode.trim(),
      name.trim(),
      brand_id || null,
      category_id || null,
      parseFloat(purchase_price),
      parseFloat(sale_price),
      parseFloat(stock),
      parseFloat(min_stock),
      expiration_date || null,
      status || 'DISPONIBLE',
      parseInt(is_bulk, 10) ? 1 : 0,
      unit_measure || 'UNIDAD',
      createDate,
      updateDate
    ]);

    return { barcode: barcode.trim() };
  }

  static async update(barcodeKey, data) {
    const {
      barcode,
      name,
      brand_id,
      category_id,
      purchase_price,
      sale_price,
      stock,
      min_stock,
      expiration_date,
      status,
      is_bulk,
      unit_measure,
      is_active,
      updated_at
    } = data;

    const fields = [];
    const params = [];

    if (barcode !== undefined) { fields.push('barcode = ?'); params.push(barcode.trim()); }
    if (name !== undefined) { fields.push('name = ?'); params.push(name.trim()); }
    if (brand_id !== undefined) { fields.push('brand_id = ?'); params.push(brand_id || null); }
    if (category_id !== undefined) { fields.push('category_id = ?'); params.push(category_id || null); }
    if (purchase_price !== undefined) { fields.push('purchase_price = ?'); params.push(parseFloat(purchase_price)); }
    if (sale_price !== undefined) { fields.push('sale_price = ?'); params.push(parseFloat(sale_price)); }
    if (stock !== undefined) { fields.push('stock = ?'); params.push(parseFloat(stock)); }
    if (min_stock !== undefined) { fields.push('min_stock = ?'); params.push(parseFloat(min_stock)); }
    if (expiration_date !== undefined) { fields.push('expiration_date = ?'); params.push(expiration_date); }
    if (status !== undefined) { fields.push('status = ?'); params.push(status); }
    if (is_bulk !== undefined) { fields.push('is_bulk = ?'); params.push(parseInt(is_bulk, 10) ? 1 : 0); }
    if (unit_measure !== undefined) { fields.push('unit_measure = ?'); params.push(unit_measure); }
    if (is_active !== undefined) { fields.push('is_active = ?'); params.push(parseInt(is_active, 10) ? 1 : 0); }

    if (updated_at !== undefined) {
      fields.push('updated_at = ?');
      params.push(updated_at);
    } else {
      fields.push('updated_at = CURRENT_TIMESTAMP');
    }

    const sql = `UPDATE products SET ${fields.join(', ')} WHERE barcode = ?`;
    params.push(barcodeKey.trim());

    return await run(sql, params);
  }

  static async delete(barcodeKey) {
    const sql = `DELETE FROM products WHERE barcode = ?`;
    return await run(sql, [barcodeKey.trim()]);
  }
}

module.exports = ProductModel;
