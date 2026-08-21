const ProductModel = require('../models/ProductModel');
const ScannerService = require('../services/ScannerService');
const https = require('https');
const http = require('http');
const { run, get } = require('../../config/database');

function parseMoney(val) {
  if (!val) return 0;
  let cleaned = String(val).replace(/S\/\.?/gi, '').replace(/\s+/g, '').replace(',', '.');
  let num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function parseStock(val) {
  if (!val) return 0;
  let cleaned = String(val).replace(/\s+/g, '').replace(',', '.');
  let num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function parseDate(val) {
  if (!val || typeof val !== 'string') return null;
  val = val.trim();
  if (!val) return null;

  // DD/MM/YYYY o DD-MM-YYYY
  const dmyMatch = val.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    const time = dmyMatch[4] ? ` ${dmyMatch[4].padStart(2, '0')}:${dmyMatch[5]}:${dmyMatch[6] || '00'}` : '';
    return `${year}-${month}-${day}${time}`;
  }

  // YYYY-MM-DD
  const ymdMatch = val.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, '0');
    const day = ymdMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return val;
}

function splitCSVLine(line, delimiter = ',') {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim().replace(/^"|"$/g, ''));
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim().replace(/^"|"$/g, ''));
  return result;
}

function parseCSV(content) {
  const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length === 0) return [];

  let headerIndex = lines.findIndex(line => {
    const l = line.toLowerCase();
    return l.includes('sku') || l.includes('codigo') || l.includes('barcode') || l.includes('producto') || l.includes('name') || l.includes('descripcion');
  });

  if (headerIndex === -1) headerIndex = 0;

  const headerLine = lines[headerIndex];
  const delimiter = headerLine.includes('\t') ? '\t' : (headerLine.includes(';') ? ';' : ',');

  const headers = splitCSVLine(headerLine, delimiter).map(h => h.toLowerCase().trim());
  const rows = [];

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const rawCells = splitCSVLine(lines[i], delimiter);
    if (rawCells.length < Math.min(2, headers.length)) continue;

    const row = {};
    headers.forEach((header, index) => {
      let val = rawCells[index] !== undefined ? rawCells[index].trim() : '';
      row[header] = val;
    });
    rows.push(row);
  }

  return rows;
}

async function getNextReservedSKU() {
  const lastSKUProduct = await get("SELECT sku FROM products WHERE sku LIKE 'SKU-%' ORDER BY sku DESC LIMIT 1");
  let lastNum = 0;
  if (lastSKUProduct && lastSKUProduct.sku) {
    const match = lastSKUProduct.sku.match(/SKU-(\d+)/);
    if (match) {
      lastNum = parseInt(match[1], 10);
    }
  }
  const nextNum = lastNum + 1;
  return `SKU-${String(nextNum).padStart(6, '0')}`;
}

