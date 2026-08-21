const { query, run, get } = require('../config/database');

async function seed() {
  console.log('🌱 Verificando y poblando datos de configuración en el sistema...');

  try {
    // 1. Configuración de Empresa (company_config)
    const existingCompany = await get('SELECT id FROM company_config LIMIT 1');
    if (!existingCompany) {
      await run(`
        INSERT INTO company_config (ruc, razon_social, nombre_comercial, direccion, ubigeo, departamento, provincia, distrito, is_production)
        VALUES ('20601234567', 'COMERCIAL BELEZA & HOGAR S.A.C.', 'VentaFácil MiniMarket', 'Av. Las Flores 456, San Juan de Lurigancho', '150132', 'LIMA', 'LIMA', 'SAN JUAN DE LURIGANCHO', 0)
      `);
      console.log('  🏢 Configuración de empresa registrada.');
    }

    // 2. Usuarios del sistema (users)
    const existingUsers = await get('SELECT id FROM users LIMIT 1');
    if (!existingUsers) {
      await run(`
        INSERT INTO users (username, password_hash, full_name, role)
        VALUES ('admin', 'admin123', 'Administrador Principal', 'ADMIN')
      `);
      await run(`
        INSERT INTO users (username, password_hash, full_name, role)
        VALUES ('cajero1', 'cajero123', 'Lucía Mendoza (Cajera)', 'CASHIER')
      `);
      console.log('  👤 Usuarios (ADMIN y CASHIER) creados.');
    }

    const adminUser = await get("SELECT id FROM users WHERE username = 'admin'");

    // 3. Clientes para FIADOS y Facturación (customers)
    const existingCustomers = await get('SELECT COUNT(*) as total FROM customers');
    if (existingCustomers.total <= 2) {
      await run(`
        INSERT INTO customers (document_type, document_number, name, phone, email, credit_limit, current_debt)
        VALUES ('1', '45892019', 'Carlos Gutiérrez (Cliente Frecuente)', '987123456', 'carlos@gmail.com', 200.00, 15.50)
      `);
      await run(`
        INSERT INTO customers (document_type, document_number, name, phone, email, credit_limit, current_debt)
        VALUES ('1', '71293840', 'María Elena Torres (Fiado Vecina)', '912345678', 'maria.torres@gmail.com', 150.00, 28.00)
      `);
      await run(`
        INSERT INTO customers (document_type, document_number, name, phone, email, credit_limit, current_debt)
        VALUES ('6', '20554433221', 'BOTICA Y SALUD S.A.C. (Factura)', '014253647', 'contacto@boticaysalud.pe', 1000.00, 0.00)
      `);
      console.log('  👥 Clientes y cuentas de fiados registrados.');
    }

    const customer1 = await get("SELECT id FROM customers WHERE document_number = '45892019'");
    const customer2 = await get("SELECT id FROM customers WHERE document_number = '71293840'");

    // 4. Productos reales en DB
    const products = await query('SELECT sku, barcode, name, purchase_price, sale_price, stock FROM products LIMIT 10');

    if (products.length > 0) {
      // 5. Historial de Kárdex / Movimientos de Stock (stock_movements)
      const existingMovements = await get('SELECT id FROM stock_movements LIMIT 1');
      if (!existingMovements) {
        for (const p of products.slice(0, 5)) {
          await run(`
            INSERT INTO stock_movements (product_id, movement_type, quantity, previous_stock, new_stock, notes)
            VALUES (?, 'ENTRADA_COMPRA', 50, 0, 50, 'Ingreso por compra inicial de mercadería')
          `, [p.sku]);
        }
        console.log('  📦 Movimientos de Kárdex creados.');
      }

      // 6. Ventas de Ejemplo (sales & sale_details)
      const existingSales = await get('SELECT id FROM sales LIMIT 1');
      if (!existingSales) {
        // Venta 1: Boleta Pagada en Efectivo
        const p1 = products[0]; // Ego Sachet
        const p2 = products[1]; // Jhonsons Verde
        const subtotal1 = (p1.sale_price * 2) + (p2.sale_price * 3);
        const igv1 = Number((subtotal1 * 0.18).toFixed(2));
        const total1 = Number((subtotal1 + igv1).toFixed(2));

        const sale1 = await run(`
          INSERT INTO sales (invoice_number, document_type, series, correlative_number, user_id, customer_id, subtotal, igv, total_amount, amount_paid, change_due, payment_method, is_paid, sunat_status)
          VALUES ('B001-00000001', '03', 'B001', 1, ?, ?, ?, ?, ?, ?, 0.00, 'EFECTIVO', 1, 'ACEPTADO')
        `, [adminUser ? adminUser.id : 1, customer1 ? customer1.id : null, subtotal1, igv1, total1, total1]);

        await run(`
          INSERT INTO sale_details (sale_id, product_id, product_name, barcode, unit_price, quantity, unit_measure, igv, subtotal)
          VALUES (?, ?, ?, ?, ?, 2, 'UNIDAD', ?, ?)
        `, [sale1.lastID, p1.sku, p1.name, p1.barcode || p1.sku, p1.sale_price, (p1.sale_price * 2 * 0.18), (p1.sale_price * 2)]);

        await run(`
          INSERT INTO sale_details (sale_id, product_id, product_name, barcode, unit_price, quantity, unit_measure, igv, subtotal)
          VALUES (?, ?, ?, ?, ?, 3, 'UNIDAD', ?, ?)
        `, [sale1.lastID, p2.sku, p2.name, p2.barcode || p2.sku, p2.sale_price, (p2.sale_price * 3 * 0.18), (p2.sale_price * 3)]);

        // Venta 2: Venta a Crédito / Fiado
        const p3 = products[2] || p1;
        const subtotal2 = p3.sale_price * 5;
        const igv2 = Number((subtotal2 * 0.18).toFixed(2));
        const total2 = Number((subtotal2 + igv2).toFixed(2));

        const sale2 = await run(`
          INSERT INTO sales (invoice_number, document_type, series, correlative_number, user_id, customer_id, subtotal, igv, total_amount, amount_paid, change_due, payment_method, is_paid, sunat_status)
          VALUES ('B001-00000002', '03', 'B001', 2, ?, ?, ?, ?, ?, 0.00, 0.00, 'FIADO', 0, 'PENDIENTE')
        `, [adminUser ? adminUser.id : 1, customer2 ? customer2.id : null, subtotal2, igv2, total2]);

        await run(`
          INSERT INTO sale_details (sale_id, product_id, product_name, barcode, unit_price, quantity, unit_measure, igv, subtotal)
          VALUES (?, ?, ?, ?, ?, 5, 'UNIDAD', ?, ?)
        `, [sale2.lastID, p3.sku, p3.name, p3.barcode || p3.sku, p3.sale_price, igv2, subtotal2]);

        console.log('  🛒 Ventas de prueba (Boletas y Fiados) registradas.');
      }

      // 7. Abono de Deuda de Ejemplo (credit_payments)
      const existingPayments = await get('SELECT id FROM credit_payments LIMIT 1');
      if (!existingPayments && customer2) {
        await run(`
          INSERT INTO credit_payments (customer_id, amount_paid, payment_method, notes)
          VALUES (?, 12.00, 'EFECTIVO', 'Pago parcial de fiado semanal')
        `, [customer2.id]);
        console.log('  💵 Abono de fiado registrado.');
      }
    }

    console.log('✅ Verificación de datos completada.');
  } catch (err) {
    console.error('❌ Error al poblar datos:', err);
  }
}

module.exports = { seed };
