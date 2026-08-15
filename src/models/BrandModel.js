const { query, get, run } = require('../../config/database');

class BrandModel {
  // 1. Obtener todas las marcas
  static async getAll() {
    const sql = `SELECT * FROM brands ORDER BY name ASC`;
    return await query(sql);
  }

  // 2. Obtener marca por ID
  static async getById(id) {
    const sql = `SELECT * FROM brands WHERE id = ?`;
    return await get(sql, [id]);
  }

  // 3. Crear marca
  static async create({ name, description }) {
    const sql = `INSERT INTO brands (name, description) VALUES (?, ?)`;
    return await run(sql, [name, description || '']);
  }

  // 4. Actualizar marca
  static async update(id, { name, description }) {
    const sql = `UPDATE brands SET name = ?, description = ? WHERE id = ?`;
    return await run(sql, [name, description, id]);
  }

  // 5. Eliminar marca
  static async delete(id) {
    const sql = `DELETE FROM brands WHERE id = ?`;
    return await run(sql, [id]);
  }
}

module.exports = BrandModel;