function fetchWebCSV(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchWebCSV(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Error al acceder al enlace (HTTP ${res.statusCode})`));
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function processRecordsArray(records) {
  let importedCount = 0;
  let updatedCount = 0;
  let categoryCount = 0;
  let brandCount = 0;

  for (const record of records) {
    const rawSku = record.sku || record.id_sku || record.codigo_sku || record.pk_sku;
    const rawBarcode = record.barcode || record.codigo_barras || record.id_codigo || record.codigo_barra || record.codigo || record.ean || record.upc;
    const name = record.descripcion_producto || record.nombre_producto || record.name || record.nombre || record.producto;
    const brandName = record.marca_producto || record.marca || record.brand || '';
    const categoryName = record.categoria || record.tipo_producto || record.category_name || record.category || 'General';

    const purchasePrice = parseMoney(record.precio_compra || record.precio_costo || record.costo || record.compra || record.purchase_price || 0);
    const salePrice = parseMoney(record.precio_venta || record.precio_unitario || record.sale_price || record.precio || 0);
    const stock = parseStock(record.stock || record.cantidad || 0);
    const minStock = parseFloat(record.min_stock || record.stock_minimo || 5) || 5;
    const unitMeasure = record.unidad_medida || record.unit_measure || record.unidad || record.tipo_unidad || 'UNIDAD';
    const expirationDate = parseDate(record.fecha_vencimiento || record.vencimiento);
    const registrationDate = parseDate(record.fecha_registro || record.registro || record.fecha);
    const status = record.estado || record.status || 'DISPONIBLE';

    if (!name) continue;

    // 1. Categoría
    let categoryId = null;
    if (categoryName) {
      let cat = await get('SELECT id FROM categories WHERE LOWER(name) = LOWER(?)', [categoryName.trim()]);
      if (!cat) {
        const res = await run('INSERT INTO categories (name, description) VALUES (?, ?)', [categoryName.trim(), 'Categoría Importada']);
        categoryId = res.lastID;
        categoryCount++;
      } else {
        categoryId = cat.id;
      }
    }

    // 2. Marca (brand_id)
    let brandId = null;
    if (brandName) {
      let brandObj = await get('SELECT id FROM brands WHERE LOWER(name) = LOWER(?)', [brandName.trim()]);
      if (!brandObj) {
        const res = await run('INSERT INTO brands (name, description) VALUES (?, ?)', [brandName.trim(), 'Marca Importada']);
        brandId = res.lastID;
        brandCount++;
      } else {
        brandId = brandObj.id;
      }
    }

    // 3. Resolución de SKU (Primary Key) y Barcode
    let finalSku = rawSku ? rawSku.trim() : '';
    let finalBarcode = rawBarcode ? rawBarcode.trim() : '';

    if (!finalSku) {
      if (finalBarcode && finalBarcode.startsWith('SKU-')) {
        finalSku = finalBarcode;
        finalBarcode = '';
      } else if (finalBarcode) {
        // Tenemos código de barras pero no SKU: buscar si ya existe un producto con este barcode
        const existByBarcode = await get('SELECT sku FROM products WHERE barcode = ?', [finalBarcode]);
        if (existByBarcode) {
          finalSku = existByBarcode.sku;
        } else {
          finalSku = await getNextReservedSKU();
        }
      } else {
        finalSku = await getNextReservedSKU();
      }
    }

    // 4. Upsert en products con fecha de registro
    const existingProduct = await get('SELECT sku FROM products WHERE sku = ? OR (barcode IS NOT NULL AND barcode = ?)', [finalSku, finalBarcode]);

    if (existingProduct) {
      const updateDate = registrationDate || new Date().toISOString().replace('T', ' ').substring(0, 19);
      await run(`
        UPDATE products 
        SET name = ?, barcode = ?, brand_id = ?, category_id = ?, purchase_price = ?, sale_price = ?, stock = ?, min_stock = ?, expiration_date = ?, status = ?, unit_measure = ?, updated_at = ?
        WHERE sku = ?
      `, [name.trim(), finalBarcode || null, brandId, categoryId, purchasePrice, salePrice, stock, minStock, expirationDate, status, unitMeasure, updateDate, existingProduct.sku]);
      updatedCount++;
    } else {
      const createDate = registrationDate || new Date().toISOString().replace('T', ' ').substring(0, 19);
      await run(`
        INSERT INTO products (sku, barcode, name, brand_id, category_id, purchase_price, sale_price, stock, min_stock, expiration_date, status, unit_measure, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [finalSku, finalBarcode || null, name.trim(), brandId, categoryId, purchasePrice, salePrice, stock, minStock, expirationDate, status, unitMeasure, createDate, createDate]);
      importedCount++;
    }
  }

  return { importedCount, updatedCount, categoryCount, brandCount, totalProcessed: records.length };
}

class ProductController {
  static async getAll(req, res) {
    try {
      const { search, categoryId, brandId } = req.query;
      const products = await ProductModel.getAll({ search, categoryId, brandId });
      res.json({ success: true, data: products });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  static async getByBarcode(req, res) {
    try {
      const barcode = ScannerService.cleanBarcode(req.params.barcode);
      if (!ScannerService.isValidBarcode(barcode)) {
        return res.status(400).json({ success: false, error: 'Código o SKU inválido' });
      }

      const product = await ProductModel.getByBarcode(barcode);
      if (!product) {
        return res.status(404).json({ success: false, message: `Producto no encontrado para el código/SKU: ${barcode}` });
      }

      res.json({ success: true, data: product });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  static async getById(req, res) {
    try {
      const product = await ProductModel.getById(req.params.id);
      if (!product) {
        return res.status(404).json({ success: false, message: `Producto no encontrado con identificador ${req.params.id}` });
      }
      res.json({ success: true, data: product });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  static async create(req, res) {
    try {
      const result = await ProductModel.create(req.body);
      res.status(201).json({ success: true, message: 'Producto creado exitosamente', sku: result.sku, barcode: result.barcode });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  static async update(req, res) {
    try {
      await ProductModel.update(req.params.id, req.body);
      res.json({ success: true, message: 'Producto actualizado exitosamente' });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  static async delete(req, res) {
    try {
      await ProductModel.delete(req.params.id);
      res.json({ success: true, message: 'Producto eliminado exitosamente' });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  // Importar CSV enviado por texto/archivo o por URL
  static async importCSV(req, res) {
    try {
      const { csvText, sheetsUrl } = req.body;
      let rawText = csvText || '';

      if (sheetsUrl && sheetsUrl.trim() !== '') {
        rawText = await fetchWebCSV(sheetsUrl.trim());
      }

      if (!rawText || rawText.trim() === '') {
        return res.status(400).json({ success: false, error: 'No se recibieron datos CSV para procesar.' });
      }

      const records = parseCSV(rawText);
      if (records.length === 0) {
        return res.status(400).json({ success: false, error: 'El archivo CSV está vacío o el formato de encabezado no es válido.' });
      }

      const stats = await processRecordsArray(records);
      res.json({
        success: true,
        message: 'Importación realizada con éxito',
        stats
      });
    } catch (err) {
      console.error('Error al importar CSV:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  }

  // Limpiar/Resetear todo el catálogo de productos (Empezar desde 0)
  static async clearCatalog(req, res) {
    try {
      await ProductModel.clearAll();
      res.json({
        success: true,
        message: 'Catálogo de productos reiniciado exitosamente a cero.'
      });
    } catch (err) {
      console.error('Error al limpiar catálogo:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  }
}

module.exports = ProductController;
