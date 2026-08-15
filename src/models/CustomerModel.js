const { query, get, run } = require('../../config/database');

class CustomerModel {
  static async getAll() {
    const sql = `SELECT * FROM customers ORDER BY name ASC`;
    return await query(sql);
  }

  static async getById(id) {
    const sql = `SELECT * FROM customers WHERE id = ?`;
    return await get(sql, [id]);
  }

  static async create({ name, document_number, phone, email, credit_limit }) {
    const sql = `
      INSERT INTO customers (name, document_number, phone, email, credit_limit, current_debt)
      VALUES (?, ?, ?, ?, ?, 0.00)
    `;
    return await run(sql, [
      name.trim(),
      document_number ? document_number.trim() : null,
      phone ? phone.trim() : '',
      email ? email.trim() : '',
      parseFloat(credit_limit || 500.00)
    ]);
  }

  static async update(id, { name, document_number, phone, email, credit_limit }) {
    const sql = `
      UPDATE customers 
      SET name = ?, document_number = ?, phone = ?, email = ?, credit_limit = ?
      WHERE id = ?
    `;
    return await run(sql, [
      name.trim(),
      document_number ? document_number.trim() : null,
      phone || '',
      email || '',
      parseFloat(credit_limit || 500.00),
      id
    ]);
  }

  static async delete(id) {
    const sql = `DELETE FROM customers WHERE id = ?`;
    return await run(sql, [id]);
  }

  // REGISTRAR UN ABONO / PAGO A LA DEUDA FIADA DEL CLIENTE
  static async registerPayment({ customer_id, amount_paid, payment_method = 'EFECTIVO', notes = '' }) {
    const customer = await this.getById(customer_id);
    if (!customer) {
      throw new Error('Cliente no encontrado');
    }

    const amount = parseFloat(amount_paid);
    if (amount <= 0) {
      throw new Error('El monto del abono debe ser mayor a 0');
    }

    // Registrar abono en credit_payments
    const sqlPayment = `
      INSERT INTO credit_payments (customer_id, amount_paid, payment_method, notes)
      VALUES (?, ?, ?, ?)
    `;
    const result = await run(sqlPayment, [customer_id, amount, payment_method, notes]);

    // Reducir la deuda actual del cliente
    const newDebt = Math.max(0, parseFloat(customer.current_debt) - amount);
    await run(`UPDATE customers SET current_debt = ? WHERE id = ?`, [newDebt, customer_id]);

    return {
      payment_id: result.lastID,
      previous_debt: customer.current_debt,
      amount_paid: amount,
      new_debt: newDebt
    };
  }

  // Obtener historial de fiados y abonos de un cliente
  static async getCreditHistory(customer_id) {
    const sales = await query(`
      SELECT * FROM sales WHERE customer_id = ? AND payment_method = 'FIADO' ORDER BY created_at DESC
    `, [customer_id]);

    const payments = await query(`
      SELECT * FROM credit_payments WHERE customer_id = ? ORDER BY created_at DESC
    `, [customer_id]);

    return { sales, payments };
  }
}

module.exports = CustomerModel;
