const { query, get, run, db } = require('../../config/database');
const CustomerModel = require('./CustomerModel');
const SunatService = require('../services/SunatService');

class SaleModel {
  // REGISTRAR VENTA COMPLETA CON BOLETA ELECTRÓNICA SUNAT (BVE)
  static async createSale({ user_id = 1, customer_id = null, document_type = '03', items = [], amount_paid, payment_method = 'EFECTIVO', due_days = 15 }) {
    if (!items || items.length === 0) {
      throw new Error('La venta debe contener al menos un producto.');
    }

    let subtotalSinIgv = 0;
    let totalIgv = 0;
    let total_amount = 0;

    for (const item of items) {
      const qty = parseFloat(item.quantity);
      const itemTotal = parseFloat(item.sale_price) * qty;
      total_amount += itemTotal;
    }

    // Cálculo de IGV (18% SUNAT Perú)
    subtotalSinIgv = total_amount / 1.18;
    totalIgv = total_amount - subtotalSinIgv;

    // VALIDACIONES PARA FIADOS (VENTAS A CRÉDITO)
    const isFiado = payment_method === 'FIADO';
    let customer = null;

    if (isFiado) {
      if (!customer_id) {
        throw new Error('Debe seleccionar un cliente obligatorio para registrar una venta FIADA.');
      }
      customer = await CustomerModel.getById(customer_id);
      if (!customer) {
        throw new Error('Cliente no encontrado en la base de datos.');
      }

      const projectedDebt = parseFloat(customer.current_debt) + total_amount;
      if (projectedDebt > parseFloat(customer.credit_limit)) {
        throw new Error(`Exceso de Límite de Crédito: El cliente ${customer.name} tiene un límite de S/.${customer.credit_limit} y una deuda actual de S/.${customer.current_debt}. Esta venta superaría su límite permitido.`);
      }
    } else if (customer_id) {
      customer = await CustomerModel.getById(customer_id);
    }

    const paidAmount = isFiado ? 0.00 : parseFloat(amount_paid || total_amount);
    const change_due = isFiado ? 0.00 : Math.max(0, paidAmount - total_amount);

    if (!isFiado && paidAmount < total_amount) {
      throw new Error(`Monto pagado (S/.${paidAmount}) es menor al total (S/.${total_amount}).`);
    }

    // Obtener Serie y Correlativo Electrónico SUNAT
    const company = await SunatService.getCompanyConfig();
    const { series, correlative, formattedInvoiceNumber } = await SunatService.getNextSeriesAndCorrelative(document_type);

    const is_paid = isFiado ? 0 : 1;
    const dueDateObj = new Date();
    dueDateObj.setDate(dueDateObj.getDate() + due_days);
    const due_date = isFiado ? dueDateObj.toISOString().split('T')[0] : null;

    // Generar Hash y QR SUNAT
    const hashDummy = Math.random().toString(36).substring(2, 12) + Math.random().toString(36).substring(2, 8);
    const qrData = SunatService.generateSunatQrData(
      company,
      { document_type, series, correlative_number: correlative, igv: totalIgv, total_amount },
      customer ? customer.document_type || '1' : '0',
      customer ? customer.document_number || '00000000' : '00000000',
      hashDummy
    );

    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        const insertSaleSql = `
          INSERT INTO sales (invoice_number, document_type, series, correlative_number, user_id, customer_id, subtotal, igv, total_amount, amount_paid, change_due, payment_method, is_paid, due_date, sunat_status, sunat_hash, qr_code_data)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDIENTE', ?, ?)
        `;

        db.run(insertSaleSql, [
          formattedInvoiceNumber,
          document_type,
          series,
          correlative,
          user_id,
          customer_id,
          subtotalSinIgv,
          totalIgv,
          total_amount,
          paidAmount,
          change_due,
          payment_method,
          is_paid,
          due_date,
          hashDummy,
          qrData
        ], function (err) {
          if (err) {
            db.run('ROLLBACK', () => {});
            return reject(err);
          }

          const saleId = this.lastID;
          const insertDetailSql = `
            INSERT INTO sale_details (sale_id, product_id, product_name, barcode, unit_price, quantity, unit_measure, igv, subtotal)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;
          const updateStockSql = `UPDATE products SET stock = stock - ? WHERE sku = ? OR barcode = ?`;

          let completedItems = 0;
          for (const item of items) {
            const qty = parseFloat(item.quantity);
            const itemSubtotal = parseFloat(item.sale_price) * qty;
            const itemIgv = itemSubtotal - (itemSubtotal / 1.18);
            const unitMeasure = item.unit_measure || (item.is_bulk ? 'KG' : 'UNIDAD');
            const itemSku = item.sku || item.product_id || item.id || item.barcode;
            const itemBarcode = item.barcode || itemSku;

            db.run(insertDetailSql, [saleId, itemSku, item.name, itemBarcode, item.sale_price, qty, unitMeasure, itemIgv, itemSubtotal], (err2) => {
              if (err2) {
                db.run('ROLLBACK', () => {});
                return reject(err2);
              }

              db.run(updateStockSql, [qty, itemSku, itemBarcode], (err3) => {
                if (err3) {
                  db.run('ROLLBACK', () => {});
                  return reject(err3);
                }

                completedItems++;
                if (completedItems === items.length) {
                  if (isFiado) {
                    const updateDebtSql = `UPDATE customers SET current_debt = current_debt + ? WHERE id = ?`;
                    db.run(updateDebtSql, [total_amount, customer_id], (err4) => {
                      if (err4) {
                        db.run('ROLLBACK', () => {});
                        return reject(err4);
                      }
                      db.run('COMMIT', (commitErr) => {
                        if (commitErr) return reject(commitErr);
                        resolve({
                          id: saleId,
                          saleId,
                          invoice_number: formattedInvoiceNumber,
                          document_type,
                          total_amount,
                          amount_paid: paidAmount,
                          change_due,
                          payment_method,
                          sunat_status: 'PENDIENTE',
                          customer_name: customer ? customer.name : null
                        });
                      });
                    });
                  } else {
                    db.run('COMMIT', (commitErr) => {
                      if (commitErr) return reject(commitErr);
                      resolve({
                        id: saleId,
                        saleId,
                        invoice_number: formattedInvoiceNumber,
                        document_type,
                        total_amount,
                        amount_paid: paidAmount,
                        change_due,
                        payment_method,
                        sunat_status: 'PENDIENTE'
                      });
                    });
                  }
                }
              });
            });
          }
        });
      });
    });
  }

  static async getById(saleId) {
    const sale = await get(`
      SELECT s.*, u.full_name as cashier_name, c.name as customer_name, c.document_number as customer_doc_number, c.current_debt as customer_total_debt
      FROM sales s
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN customers c ON s.customer_id = c.id
      WHERE s.id = ?
    `, [saleId]);

    if (!sale) return null;

    const details = await query(`
      SELECT * FROM sale_details WHERE sale_id = ?
    `, [saleId]);

    return { ...sale, details };
  }

  static async getAll({ limit = 50 } = {}) {
    const sql = `
      SELECT s.*, u.full_name as cashier_name, c.name as customer_name
      FROM sales s
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN customers c ON s.customer_id = c.id
      ORDER BY s.created_at DESC
      LIMIT ?
    `;
    return await query(sql, [limit]);
  }

  static async cancelSale(saleId) {
    const sale = await this.getById(saleId);
    if (!sale) throw new Error('Venta no encontrada');
    if (sale.sunat_status === 'ANULADO') throw new Error('La venta ya se encuentra anulada');

    // 1. Marcar venta como ANULADO
    await run(`UPDATE sales SET sunat_status = 'ANULADO', is_paid = 0 WHERE id = ?`, [saleId]);

    // 2. Revertir stock de cada producto en la venta
    if (sale.details && sale.details.length > 0) {
      for (const item of sale.details) {
        const qty = parseFloat(item.quantity || 0);
        const itemKey = item.product_id || item.barcode;
        if (qty > 0 && itemKey) {
          await run(`UPDATE products SET stock = stock + ? WHERE sku = ? OR barcode = ?`, [qty, itemKey, itemKey]);
        }
      }
    }

    // 3. Si la venta fue fiada, reducir la deuda del cliente
    if (sale.payment_method === 'FIADO' && sale.customer_id) {
      await run(`UPDATE customers SET current_debt = MAX(0, current_debt - ?) WHERE id = ?`, [sale.total_amount, sale.customer_id]);
    }

    return true;
  }
}

module.exports = SaleModel;
