/**
 * VentaFácil POS - App Controller Principal
 * Maneja: POS, Inventario, Fiados, Clientes, Categorías, Historial, SUNAT BVE
 */

// ============================================================
// 1. ESTADO GLOBAL DE LA APLICACIÓN
// ============================================================
const State = {
  cart: [],
  categories: [],
  customers: [],
  documentType: '03', // 03=Boleta, 01=Factura, 00=Ticket interno
  currentSunatConfig: null,
  internetAvailable: false,
  sunatStats: { pending: 0, accepted: 0, rejected: 0 },
  activeTicketInvoice: null,
  activeTicketViewType: 'client', // 'client' | 'bve'
  ticketTemplate: {
    title: 'COMPROBANTE DE COMPRA',
    brand: 'VentaFácil Express',
    phone: 'Tel: (01) 987-654-321',
    subtitle: '¡Gracias por su visita!',
    footerNote: 'Conserve su ticket para cambios dentro de los 7 días. No válido para crédito fiscal.',
    showIgv: true,
  },
  bveTemplate: {
    ruc: '20123456789',
    razonSocial: 'MI BODEGA SAC',
    direccion: 'Jr. Mercado 123, Lima - PERU',
    serie: 'B001',
    ambiente: 'BETA',
    sunatLegend: 'Representación impresa de la Boleta de Venta Electrónica. Consulte su comprobante en SUNAT.',
  }
};

