const { run, query, get, db } = require('../config/database');
const fs = require('fs');
const path = require('path');

function parseMoney(val) {
  if (!val) return 0;
  let cleaned = String(val).replace(/S\/\.?/gi, '').replace(/\s+/g, '').replace(',', '.');
  let num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function parseStock(val) {
  if (!val) return 0;
  let num = parseFloat(String(val).replace(',', '.'));
  return isNaN(num) ? 0 : num;
}

function parseCSV(content) {
  const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length === 0) return [];

  let headerIndex = lines.findIndex(line => {
    const l = line.toLowerCase();
    return l.includes('codigo') || l.includes('barcode') || l.includes('producto') || l.includes('name');
  });

  if (headerIndex === -1) headerIndex = 0;

  const headerLine = lines[headerIndex];
  const delimiter = headerLine.includes(';') ? ';' : ',';

  const headers = headerLine.split(delimiter).map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
  const rows = [];

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const rawCells = lines[i].split(delimiter);
    if (rawCells.length < Math.min(2, headers.length)) continue;

    const row = {};
    headers.forEach((header, index) => {
      let val = rawCells[index] ? rawCells[index].trim() : '';
      val = val.replace(/^"|"$/g, '');
      row[header] = val;
    });
    rows.push(row);
  }

  return rows;
}

async function addColumnsIfNotExist() {
  const columnsToAdd = [
    "ALTER TABLE products ADD COLUMN brand TEXT",
    "ALTER TABLE products ADD COLUMN expiration_date TEXT",
    "ALTER TABLE products ADD COLUMN status TEXT DEFAULT 'DISPONIBLE'"
  ];

  for (const sql of columnsToAdd) {
    try {
      await run(sql);
    } catch (err) {
      // Ignorar si la columna ya existe
    }
  }
}

async function cleanAndSync() {
  try {
    console.log('🧼 Limpiando datos ficticios de prueba y adaptando esquema local...');
    await addColumnsIfNotExist();

    // 1. Eliminar productos demo (Pollo, Carne, Queso, etc.)
    await run("DELETE FROM products WHERE barcode LIKE '7750999%' OR barcode LIKE '7750123%' OR barcode LIKE '7750987%' OR barcode LIKE '7750111%' OR barcode LIKE '7750444%'");
    await run("DELETE FROM categories WHERE name IN ('Carnes y Pollo Crudo', 'Bebidas y Gaseosas', 'Abarrotes', 'Lácteos', 'Bebidas')");

    // 2. Leer archivo importado de Google Sheets
    let csvContent = '';

    const stepFiles = [
      'C:\\Users\\USUARIO\\.gemini\\antigravity-ide\\brain\\8c87e575-1b12-4fc5-b4f1-ae550c107c00\\.system_generated\\steps\\96\\content.md',
      'C:\\Users\\USUARIO\\.gemini\\antigravity-ide\\brain\\8c87e575-1b12-4fc5-b4f1-ae550c107c00\\.system_generated\\steps\\88\\content.md',
      'C:\\Users\\USUARIO\\.gemini\\antigravity-ide\\brain\\8c87e575-1b12-4fc5-b4f1-ae550c107c00\\.system_generated\\steps\\65\\content.md'
    ];

    for (const f of stepFiles) {
      if (fs.existsSync(f)) {
        csvContent = fs.readFileSync(f, 'utf8');
        break;
      }
    }

    if (!csvContent) {
      console.error('❌ No se encontró el archivo del Google Sheet');
      return;
    }

    const records = parseCSV(csvContent);
    console.log(`📦 Sincronizando ${records.length} productos reales del Sheets...`);

    let importedCount = 0;
    let updatedCount = 0;
    let categoryCount = 0;

    for (const record of records) {
      const barcode = record.id_codigo || record.barcode || record.codigo;
      const name = record.nombre_producto || record.name || record.producto;
      const brand = record.marca_producto || record.marca || '';
      const categoryName = record.tipo_producto || record.categoria || 'General';
      const purchasePrice = parseMoney(record.precio_compra || record.precio_costo || 0);
      const salePrice = parseMoney(record.precio_venta || record.precio_unitario || 0);
      const stock = parseStock(record.stock || 0);
      const expirationDate = record.fecha_vencimiento || record.vencimiento || null;
      const status = record.estado || 'DISPONIBLE';

      if (!name) continue;

      // Categoría
      let categoryId = null;
      if (categoryName) {
        let cat = await get('SELECT id FROM categories WHERE LOWER(name) = LOWER(?)', [categoryName]);
        if (!cat) {
          const res = await run('INSERT INTO categories (name, description) VALUES (?, ?)', [categoryName, 'Categoría Real']);
          categoryId = res.lastID;
          categoryCount++;
        } else {
          categoryId = cat.id;
        }
      }

      const finalBarcode = barcode && barcode.trim() !== '' ? barcode.trim() : 'INT-' + Math.floor(10000000 + Math.random() * 90000000);

      const existing = await get('SELECT id FROM products WHERE barcode = ?', [finalBarcode]);
      if (existing) {
        await run(`
          UPDATE products 
          SET name = ?, brand = ?, category_id = ?, purchase_price = ?, sale_price = ?, stock = ?, expiration_date = ?, status = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [name, brand, categoryId, purchasePrice, salePrice, stock, expirationDate, status, existing.id]);
        updatedCount++;
      } else {
        await run(`
          INSERT INTO products (barcode, name, brand, category_id, purchase_price, sale_price, stock, expiration_date, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [finalBarcode, name, brand, categoryId, purchasePrice, salePrice, stock, expirationDate, status]);
        importedCount++;
      }
    }

    console.log('\n====================================================');
    console.log(`✅ BASE DE DATOS LOCAL ADAPTADA Y LIMPIA AL 100%:`);
    console.log(`   🏷️ Categorías reales registradas: ${categoryCount}`);
    console.log(`   ✨ Productos reales insertados: ${importedCount}`);
    console.log(`   🔄 Productos actualizados: ${updatedCount}`);
    console.log('====================================================\n');

  } catch (err) {
    console.error('Error:', err);
  } finally {
    db.close();
  }
}

cleanAndSync();
