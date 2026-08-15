const { query, get, run, db } = require('../../config/database');
const ProductModel = require('./ProductModel');

class StockModel {
  /**
   * Registrar movimiento de stock (Kárdex)
   * movement_type: 'ENTRADA_COMPRA', 'SALIDA_VENTA', 'AJUSTE_INVENTARIO', 'MERMA_PERDIDA'
   */
  static async registerMovement({ product_id, movement_type, quantity, notes = '' }) {
    const product = await ProductModel.getById(product_id);
    if (!product) {
      throw new Error(`Producto con código/SKU ${product_id} no encontrado.`);
    }

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      throw new Error('La cantidad de movimiento debe ser mayor a 0.');
    }

    const previousStock = parseFloat(product.stock);
    let delta = qty;

    // Si es salida por venta o merma, la cantidad descuenta stock
    if (['SALIDA_VENTA', 'MERMA_PERDIDA'].includes(movement_type)) {
      delta = -qty;
    }

    const newStock = Math.max(0, previousStock + delta);
    const barcodeKey = product.barcode;

    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        // 1. Actualizar el stock del producto usando barcode como PK
        const updateStockSql = `UPDATE products SET stock = ?, updated_at = CURRENT_TIMESTAMP WHERE barcode = ?`;
        db.run(updateStockSql, [newStock, barcodeKey], function (err) {
          if (err) {
            db.run('ROLLBACK');
            return reject(err);
          }

          // 2. Registrar el movimiento en el historial (Kárdex)
          const insertMovementSql = `
            INSERT INTO stock_movements (product_id, movement_type, quantity, previous_stock, new_stock, notes)
            VALUES (?, ?, ?, ?, ?, ?)
          `;
          db.run(insertMovementSql, [barcodeKey, movement_type, qty, previousStock, newStock, notes], function (err2) {
            if (err2) {
              db.run('ROLLBACK');
              return reject(err2);
            }

            db.run('COMMIT', (commitErr) => {
              if (commitErr) return reject(commitErr);
              resolve({
                movement_id: this.lastID,
                product_id: barcodeKey,
                product_name: product.name,
                movement_type,
                previous_stock: previousStock,
                quantity_changed: delta,
                new_stock: newStock
              });
            });
          });
        });
      });
    });
  }

  /**
   * Obtener productos con Alertas de Stock Bajo (stock <= min_stock)
   */
  static async getLowStockAlerts() {
    const sql = `
      SELECT p.*, c.name as category_name, b.name as brand_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN brands b ON p.brand_id = b.id
      WHERE p.stock <= p.min_stock AND p.is_active = 1
      ORDER BY p.stock ASC
    `;
    return await query(sql);
  }

  /**
   * Obtener historial de movimientos (Kárdex) por producto o general
   */
  static async getMovements({ product_id = null, limit = 50 } = {}) {
    let sql = `
      SELECT m.*, p.name as product_name, p.barcode, p.unit_measure
      FROM stock_movements m
      JOIN products p ON m.product_id = p.barcode
      WHERE 1=1
    `;
    const params = [];

    if (product_id) {
      sql += ` AND m.product_id = ?`;
      params.push(product_id);
    }

    sql += ` ORDER BY m.created_at DESC LIMIT ?`;
    params.push(limit);

    return await query(sql, params);
  }
}

module.exports = StockModel;