// ============================================================
// 2. API CLIENT (Wrapper sobre fetch + SQLite via Express)
// ============================================================
const api = {
  async get(endpoint) {
    const r = await fetch(`/api${endpoint}`);
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async post(endpoint, data) {
    const r = await fetch(`/api${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async put(endpoint, data) {
    const r = await fetch(`/api${endpoint}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async del(endpoint) {
    const r = await fetch(`/api${endpoint}`, { method: 'DELETE' });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  }
};

// ============================================================
// 3. DATOS DEMO (para visualizar sin servidor)
// ============================================================
const demoProducts = [
  { id:1, barcode:'7750123001019', name:'Pollo Entero Crudo', category_name:'Cárnicos', is_bulk:1, unit_measure:'KG', sale_price:9.50, stock:18.5, min_stock:5, is_active:1 },
  { id:2, barcode:'7750123001020', name:'Gaseosa Inca Kola 1.5L', category_name:'Bebidas', is_bulk:0, unit_measure:'UNIDAD', sale_price:5.50, stock:42, min_stock:10, is_active:1 },
  { id:3, barcode:'7750123001021', name:'Pan de Molde Integral', category_name:'Panadería', is_bulk:0, unit_measure:'UNIDAD', sale_price:8.00, stock:7, min_stock:5, is_active:1 },
  { id:4, barcode:'7750123001022', name:'Arroz Extra 5Kg', category_name:'Abarrotes', is_bulk:0, unit_measure:'UNIDAD', sale_price:22.00, stock:3, min_stock:5, is_active:1 },
  { id:5, barcode:'7750123001023', name:'Aceite Vegetal 1L', category_name:'Abarrotes', is_bulk:0, unit_measure:'UNIDAD', sale_price:11.00, stock:15, min_stock:4, is_active:1 },
  { id:6, barcode:'7750123001024', name:'Queso Edam x100g', category_name:'Lácteos', is_bulk:1, unit_measure:'KG', sale_price:28.00, stock:4.2, min_stock:2, is_active:1 },
  { id:7, barcode:'7750123001025', name:'Leche Gloria Entera 1L', category_name:'Lácteos', is_bulk:0, unit_measure:'UNIDAD', sale_price:4.30, stock:30, min_stock:10, is_active:1 },
  { id:8, barcode:'7750123001026', name:'Huevo Rosado (docena)', category_name:'Huevos', is_bulk:0, unit_measure:'UNIDAD', sale_price:12.00, stock:20, min_stock:5, is_active:1 },
];

const demoCustomers = [
  {
    id: 1, name: 'María Gonzalez', doc_type: 1, doc_number: '40123456', phone: '987001122',
    credit_limit: 300, credit_used: 75.50, is_active: 1,
    fiado_sales: [
      { invoice_number: 'B001-00000013', created_at: '2026-08-06 10:02', items_summary: 'Pollo Entero 1.5 Kg, Gaseosa x2', total: 47.50, paid: false },
      { invoice_number: 'B001-00000010', created_at: '2026-08-05 14:30', items_summary: 'Arroz Extra 5Kg', total: 28.00, paid: false },
    ]
  },
  {
    id: 2, name: 'Carlos Quispe', doc_type: 1, doc_number: '40223457', phone: '987002233',
    credit_limit: 500, credit_used: 430.00, is_active: 1,
    fiado_sales: [
      { invoice_number: 'B001-00000005', created_at: '2026-08-04 09:10', items_summary: 'Aceite Vegetal x3, Leche x5, Pan x2', total: 95.00, paid: false },
      { invoice_number: 'B001-00000007', created_at: '2026-08-04 16:45', items_summary: 'Queso Edam 0.8Kg, Huevos x2', total: 46.40, paid: false },
      { invoice_number: 'B001-00000009', created_at: '2026-08-05 11:20', items_summary: 'Pollo Entero 2 Kg', total: 19.00, paid: false },
      { invoice_number: 'B001-00000011', created_at: '2026-08-06 08:55', items_summary: 'Arroz x2, Gaseosa x4', total: 66.00, paid: false },
      { invoice_number: 'B001-00000012', created_at: '2026-08-06 10:30', items_summary: 'Variado', total: 203.60, paid: false },
    ]
  },
  {
    id: 3, name: 'Empresa ABC SAC', doc_type: 6, doc_number: '20123456789', phone: '014445566',
    credit_limit: 5000, credit_used: 0, is_active: 1,
    fiado_sales: []
  },
];

const demoSunatDocs = [
  { invoice_number:'B001-00000012', doc_type:'03', created_at:'2026-08-06 09:15', customer_name:'Cliente Final', total:35.40, igv:5.40, sunat_status:'ACEPTADO', cdr_code:'0', has_ticket:1 },
  { invoice_number:'B001-00000013', doc_type:'03', created_at:'2026-08-06 10:02', customer_name:'María Gonzalez', total:47.00, igv:7.17, sunat_status:'PENDIENTE', cdr_code:null, has_ticket:1 },
  { invoice_number:'F001-00000001', doc_type:'01', created_at:'2026-08-06 10:45', customer_name:'Empresa ABC SAC', total:280.00, igv:42.71, sunat_status:'ACEPTADO', cdr_code:'0', has_ticket:1 },
  { invoice_number:'B001-00000014', doc_type:'03', created_at:'2026-08-06 11:00', customer_name:'Cliente Final', total:22.00, igv:3.36, sunat_status:'PENDIENTE', cdr_code:null, has_ticket:1 },
];

// ============================================================
// 4. RENDERIZADORES DE CATÁLOGO Y CARRITO
// ============================================================
function renderProductGrid(products) {
  const grid = document.getElementById('productGrid');
  if (!products.length) {
    grid.innerHTML = `<div class="loading-state"><span>😶</span><p>No se encontraron productos</p></div>`;
    return;
  }
  grid.innerHTML = products.map(p => {
    const isLow = p.stock <= p.min_stock;
    const typeLabel = p.is_bulk ? '🥩 CRUDO/Kg' : '📦 UNIDAD';
    return `
      <div class="product-card ${p.is_bulk ? 'bulk-card' : ''}" onclick="addToCart(${p.id})" title="Código: ${p.barcode}">
        <span class="product-card-type">${typeLabel}</span>
        <h4>${p.name}</h4>
        <small class="category-name">${p.category_name || '—'}</small>
        <div class="price-row">
          <span class="price">S/. ${parseFloat(p.sale_price).toFixed(2)}</span>
          <span class="stock-indicator ${isLow ? 'low' : ''}">
            ${isLow ? '⚠️' : ''}${parseFloat(p.stock).toFixed(p.is_bulk ? 3 : 0)} ${p.unit_measure}
          </span>
        </div>
function addToCart(productId) {
  const product = demoProducts.find(p => p.barcode === String(productId) || p.id === productId);
  if (!product) return;

  const key = product.barcode || product.id;
  if (product.is_bulk) {
    const weight = parseFloat(prompt(`Ingrese el peso en ${product.unit_measure} para:\n"${product.name}"`) || 0);
    if (!weight || weight <= 0) return;
    const existing = State.cart.find(i => (i.barcode || i.id) === key);
    if (existing) existing.quantity += weight;
    else State.cart.push({ ...product, quantity: weight });
  } else {
    const existing = State.cart.find(i => (i.barcode || i.id) === key);
    if (existing) existing.quantity += 1;
    else State.cart.push({ ...product, quantity: 1 });
  }

  renderCart();
  document.getElementById('globalBarcodeScanner').focus();
}

function removeFromCart(productId) {
  State.cart = State.cart.filter(i => (i.barcode || i.id) !== productId);
  renderCart();
}

function changeQty(productId, delta) {
  const item = State.cart.find(i => (i.barcode || i.id) === productId);
  if (!item) return;
  const newQty = parseFloat((item.quantity + delta).toFixed(3));
  if (newQty <= 0) { removeFromCart(productId); return; }
  item.quantity = newQty;
  renderCart();
}

function renderCart() {
  const tbody = document.getElementById('cartTableBody');
  const total = State.cart.reduce((s, i) => s + (i.sale_price * i.quantity), 0);
  const igv = total * 0.18 / 1.18;
  const subtotalGravada = total - igv;

  document.getElementById('cartItemsCount').textContent = `${State.cart.length} ítems`;
  document.getElementById('cartSubtotalGravada').textContent = `S/. ${subtotalGravada.toFixed(2)}`;
  document.getElementById('cartIgv').textContent = `S/. ${igv.toFixed(2)}`;
  document.getElementById('cartTotal').textContent = `S/. ${total.toFixed(2)}`;

  if (!State.cart.length) {
    tbody.innerHTML = `<tr class="empty-cart-row"><td colspan="5"><div class="empty-cart-state"><span class="empty-icon">🛒</span><p>Escanee un código de barras<br>o haga clic en un producto</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = State.cart.map(item => {
    const lineTotal = item.sale_price * item.quantity;
    const itemKey = item.barcode || item.id;
    return `
      <tr>
        <td>
          <div class="qty-controls">
            <button class="btn-qty" onclick="changeQty('${itemKey}', -${item.is_bulk ? 0.1 : 1})">−</button>
            <span>${item.is_bulk ? item.quantity.toFixed(3) : item.quantity}</span>
            <button class="btn-qty" onclick="changeQty('${itemKey}', ${item.is_bulk ? 0.1 : 1})">+</button>
          </div>
        </td>
        <td class="prod-info">
          <strong>${item.name}</strong>
          <small>${item.barcode}</small>
        </td>
        <td style="font-family:var(--font-mono)">S/.${parseFloat(item.sale_price).toFixed(2)}</td>
        <td style="font-family:var(--font-mono); color:var(--success); font-weight:700">S/.${lineTotal.toFixed(2)}</td>
        <td><button class="btn-qty" style="color:var(--danger)" onclick="removeFromCart('${itemKey}')">✕</button></td>
      </tr>`;
  }).join('');
  updateCashChange();
}`;
  }).join('');

  updateCashChange();
}

function updateCashChange() {
  const total = State.cart.reduce((s, i) => s + (i.sale_price * i.quantity), 0);
  const paid = parseFloat(document.getElementById('cashPaidInput').value || 0);
  const change = Math.max(0, paid - total);
  document.getElementById('changeDueText').textContent = `S/. ${change.toFixed(2)}`;
}

// ============================================================
// 5. BÚSQUEDA POR CÓDIGO DE BARRAS
// ============================================================
function searchByBarcode(barcode) {
  const clean = barcode.trim();
  if (!clean) return;
  const product = demoProducts.find(p => p.barcode === clean || p.name.toLowerCase().includes(clean.toLowerCase()));
  if (product) {
    addToCart(product.id);
    document.getElementById('globalBarcodeScanner').value = '';
  } else {
    alert(`❌ Producto no encontrado:\n"${clean}"\n\nAsegúrese de registrarlo primero en Inventario.`);
    document.getElementById('globalBarcodeScanner').value = '';
  }
}

// ============================================================
// 6. RENDERIZADO DE INVENTARIO
// ============================================================
function renderInventory(products) {
  const tbody = document.getElementById('inventoryTableBody');
  const lowStockCount = products.filter(p => p.stock <= p.min_stock).length;

  const banner = document.getElementById('lowStockAlertBanner');
  if (lowStockCount > 0) {
    banner.style.display = 'flex';
    document.getElementById('lowStockAlertText').textContent = `${lowStockCount} producto(s) con stock bajo o agotado — revise antes de continuar vendiendo.`;
  }

  tbody.innerHTML = products.map((p, i) => {
    const isLow = p.stock <= p.min_stock;
    const typeLabel = p.is_bulk
      ? `<span class="bulk-badge">🥩 CRUDO/Granel</span>`
      : `<span style="color:var(--text-muted); font-size:12px">📦 ${p.unit_measure}</span>`;
    const statusLabel = p.is_active
      ? `<span class="status-badge" style="background:var(--success-light);color:var(--success)">Activo</span>`
      : `<span class="status-badge" style="background:rgba(100,116,139,0.2);color:var(--text-muted)">Inactivo</span>`;
    return `
      <tr>
        <td style="color:var(--text-dim)">${i + 1}</td>
        <td><span class="barcode-badge">${p.barcode}</span></td>
        <td><strong>${p.name}</strong></td>
        <td>${typeLabel}</td>
        <td style="font-family:var(--font-mono)">—</td>
        <td style="font-family:var(--font-mono); color:var(--success); font-weight:700">S/.${parseFloat(p.sale_price).toFixed(2)}</td>
        <td style="font-family:var(--font-mono); color:${isLow ? 'var(--danger)' : 'var(--text-main)'}; font-weight:${isLow ? '700' : '400'}">
          ${isLow ? '⚠️ ' : ''}${parseFloat(p.stock).toFixed(p.is_bulk ? 3 : 0)} ${p.unit_measure}
        </td>
        <td style="font-family:var(--font-mono); color:var(--text-muted)">${p.min_stock} ${p.unit_measure}</td>
        <td>${statusLabel}</td>
        <td>
          <button class="btn-primary btn-sm" onclick="editProduct('${p.barcode}')">✏️</button>
          <button class="btn-danger btn-sm" onclick="deleteProduct('${p.barcode}')" style="margin-left:4px;">🗑️</button>
        </td>
      </tr>`;
  }).join('');
}

// ============================================================
// 7. RENDERIZADO DE CLIENTES / FIADOS POR PERSONA
// ============================================================
function renderFiadoGrid(customers) {
  const grid = document.getElementById('fiadoCustomerGrid');
  let totalDebt = 0;
  let withDebt = 0;

  grid.innerHTML = customers.map(c => {
    const debt = parseFloat(c.credit_used || 0);
    const limit = parseFloat(c.credit_limit || 0);
    const available = Math.max(0, limit - debt);
    const pct = limit > 0 ? Math.min(100, (debt / limit) * 100) : 0;
    totalDebt += debt;
    if (debt > 0) withDebt++;

    const statusClass = debt === 0 ? 'fiado-card--ok'
      : pct >= 90 ? 'fiado-card--critical'
      : 'fiado-card--warn';

    const statusLabel = debt === 0
      ? `<span class="badge-accepted">✅ Al Día</span>`
      : pct >= 90
        ? `<span class="badge-rejected">🚨 Límite Crítico</span>`
        : `<span class="badge-pending">⚠️ Con Deuda</span>`;

    const salesRows = (c.fiado_sales || []).map(s => `
      <tr class="fiado-sale-row">
        <td><span class="barcode-badge" style="font-size:11px">${s.invoice_number}</span></td>
        <td style="font-size:11px; color:var(--text-muted)">${s.created_at}</td>
        <td style="font-size:11px; max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis">${s.items_summary}</td>
        <td style="font-family:var(--font-mono); font-weight:700; color:var(--danger)">S/.${parseFloat(s.total).toFixed(2)}</td>
      </tr>`).join('');

    const noSales = c.fiado_sales && c.fiado_sales.length === 0
      ? `<tr><td colspan="4" style="text-align:center; color:var(--text-dim); padding:12px; font-size:12px">✅ Sin compras fiadas pendientes</td></tr>`
      : '';

    return `
    <div class="fiado-person-card ${statusClass}">
      <div class="fpc-header" onclick="toggleFiadoCard(${c.id})">
        <div class="fpc-avatar">${c.name.charAt(0).toUpperCase()}</div>
        <div class="fpc-info">
          <strong class="fpc-name">${c.name}</strong>
          <small class="fpc-doc">${c.doc_type === 6 ? 'RUC' : 'DNI'}: ${c.doc_number || '—'} &middot; ${c.phone || '—'}</small>
        </div>
        <div class="fpc-debt-block">
          <span class="fpc-debt-amount ${debt > 0 ? 'text-danger' : 'text-success'}">
            S/. ${debt.toFixed(2)}
          </span>
          <span class="fpc-debt-label">de deuda</span>
        </div>
        <div class="fpc-status">${statusLabel}</div>
        <span class="fpc-toggle" id="fpc-toggle-${c.id}">▼</span>
      </div>

      <!-- BARRA DE USO DE CRÉDITO -->
      <div class="fpc-credit-bar-wrap">
        <div class="fpc-credit-bar" style="width:${pct.toFixed(1)}%; background:${pct >= 90 ? 'var(--danger)' : pct >= 60 ? 'var(--warning)' : 'var(--success)'};"></div>
      </div>
      <div class="fpc-credit-info">
        <span>Usado: S/.${debt.toFixed(2)}</span>
        <span>Límite: S/.${limit.toFixed(2)}</span>
        <span>Disponible: <strong style="color:var(--success)">S/.${available.toFixed(2)}</strong></span>
      </div>

      <!-- DETALLE EXPANDIBLE -->
      <div class="fpc-detail" id="fpc-detail-${c.id}" style="display:none">
        <table class="data-table fiado-inner-table">
          <thead>
            <tr>
              <th>Comprobante</th>
              <th>Fecha</th>
              <th>Productos</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>${salesRows}${noSales}</tbody>
        </table>
        <div class="fpc-actions">
          ${debt > 0 ? `
          <div class="abono-inline">
            <input type="number" id="abono-input-${c.id}" placeholder="Monto abono S/." step="0.50" min="0.50" class="abono-inline-input">
            <select id="abono-method-${c.id}" class="select-sm">
              <option value="EFECTIVO">💵 Efectivo</option>
              <option value="TARJETA">💳 Tarjeta</option>
              <option value="TRANSFERENCIA">📱 Transfer.</option>
            </select>
            <button class="btn-success btn-sm" onclick="registrarAbonoInline(${c.id})">✅ Abonar</button>
          </div>` : ''}
          <button class="btn-primary btn-sm" onclick="editCustomer(${c.id})">✏️</button>
        </div>
      </div>
    </div>`;
  }).join('');

  document.getElementById('statsDebtors').textContent = withDebt;
  document.getElementById('statsTotalDebt').textContent = `S/.${totalDebt.toFixed(2)}`;
  document.getElementById('statsGoodStanding').textContent = customers.length - withDebt;

  // Rellenar select del checkout modal con clientes
  const coSelect = document.getElementById('coFiadoSelect');
  if (coSelect) {
    coSelect.innerHTML = `<option value="">— Buscar cliente —</option>` +
      customers.map(c => `<option value="${c.id}">${c.name} (disponible: S/.${Math.max(0, c.credit_limit - c.credit_used).toFixed(2)})</option>`).join('');
  }
}

function toggleFiadoCard(custId) {
  const detail = document.getElementById(`fpc-detail-${custId}`);
  const toggle = document.getElementById(`fpc-toggle-${custId}`);
  if (!detail) return;
  const isOpen = detail.style.display !== 'none';
  detail.style.display = isOpen ? 'none' : 'block';
  toggle.textContent = isOpen ? '▼' : '▲';
}

function registrarAbonoInline(custId) {
  const input = document.getElementById(`abono-input-${custId}`);
  const amount = parseFloat(input.value);
  if (!amount || amount <= 0) { alert('Ingrese un monto válido.'); return; }
  const cust = demoCustomers.find(c => c.id === custId);
  if (!cust) return;
  if (amount > cust.credit_used) {
    alert(`El abono (S/.${amount.toFixed(2)}) supera la deuda actual (S/.${cust.credit_used.toFixed(2)}).`);
    return;
  }
  cust.credit_used = parseFloat((cust.credit_used - amount).toFixed(2));
  input.value = '';
  renderFiadoGrid(demoCustomers);
  // Mantener expandida la tarjeta donde se abonó
  setTimeout(() => {
    const detail = document.getElementById(`fpc-detail-${custId}`);
    const toggle = document.getElementById(`fpc-toggle-${custId}`);
    if (detail) { detail.style.display = 'block'; toggle.textContent = '▲'; }
  }, 0);
  alert(`✅ Abono de S/.${amount.toFixed(2)} registrado para ${cust.name}.\nDeuda restante: S/.${cust.credit_used.toFixed(2)}`);
}

// ============================================================
// 8. TAB SUNAT BVE
// ============================================================
function renderSunatTab(docs) {
  const tbody = document.getElementById('sunatTableBody');
  let pending = 0, accepted = 0, rejected = 0;

  tbody.innerHTML = docs.map(d => {
    const badgeClass = d.sunat_status === 'ACEPTADO' ? 'badge-accepted'
      : d.sunat_status === 'RECHAZADO' ? 'badge-rejected'
      : d.sunat_status === 'TICKET INTERNO' ? 'badge-internal'
      : 'badge-pending';

    if (d.sunat_status === 'PENDIENTE') pending++;
    else if (d.sunat_status === 'ACEPTADO') accepted++;
    else if (d.sunat_status === 'RECHAZADO') rejected++;

    const typeLabel = d.doc_type === '01' ? '📋 Factura' : d.doc_type === '03' ? '📄 Boleta' : '🧾 Ticket';
    const cdrCell = d.cdr_code === '0'
      ? `<span style="color:var(--success); font-size:12px">✅ CDR OK</span>`
      : d.cdr_code
        ? `<span style="color:var(--danger); font-size:12px">❌ ${d.cdr_code}</span>`
        : `<span style="color:var(--text-dim); font-size:11px">—</span>`;

    return `
      <tr>
        <td><span class="barcode-badge" style="font-size:12px">${d.invoice_number}</span></td>
        <td>${typeLabel}</td>
        <td style="font-size:12px; color:var(--text-muted)">${d.created_at}</td>
        <td>${d.customer_name || 'Cliente Final'}</td>
        <td style="font-family:var(--font-mono); font-weight:700; color:var(--success)">S/.${parseFloat(d.total).toFixed(2)}</td>
        <td style="font-family:var(--font-mono); color:var(--text-muted)">S/.${parseFloat(d.igv).toFixed(2)}</td>
        <td><span class="${badgeClass}">${d.sunat_status}</span></td>
        <td>${cdrCell}</td>
        <td><button class="btn-primary btn-sm" onclick="showTicket('${d.invoice_number}')">🧾</button></td>
      </tr>`;
  }).join('');

  document.getElementById('sunatStatPending').textContent = pending;
  document.getElementById('sunatStatAccepted').textContent = accepted;
  document.getElementById('sunatStatRejected').textContent = rejected;

  // Badge en navegación
  const badge = document.getElementById('navSunatBadge');
  if (pending > 0) {
    badge.textContent = pending;
    badge.style.display = 'inline-block';
  } else {
    badge.style.display = 'none';
  }

  // Pill en header
  document.getElementById('sunatStatPending').textContent = pending;
  const pillText = document.getElementById('sunatPillText');
  if (pending > 0) {
    pillText.textContent = `${pending} PENDIENTES`;
    document.getElementById('sunatStatusPill').style.color = 'var(--warning)';
  } else {
    pillText.textContent = 'AL DÍA ✓';
    document.getElementById('sunatStatusPill').style.color = 'var(--success)';
  }

  // Cargar configuración demo
  document.getElementById('cfgRuc').textContent = '20123456789';
  document.getElementById('cfgRazonSocial').textContent = 'MI BODEGA SAC';
  document.getElementById('cfgNombreComercial').textContent = 'VentaFácil Express';
  document.getElementById('cfgDireccion').textContent = 'Jr. Mercado 123, Lima';
  document.getElementById('cfgAmbiente').textContent = '🟡 BETA (Homologación SUNAT)';
}

// ============================================================
// 9. TICKET / COMPROBANTE 58MM (CLIENTE vs BOLETA SUNAT)
// ============================================================
function showTicket(invoiceNumber, viewType) {
  if (invoiceNumber) State.activeTicketInvoice = invoiceNumber;
  if (viewType) State.activeTicketViewType = viewType;

  const currentInvoice = State.activeTicketInvoice || 'B001-00000015';
  const currentView = State.activeTicketViewType || 'client';
  const doc = demoSunatDocs.find(d => d.invoice_number === currentInvoice) || {};

  const items = State.cart.length ? State.cart : [
    { name: 'Pollo Entero Crudo', quantity: 1.5, sale_price: 9.50 },
    { name: 'Gaseosa Inca Kola 1.5L', quantity: 2, sale_price: 5.50 },
    { name: 'Pan de Molde Integral', quantity: 1, sale_price: 8.00 },
  ];
  const total = items.reduce((s, i) => s + (i.sale_price * i.quantity), 0) || parseFloat(doc.total || 33.25);
  const igv = total * 0.18 / 1.18;
  const base = total - igv;
  const now = doc.created_at || new Date().toLocaleString('es-PE');
  const custName = doc.customer_name || 'Cliente Final';

  // Toggle active class on doc selector buttons
  const btnClient = document.getElementById('btnViewDocClient');
  const btnSunat = document.getElementById('btnViewDocSunat');
  const hintText = document.getElementById('docViewHintText');

  if (btnClient && btnSunat) {
    if (currentView === 'client') {
      btnClient.classList.add('active');
      btnSunat.classList.remove('active');
      if (hintText) {
        hintText.innerHTML = `💡 <strong>Impresión por defecto:</strong> Se entrega el <strong>Comprobante de Pago al Cliente</strong>. La Boleta BVE se genera para SUNAT.`;
      }
    } else {
      btnSunat.classList.add('active');
      btnClient.classList.remove('active');
      if (hintText) {
        hintText.innerHTML = `📄 <strong>Boleta Electrónica SUNAT:</strong> Comprobante tributario oficial. (Serie ${currentInvoice}).`;
      }
    }
  }

  let text = '';

  if (currentView === 'client') {
    // ------------------------------------------------------------
    // FORMATO 1: COMPROBANTE DE PAGO AL CLIENTE (TICKET DE VENTA)
    // ------------------------------------------------------------
    const tpl = State.ticketTemplate;
    const center = (str, len = 32) => {
      const s = String(str || '').trim().substring(0, len);
      const pad = Math.max(0, Math.floor((len - s.length) / 2));
      return ' '.repeat(pad) + s;
    };

    text = [
      '================================',
      center(tpl.title || 'COMPROBANTE DE COMPRA'),
      center(tpl.brand || 'VentaFácil Express'),
      center(tpl.phone || ''),
      '================================',
      ` Ticket Ref: ${currentInvoice}`,
      ` Fecha: ${now}`,
      ` Cliente: ${custName.substring(0, 20)}`,
      '--------------------------------',
      ' CANT  DESCRIPCION          TOTAL',
      '--------------------------------',
      ...items.map(i => {
        const desc = i.name.substring(0, 18).padEnd(18);
        const qty = parseFloat(i.quantity).toFixed(i.is_bulk ? 2 : 0).padStart(4);
        const tot = `S/.${(i.sale_price * i.quantity).toFixed(2)}`.padStart(7);
        return ` ${qty}  ${desc} ${tot}`;
      }),
      '--------------------------------',
      ...(tpl.showIgv ? [
        ` OP. GRAVADA:     S/.${base.toFixed(2).padStart(8)}`,
        ` IGV 18%:         S/.${igv.toFixed(2).padStart(8)}`,
        '--------------------------------',
      ] : []),
      ` TOTAL A PAGAR:  S/.${total.toFixed(2).padStart(8)}`.padEnd(32),
      ` Forma de Pago:  ${(doc.payment_method || 'EFECTIVO').padStart(8)}`,
      '================================',
      center(tpl.subtitle || '¡Gracias por su compra!'),
      center(tpl.footerNote || 'Conserve su ticket para cambios.'),
      '================================',
    ].join('\n');

  } else {
    // ------------------------------------------------------------
    // FORMATO 2: BOLETA ELECTRÓNICA SUNAT (BVE FISCAL)
    // ------------------------------------------------------------
    const bve = State.bveTemplate;
    const docLabel = doc.doc_type === '01' ? 'FACTURA ELECTRONICA' : 'BOLETA DE VENTA ELECTRONICA';
    const center = (str, len = 32) => {
      const s = String(str || '').trim().substring(0, len);
      const pad = Math.max(0, Math.floor((len - s.length) / 2));
      return ' '.repeat(pad) + s;
    };

    text = [
      '================================',
      center(bve.razonSocial || 'MI BODEGA SAC'),
      center(`RUC: ${bve.ruc || '20123456789'}`),
      center(bve.direccion || 'Jr. Mercado 123, Lima'),
      '================================',
      center(docLabel),
      center(currentInvoice),
      '--------------------------------',
      ` Fecha Emision: ${now}`,
      ` Cajero: ADMIN`,
      ` Senor(es): ${custName.substring(0, 20)}`,
      ` Tipo de Pago: ${doc.payment_method || 'EFECTIVO'}`,
      '--------------------------------',
      ' CANT  DESCRIPCION          TOTAL',
      '--------------------------------',
      ...items.map(i => {
        const desc = i.name.substring(0, 18).padEnd(18);
        const qty = parseFloat(i.quantity).toFixed(i.is_bulk ? 2 : 0).padStart(4);
        const tot = `S/.${(i.sale_price * i.quantity).toFixed(2)}`.padStart(7);
        return ` ${qty}  ${desc} ${tot}`;
      }),
      '--------------------------------',
      ` OP. GRAVADA:     S/.${base.toFixed(2).padStart(8)}`,
      ` IGV 18%:         S/.${igv.toFixed(2).padStart(8)}`,
      '================================',
      ` TOTAL FINAL:    S/.${total.toFixed(2).padStart(8)}`.padEnd(32),
      '================================',
      ` ESTADO SUNAT: ${doc.sunat_status || 'PENDIENTE'}`,
      ` Hash: ${doc.cdr_code ? 'a8f9b2c3d4e5...' : 'Por firmar digitalmente'}`,
      '--------------------------------',
      center(bve.sunatLegend || 'Representación impresa de BVE'),
      '================================',
    ].join('\n');
  }

  document.getElementById('receiptPaperText').textContent = text;
  document.getElementById('ticketInvoiceNumber').textContent = currentInvoice;

  const badge = document.getElementById('ticketSunatBadge');
  if (badge) {
    badge.className = doc.sunat_status === 'ACEPTADO' ? 'badge-accepted'
      : doc.sunat_status === 'RECHAZADO' ? 'badge-rejected'
      : 'badge-pending';
    badge.textContent = (doc.sunat_status || 'PENDIENTE SUNAT') + (doc.sunat_status === 'ACEPTADO' ? ' ✓' : '');
  }

  openModal('ticketModal');
}

// ============================================================
// 9.1 GESTIÓN Y EDICIÓN DE PLANTILLAS DE COMPROBANTES
// ============================================================
function openEditTemplateModal(defaultTab = 'client') {
  // Cargar valores actuales en el formulario del cliente
  const tpl = State.ticketTemplate;
  document.getElementById('tplClientTitle').value = tpl.title || '';
  document.getElementById('tplClientBrand').value = tpl.brand || '';
  document.getElementById('tplClientPhone').value = tpl.phone || '';
  document.getElementById('tplClientSubtitle').value = tpl.subtitle || '';
  document.getElementById('tplClientFooterNote').value = tpl.footerNote || '';
  document.getElementById('tplClientShowIgv').checked = !!tpl.showIgv;

  // Cargar valores actuales en el formulario SUNAT
  const bve = State.bveTemplate;
  document.getElementById('tplSunatRuc').value = bve.ruc || '';
  document.getElementById('tplSunatRazonSocial').value = bve.razonSocial || '';
  document.getElementById('tplSunatDireccion').value = bve.direccion || '';
  document.getElementById('tplSunatSerie').value = bve.serie || 'B001';
  document.getElementById('tplSunatAmbiente').value = bve.ambiente || 'BETA';
  document.getElementById('tplSunatLegend').value = bve.sunatLegend || '';

  // Activar tab correspondiente
  switchTemplateTab(defaultTab);
  openModal('editTemplateModal');
}

function switchTemplateTab(tab) {
  const btnClient = document.getElementById('tplTabClientBtn');
  const btnSunat = document.getElementById('tplTabSunatBtn');
  const formClient = document.getElementById('formTemplateClient');
  const formSunat = document.getElementById('formTemplateSunat');

  if (tab === 'client') {
    btnClient.classList.add('active');
    btnSunat.classList.remove('active');
    formClient.style.display = 'block';
    formSunat.style.display = 'none';
  } else {
    btnSunat.classList.add('active');
    btnClient.classList.remove('active');
    formClient.style.display = 'none';
    formSunat.style.display = 'block';
  }
}

// ============================================================
// 10. MODAL CHECKOUT: PAGAR O FIAR
// ============================================================
let checkoutPayMode = 'pay';   // 'pay' | 'fiar'
let checkoutPayMethod = 'EFECTIVO';

function openCheckoutModal() {
  if (!State.cart.length) {
    alert('⚠️ El carrito está vacío. Agrega productos antes de cobrar.');
    return;
  }
  const total = State.cart.reduce((s, i) => s + i.sale_price * i.quantity, 0);
  const igv = total * 0.18 / 1.18;

  document.getElementById('checkoutTotalDisplay').textContent = `S/. ${total.toFixed(2)}`;
  document.getElementById('checkoutIgvNote').textContent = `Incluye IGV S/. ${igv.toFixed(2)}`;

  // Reset estado del modal
  checkoutPayMode = 'pay';
  checkoutPayMethod = 'EFECTIVO';
  document.getElementById('panelPay').style.display = 'block';
  document.getElementById('panelFiar').style.display = 'none';
  document.getElementById('pofBtnPay').classList.add('active');
  document.getElementById('pofBtnFiar').classList.remove('active');
  document.getElementById('cashCalcBox').style.display = 'flex';
  document.getElementById('coEfectivoInput').value = '';
  document.getElementById('coChangeDisplay').textContent = 'S/. 0.00';
  document.getElementById('coFiadoSelect').value = '';
  document.getElementById('fiadoClientInfo').style.display = 'none';
  document.getElementById('fiadoOverLimitWarning').style.display = 'none';

  // Marcar EFECTIVO activo
  document.querySelectorAll('.pay-method-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.pay-method-btn[data-method="EFECTIVO"]').classList.add('active');

  openModal('checkoutModal');
}

function confirmCheckout() {
  const total = State.cart.reduce((s, i) => s + i.sale_price * i.quantity, 0);
  const docType = State.documentType;
  const fakeInvoice = `${docType === '01' ? 'F001' : 'B001'}-${String(Date.now()).slice(-6)}`;
  let customerName = 'Cliente Final';

  if (checkoutPayMode === 'fiar') {
    const custId = parseInt(document.getElementById('coFiadoSelect').value);
    if (!custId) { alert('Seleccione un cliente para el fiado.'); return; }
    const cust = demoCustomers.find(c => c.id === custId);
    if (!cust) return;
    // Añadir deuda al cliente
    cust.credit_used = parseFloat((cust.credit_used + total).toFixed(2));
    // Añadir la venta al historial de fiados del cliente
    cust.fiado_sales = cust.fiado_sales || [];
    cust.fiado_sales.unshift({
      invoice_number: fakeInvoice,
      created_at: new Date().toLocaleString('es-PE'),
      items_summary: State.cart.map(i => `${i.name} x${i.quantity}`).join(', ').substring(0, 80),
      total: total,
      paid: false
    });
    customerName = cust.name;
    renderFiadoGrid(demoCustomers);
  }

  // Registrar en docs SUNAT
  if (docType !== '00') {
    demoSunatDocs.push({
      invoice_number: fakeInvoice,
      doc_type: docType,
      created_at: new Date().toLocaleString('es-PE'),
      customer_name: customerName,
      total: total,
      igv: total * 0.18 / 1.18,
      sunat_status: 'PENDIENTE',
      payment_method: checkoutPayMode === 'fiar' ? 'FIADO' : checkoutPayMethod,
      cdr_code: null,
      has_ticket: 1
    });
    renderSunatTab(demoSunatDocs);
  }

  closeModal('checkoutModal');
  showTicket(fakeInvoice);
  State.cart = [];
  renderCart();
}

// ============================================================
// 11. SIMULACIÓN SINCRONIZACIÓN SUNAT
// ============================================================
function syncWithSunat() {
  const btn = document.getElementById('btnSyncSunat');
  btn.textContent = '⟳ Conectando a SUNAT...';
  btn.disabled = true;
  setTimeout(() => {
    let synced = 0;
    demoSunatDocs.forEach(d => {
      if (d.sunat_status === 'PENDIENTE' && d.doc_type !== '00') {
        d.sunat_status = 'ACEPTADO';
        d.cdr_code = '0';
        synced++;
      }
    });
    renderSunatTab(demoSunatDocs);
    btn.textContent = `🔄 Sincronizar con SUNAT`;
    btn.disabled = false;
    if (synced > 0) alert(`✅ ${synced} comprobante(s) enviados y aceptados por SUNAT correctamente.`);
    else alert(`ℹ️ No hay comprobantes pendientes de sincronizar.`);
  }, 2200);
}

// ============================================================
// 12. CONTROL DE MODALES Y NAVEGACIÓN
// ============================================================
function openModal(id) {
  document.getElementById(id).classList.add('active');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('active');
}

function switchTab(tabId) {
  document.querySelectorAll('.tab-pane').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
}

// ============================================================
// 13. FUNCIONES STUB PARA EDICIÓN
// ============================================================
function editProduct(id) { alert(`✏️ Editar Producto ID ${id} — Próximamente conectado al servidor.`); }
function deleteProduct(id) { if (confirm(`¿Eliminar producto #${id}?`)) alert('Eliminado (demo).'); }
function editCustomer(id) { alert(`✏️ Editar Cliente ID ${id} — Próximamente.`); }
function openPaymentModal() {}
function showTicketFromHistory(invoiceNumber) { showTicket(invoiceNumber); }

// ============================================================
// 14. INICIALIZACIÓN
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  // Cargar datos demo
  renderProductGrid(demoProducts);
  renderInventory(demoProducts);
  renderFiadoGrid(demoCustomers);
  renderSunatTab(demoSunatDocs);
  renderCart();

  // Navegación por tabs
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Escáner de código de barras (pistola HID — se activa con Enter)
  const scanInput = document.getElementById('globalBarcodeScanner');
  scanInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      searchByBarcode(scanInput.value);
    }
  });

  document.getElementById('btnScanSearch').addEventListener('click', () => {
    searchByBarcode(scanInput.value);
  });

  // Mantener foco en el campo del escáner
  document.addEventListener('keydown', (e) => {
    if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA' || document.activeElement.tagName === 'SELECT') return;
    if (!['F1','F2','F3','F4','F5'].includes(e.key)) scanInput.focus();
  });

  // Selector de tipo de documento (Boleta/Factura/Ticket)
  document.querySelectorAll('.doc-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.doc-type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      State.documentType = btn.dataset.type;
      const sunatLabel = document.getElementById('sunatLabelBtn');
      if (State.documentType === '00') sunatLabel.textContent = 'SOLO TICKET';
      else sunatLabel.textContent = State.documentType === '01' ? 'FACTURA SUNAT' : 'BOLETA SUNAT';
    });
  });

  // CHECKOUT: abre el modal pagar/fiar
  document.getElementById('btnCheckout').addEventListener('click', openCheckoutModal);

  // Botones PAY / FIAR del modal
  document.getElementById('pofBtnPay').addEventListener('click', () => {
    checkoutPayMode = 'pay';
    document.getElementById('pofBtnPay').classList.add('active');
    document.getElementById('pofBtnFiar').classList.remove('active');
    document.getElementById('panelPay').style.display = 'block';
    document.getElementById('panelFiar').style.display = 'none';
  });

  document.getElementById('pofBtnFiar').addEventListener('click', () => {
    checkoutPayMode = 'fiar';
    document.getElementById('pofBtnFiar').classList.add('active');
    document.getElementById('pofBtnPay').classList.remove('active');
    document.getElementById('panelPay').style.display = 'none';
    document.getElementById('panelFiar').style.display = 'block';
  });

  // Botones de método de pago en el modal
  document.querySelectorAll('.pay-method-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.pay-method-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      checkoutPayMethod = btn.dataset.method;
      document.getElementById('cashCalcBox').style.display =
        checkoutPayMethod === 'EFECTIVO' ? 'flex' : 'none';
    });
  });

  // Calculadora de cambio en el modal
  document.getElementById('coEfectivoInput').addEventListener('input', () => {
    const total = State.cart.reduce((s, i) => s + i.sale_price * i.quantity, 0);
    const paid = parseFloat(document.getElementById('coEfectivoInput').value || 0);
    const change = Math.max(0, paid - total);
    document.getElementById('coChangeDisplay').textContent = `S/. ${change.toFixed(2)}`;
  });

  // Selector de cliente fiado en el modal — muestra info de crédito
  document.getElementById('coFiadoSelect').addEventListener('change', () => {
    const custId = parseInt(document.getElementById('coFiadoSelect').value);
    const infoBox = document.getElementById('fiadoClientInfo');
    const overWarn = document.getElementById('fiadoOverLimitWarning');
    if (!custId) { infoBox.style.display = 'none'; overWarn.style.display = 'none'; return; }
    const cust = demoCustomers.find(c => c.id === custId);
    if (!cust) return;
    const total = State.cart.reduce((s, i) => s + i.sale_price * i.quantity, 0);
    const available = cust.credit_limit - cust.credit_used;
    const newDebt = cust.credit_used + total;
    infoBox.style.display = 'block';
    document.getElementById('fciLimit').textContent = `S/. ${cust.credit_limit.toFixed(2)}`;
    document.getElementById('fciDebt').textContent = `S/. ${cust.credit_used.toFixed(2)}`;
    document.getElementById('fciAvailable').textContent = `S/. ${available.toFixed(2)}`;
    document.getElementById('fciNewDebt').textContent = `S/. ${newDebt.toFixed(2)}`;
    overWarn.style.display = newDebt > cust.credit_limit ? 'block' : 'none';
  });

  // Confirmar checkout
  document.getElementById('btnConfirmCheckout').addEventListener('click', confirmCheckout);

  document.getElementById('btnClearCart').addEventListener('click', () => {
    if (!State.cart.length) return;
    if (confirm('¿Vaciar todo el carrito?')) { State.cart = []; renderCart(); }
  });

  // SUNAT sync
  document.getElementById('btnSyncSunat').addEventListener('click', syncWithSunat);

  // Búsqueda en POS
  document.getElementById('posSearchInput').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = demoProducts.filter(p => p.name.toLowerCase().includes(term));
    renderProductGrid(filtered);
  });

  // MODALES — abrir
  document.getElementById('btnOpenProductModal').addEventListener('click', () => openModal('productModal'));
  document.getElementById('btnOpenCustomerModal').addEventListener('click', () => openModal('customerModal'));
  document.getElementById('btnOpenCategoryModal').addEventListener('click', () => alert('Formulario de categoría — próximamente.'));

  // MODALES — cerrar con botón X o clase close-modal
  document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', () => {
      const modalId = btn.dataset.modal || btn.closest('.modal-overlay')?.id;
      if (modalId) closeModal(modalId);
    });
  });

  // Cerrar modal al hacer clic fuera
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal(overlay.id);
    });
  });

  // Imprimir ticket (ventana nueva)
  document.getElementById('btnPrintTicketWindow').addEventListener('click', () => {
    const content = document.getElementById('receiptPaperText').textContent;
    const w = window.open('', '', 'width=320,height=600');
    w.document.write(`<html><head><title>Ticket 58mm</title>
      <style>body{font-family:monospace;font-size:12px;white-space:pre;margin:8px}@media print{body{width:58mm}}</style>
    </head><body>${content}</body></html>`);
    w.document.close();
    w.print();
  });

  // Filtro SUNAT por estado
  document.getElementById('sunatFilterStatus').addEventListener('change', (e) => {
    const filtered = e.target.value ? demoSunatDocs.filter(d => d.sunat_status === e.target.value) : demoSunatDocs;
    renderSunatTab(filtered);
  });

  // Vista grilla/lista
  document.getElementById('btnGridView').addEventListener('click', () => {
    document.getElementById('btnGridView').classList.add('active');
    document.getElementById('btnListView').classList.remove('active');
    document.getElementById('productGrid').style.gridTemplateColumns = 'repeat(auto-fill, minmax(160px, 1fr))';
  });

  document.getElementById('btnListView').addEventListener('click', () => {
    document.getElementById('btnListView').classList.add('active');
    document.getElementById('btnGridView').classList.remove('active');
    document.getElementById('productGrid').style.gridTemplateColumns = '1fr';
  });

  // Form: Guardar producto (demo)
  document.getElementById('productForm').addEventListener('submit', (e) => {
    e.preventDefault();
    alert('✅ Producto guardado (demo sin servidor activo). Cuando el backend esté corriendo, se guardará en SQLite.');
    closeModal('productModal');
  });

  // Form: Guardar cliente
  document.getElementById('customerForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('custName').value.trim();
    const limit = parseFloat(document.getElementById('custCreditLimit').value);
    const newCust = {
      id: Date.now(),
      name,
      doc_type: parseInt(document.getElementById('custDocType').value),
      doc_number: document.getElementById('custDoc').value,
      phone: document.getElementById('custPhone').value,
      credit_limit: limit,
      credit_used: 0,
      is_active: 1,
      fiado_sales: []
    };
    demoCustomers.push(newCust);
    renderFiadoGrid(demoCustomers);
    alert(`✅ Cliente "${name}" registrado.`);
    closeModal('customerModal');
    e.target.reset();
  });

  // Form: Registrar abono (modal legado)
  const paymentForm = document.getElementById('paymentForm');
  if (paymentForm) {
    paymentForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const custId = parseInt(document.getElementById('payCustId').value);
      const amount = parseFloat(document.getElementById('payAmount').value);
      const cust = demoCustomers.find(c => c.id === custId);
      if (cust && amount > 0) {
        cust.credit_used = Math.max(0, cust.credit_used - amount);
        renderFiadoGrid(demoCustomers);
        alert(`✅ Abono de S/.${amount.toFixed(2)} registrado para ${cust.name}.`);
      }
      closeModal('paymentModal');
    });
  }

  // Selector de vista de comprobante en ticketModal (Comprobante Cliente vs Boleta SUNAT)
  const btnDocClient = document.getElementById('btnViewDocClient');
  const btnDocSunat = document.getElementById('btnViewDocSunat');
  if (btnDocClient) btnDocClient.addEventListener('click', () => showTicket(null, 'client'));
  if (btnDocSunat) btnDocSunat.addEventListener('click', () => showTicket(null, 'bve'));

  // Botones para abrir modal de edición de plantillas
  const btnEditSunat = document.getElementById('btnOpenEditTemplatesSunat');
  if (btnEditSunat) btnEditSunat.addEventListener('click', () => openEditTemplateModal('sunat'));
  const btnEditFromTicket = document.getElementById('btnOpenEditTemplatesFromTicket');
  if (btnEditFromTicket) btnEditFromTicket.addEventListener('click', () => openEditTemplateModal(State.activeTicketViewType));

  // Tabs dentro de editTemplateModal
  const tplTabClient = document.getElementById('tplTabClientBtn');
  const tplTabSunat = document.getElementById('tplTabSunatBtn');
  if (tplTabClient) tplTabClient.addEventListener('click', () => switchTemplateTab('client'));
  if (tplTabSunat) tplTabSunat.addEventListener('click', () => switchTemplateTab('sunat'));

  // Form submit: Plantilla Cliente
  const formTplClient = document.getElementById('formTemplateClient');
  if (formTplClient) {
    formTplClient.addEventListener('submit', (e) => {
      e.preventDefault();
      State.ticketTemplate.title = document.getElementById('tplClientTitle').value.trim();
      State.ticketTemplate.brand = document.getElementById('tplClientBrand').value.trim();
      State.ticketTemplate.phone = document.getElementById('tplClientPhone').value.trim();
      State.ticketTemplate.subtitle = document.getElementById('tplClientSubtitle').value.trim();
      State.ticketTemplate.footerNote = document.getElementById('tplClientFooterNote').value.trim();
      State.ticketTemplate.showIgv = document.getElementById('tplClientShowIgv').checked;

      alert('✅ Plantilla del Comprobante de Pago al Cliente actualizada correctamente.');
      closeModal('editTemplateModal');
      if (document.getElementById('ticketModal').classList.contains('active')) {
        showTicket(null, 'client');
      }
    });
  }

  // Form submit: Plantilla SUNAT
  const formTplSunat = document.getElementById('formTemplateSunat');
  if (formTplSunat) {
    formTplSunat.addEventListener('submit', (e) => {
      e.preventDefault();
      State.bveTemplate.ruc = document.getElementById('tplSunatRuc').value.trim();
      State.bveTemplate.razonSocial = document.getElementById('tplSunatRazonSocial').value.trim();
      State.bveTemplate.direccion = document.getElementById('tplSunatDireccion').value.trim();
      State.bveTemplate.serie = document.getElementById('tplSunatSerie').value.trim();
      State.bveTemplate.ambiente = document.getElementById('tplSunatAmbiente').value;
      State.bveTemplate.sunatLegend = document.getElementById('tplSunatLegend').value.trim();

      // Actualizar también panel de información SUNAT en la UI
      document.getElementById('cfgRuc').textContent = State.bveTemplate.ruc;
      document.getElementById('cfgRazonSocial').textContent = State.bveTemplate.razonSocial;
      document.getElementById('cfgNombreComercial').textContent = State.ticketTemplate.brand || State.bveTemplate.razonSocial;
      document.getElementById('cfgDireccion').textContent = State.bveTemplate.direccion;
      document.getElementById('cfgAmbiente').textContent = State.bveTemplate.ambiente === 'PROD'
        ? '🟢 PRODUCCIÓN (Facturación Real)'
        : '🟡 BETA (Homologación SUNAT)';

      alert('✅ Datos de Boleta Electrónica SUNAT actualizados correctamente.');
      closeModal('editTemplateModal');
      if (document.getElementById('ticketModal').classList.contains('active')) {
        showTicket(null, 'bve');
      }
    });
  }

  // ==================== CSV / SHEETS IMPORT MODAL HANDLERS ====================
  const btnOpenImportCsvModal = document.getElementById('btnOpenImportCsvModal');
  let selectedCsvText = '';

  if (btnOpenImportCsvModal) {
    btnOpenImportCsvModal.addEventListener('click', () => {
      openModal('importCsvModal');
      selectedCsvText = '';
      document.getElementById('fileSelectedInfo').style.display = 'none';
      document.getElementById('importStatusResult').style.display = 'none';
      document.getElementById('csvFileInput').value = '';
      document.getElementById('csvUrlInput').value = '';
    });
  }

  // Pestañas modal
  const tabOptionFile = document.getElementById('tabOptionFile');
  const tabOptionUrl = document.getElementById('tabOptionUrl');
  const sectionOptionFile = document.getElementById('sectionOptionFile');
  const sectionOptionUrl = document.getElementById('sectionOptionUrl');

  if (tabOptionFile && tabOptionUrl) {
    tabOptionFile.addEventListener('click', () => {
      tabOptionFile.className = 'btn-sm btn-primary active';
      tabOptionUrl.className = 'btn-sm btn-secondary';
      sectionOptionFile.style.display = 'block';
      sectionOptionUrl.style.display = 'none';
    });

    tabOptionUrl.addEventListener('click', () => {
      tabOptionUrl.className = 'btn-sm btn-primary active';
      tabOptionFile.className = 'btn-sm btn-secondary';
      sectionOptionFile.style.display = 'none';
      sectionOptionUrl.style.display = 'block';
    });
  }

  // File Drop Zone & Selector
  const csvDropZone = document.getElementById('csvDropZone');
  const csvFileInput = document.getElementById('csvFileInput');
  const fileSelectedInfo = document.getElementById('fileSelectedInfo');

  if (csvDropZone && csvFileInput) {
    csvDropZone.addEventListener('click', () => csvFileInput.click());

    csvDropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      csvDropZone.style.backgroundColor = 'var(--primary-light)';
    });

    csvDropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleCsvFile(e.dataTransfer.files[0]);
      }
    });

    csvFileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handleCsvFile(e.target.files[0]);
      }
    });
  }

  function handleCsvFile(file) {
    if (!file.name.endsWith('.csv')) {
      alert('Por favor selecciona un archivo con extensión .csv');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      selectedCsvText = e.target.result;
      fileSelectedInfo.style.display = 'block';
      fileSelectedInfo.textContent = `📄 Archivo seleccionado: ${file.name} (${Math.round(file.size / 1024)} KB)`;
    };
    reader.readAsText(file, 'UTF-8');
  }

  // Ejecutar Importación
  const btnExecuteImport = document.getElementById('btnExecuteImport');
  if (btnExecuteImport) {
    btnExecuteImport.addEventListener('click', async () => {
      const isFileTab = sectionOptionFile.style.display !== 'none';
      const sheetsUrl = document.getElementById('csvUrlInput').value.trim();

      if (isFileTab && !selectedCsvText) {
        alert('Por favor selecciona un archivo .CSV antes de importar.');
        return;
      }
      if (!isFileTab && !sheetsUrl) {
        alert('Por favor ingresa el enlace de Google Sheets.');
        return;
      }

      btnExecuteImport.disabled = true;
      btnExecuteImport.textContent = '⏳ IMPORTANDO...';

      const importStatusResult = document.getElementById('importStatusResult');
      const importStatusText = document.getElementById('importStatusText');
      importStatusResult.style.display = 'none';

      try {
        const payload = isFileTab ? { csvText: selectedCsvText } : { sheetsUrl };
        const response = await fetch('/api/products/import-csv', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (result.success) {
          importStatusResult.className = 'alert-banner text-success';
          importStatusResult.style.display = 'block';
          importStatusText.innerHTML = `
            <strong>✅ Importación completada con éxito:</strong><br>
            • ${result.stats.importedCount} productos nuevos insertados<br>
            • ${result.stats.updatedCount} productos actualizados<br>
            • ${result.stats.categoryCount} categorías procesadas<br>
            • ${result.stats.brandCount} marcas procesadas
          `;

          if (typeof loadProducts === 'function') loadProducts();
          if (typeof loadCategories === 'function') loadCategories();
        } else {
          importStatusResult.className = 'alert-banner text-danger';
          importStatusResult.style.display = 'block';
          importStatusText.textContent = '❌ Error: ' + (result.error || 'Error en el formato de importación');
        }
      } catch (err) {
        importStatusResult.className = 'alert-banner text-danger';
        importStatusResult.style.display = 'block';
        importStatusText.textContent = '❌ Error de comunicación con el servidor: ' + err.message;
      } finally {
        btnExecuteImport.disabled = false;
        btnExecuteImport.textContent = '⚡ IMPORTAR AHORA';
      }
    });
  }

  // Verificar conectividad cada 30 segundos
  setInterval(checkConnectivity, 30000);
  checkConnectivity();
});

function checkConnectivity() {
  fetch('https://www.google.com/favicon.ico', { mode: 'no-cors', cache: 'no-cache' })
    .then(() => {
      State.internetAvailable = true;
      const pill = document.getElementById('sunatStatusPill');
      if (pill) {
        const pendingCount = parseInt(document.getElementById('sunatStatPending').textContent);
        if (pendingCount > 0) {
          pill.title = '¡Hay comprobantes pendientes! Haz clic en "Sincronizar con SUNAT"';
        }
      }
    })
    .catch(() => { State.internetAvailable = false; });
}
