const { run, get, db } = require('../config/database');

async function seedBulkProducts() {
  try {
    console.log('🌱 Registrando productos a granel / balanza para pruebas...');

    // Asegurar categoría Granel
    let cat = await get("SELECT id FROM categories WHERE name = 'GRANEL / BALANZA'");
    let catId = null;
    if (!cat) {
      const r = await run("INSERT INTO categories (name, description) VALUES (?, ?)", ['GRANEL / BALANZA', 'Carnes, verduras y embutidos por peso']);
      catId = r.lastID;
    } else {
      catId = cat.id;
    }

    const bulkProducts = [
      { barcode: 'GRANEL-001', name: 'POLLO ENTERO FRESCO', purchase: 6.80, sale: 9.20, stock: 45.500 },
      { barcode: 'GRANEL-002', name: 'PECHUGA DE POLLO ESPECIAL', purchase: 11.50, sale: 14.50, stock: 25.000 },
      { barcode: 'GRANEL-003', name: 'PAPA AMARILLA SELECCIONADA', purchase: 2.20, sale: 3.50, stock: 60.000 },
      { barcode: 'GRANEL-004', name: 'PAPA CANCHAN', purchase: 1.40, sale: 2.20, stock: 80.000 },
      { barcode: 'GRANEL-005', name: 'CEBOLLA ROJA', purchase: 1.80, sale: 2.80, stock: 35.000 },
      { barcode: 'GRANEL-006', name: 'TOMATE ITALIANO', purchase: 2.00, sale: 3.00, stock: 30.000 },
      { barcode: 'GRANEL-007', name: 'QUESO FRESCO DE CAJAMARCA', purchase: 13.50, sale: 18.00, stock: 15.250 },
      { barcode: 'GRANEL-008', name: 'JAMONADA ESPECIAL SAN FERNANDO', purchase: 12.00, sale: 16.00, stock: 12.000 },
      { barcode: 'GRANEL-009', name: 'HUEVOS A GRANEL (KG)', purchase: 5.80, sale: 7.50, stock: 40.000 },
      { barcode: 'GRANEL-010', name: 'MANDARINA SIN PEPA', purchase: 3.00, sale: 4.50, stock: 25.000 }
    ];

    for (const p of bulkProducts) {
      const existing = await get("SELECT barcode FROM products WHERE barcode = ?", [p.barcode]);
      if (!existing) {
        await run(`
          INSERT INTO products (barcode, name, category_id, purchase_price, sale_price, stock, min_stock, unit_measure, is_bulk, is_active)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1)
        `, [p.barcode, p.name, catId, p.purchase, p.sale, p.stock, 5.000, 'KG']);
        console.log(`  ➕ Producto a granel agregado: ${p.name} (S/. ${p.sale}/Kg)`);
      }
    }

    console.log('✅ 10 productos a granel registrados exitosamente para pruebas.');
    db.close();
  } catch (err) {
    console.error('❌ Error:', err);
  }
}

seedBulkProducts();
