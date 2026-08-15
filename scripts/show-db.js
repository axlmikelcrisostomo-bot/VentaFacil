const { query, db } = require('../config/database');

async function showDB() {
  try {
    console.log('=====================================================');
    console.log('         🗄️ BASE DE DATOS LOCAL (ventafacil.db)        ');
    console.log('=====================================================\n');

    // 1. Obtener todas las tablas
    const tables = await query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
    console.log('📊 RESUMEN DE TODAS LAS TABLAS DEL SISTEMA:');
    for (const t of tables) {
      const count = await query(`SELECT COUNT(*) as total FROM ${t.name}`);
      console.log(`   • ${t.name.padEnd(20)} : ${count[0].total} registros`);
    }

    console.log('\n-----------------------------------------------------');
    console.log('📦 PRODUCTOS CON BARCODE / SKU COMO PRIMARY KEY (Primeros 15):');
    const products = await query(`
      SELECT 
        p.barcode as pk_codigo_barras, 
        p.name as producto, 
        b.name as marca,
        c.name as categoria, 
        'S/. ' || PRINTF('%.2f', p.sale_price) as precio_venta, 
        p.stock
      FROM products p 
      LEFT JOIN categories c ON p.category_id = c.id 
      LEFT JOIN brands b ON p.brand_id = b.id
      ORDER BY p.name ASC 
      LIMIT 15
    `);
    console.table(products);

  } catch (err) {
    console.error('Error al consultar la base de datos:', err);
  } finally {
    db.close();
  }
}

showDB();
