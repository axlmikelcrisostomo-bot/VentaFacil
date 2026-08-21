/**
 * ====================================================================
 * VentaFácil POS - App Controller Principal (Conexión Total a SQLite)
 * Modo Alta Velocidad: Numpad Táctil + Lista Compacta + Chips Categorías
 * ====================================================================
 */

// ============================================================
// SISTEMA MODERNO DE NOTIFICACIONES TOAST & DIÁLOGOS VISUALES
// ============================================================
let sysDialogResolver = null;

function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast-item toast-${type}`;

  const iconMap = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };

  const titleMap = {
    success: 'Operación Exitosa',
    error: 'Error',
    warning: 'Advertencia',
    info: 'Notificación'
  };

  const icon = iconMap[type] || 'ℹ️';
  const title = titleMap[type] || 'Aviso';

  toast.innerHTML = `
    <div class="toast-icon">${icon}</div>
    <div class="toast-content">
      <span class="toast-title">${title}</span>
      <div class="toast-message">${String(message).replace(/\n/g, '<br>')}</div>
    </div>
    <button class="toast-close" title="Cerrar">&times;</button>
  `;

  const closeBtn = toast.querySelector('.toast-close');
  const dismiss = () => {
    toast.classList.add('toast-hiding');
    setTimeout(() => toast.remove(), 250);
  };

  if (closeBtn) closeBtn.addEventListener('click', dismiss);
  container.appendChild(toast);

  if (duration > 0) {
    setTimeout(dismiss, duration);
  }
}

function showAppAlert(message, title = 'Notificación', type = 'info') {
  return new Promise((resolve) => {
    sysDialogResolver = resolve;
    const modal = document.getElementById('systemDialogModal');
    const titleEl = document.getElementById('sysDialogTitle');
    const msgEl = document.getElementById('sysDialogMessage');
    const iconEl = document.getElementById('sysDialogIcon');
    const cancelBtn = document.getElementById('btnSysDialogCancel');
    const confirmBtn = document.getElementById('btnSysDialogConfirm');

    if (!modal) return resolve(true);

    const iconMap = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };

    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = message;
    if (iconEl) iconEl.textContent = iconMap[type] || (type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️');
    if (cancelBtn) cancelBtn.style.display = 'none';
    if (confirmBtn) {
      confirmBtn.textContent = 'Aceptar';
      confirmBtn.className = type === 'error' ? 'btn-danger' : 'btn-primary';
    }

    openModal('systemDialogModal');
  });
}

function showAppConfirm(message, title = 'Confirmar Acción', type = 'warning', confirmText = 'Aceptar', cancelText = 'Cancelar') {
  return new Promise((resolve) => {
    sysDialogResolver = resolve;
    const modal = document.getElementById('systemDialogModal');
    const titleEl = document.getElementById('sysDialogTitle');
    const msgEl = document.getElementById('sysDialogMessage');
    const iconEl = document.getElementById('sysDialogIcon');
    const cancelBtn = document.getElementById('btnSysDialogCancel');
    const confirmBtn = document.getElementById('btnSysDialogConfirm');

    if (!modal) return resolve(false);

    const iconMap = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: '❓'
    };

    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = message;
    if (iconEl) iconEl.textContent = iconMap[type] || '⚠️';
    if (cancelBtn) {
      cancelBtn.style.display = 'inline-block';
      cancelBtn.textContent = cancelText;
    }
    if (confirmBtn) {
      confirmBtn.textContent = confirmText;
      confirmBtn.className = type === 'danger' || type === 'error' || type === 'warning' ? 'btn-danger' : 'btn-primary';
    }

    openModal('systemDialogModal');
  });
}

// Reemplazo visual global de alert() para todas las llamadas del sistema
window.alert = (msg) => {
  const isErr = String(msg).includes('❌') || String(msg).toLowerCase().includes('error');
  const isSuccess = String(msg).includes('✅') || String(msg).toLowerCase().includes('éxito') || String(msg).toLowerCase().includes('guardado');
  const isWarn = String(msg).includes('⚠️') || String(msg).toLowerCase().includes('atención') || String(msg).toLowerCase().includes('advertencia');
  const type = isErr ? 'error' : isSuccess ? 'success' : isWarn ? 'warning' : 'info';
  const cleanMsg = String(msg).replace(/^[✅❌⚠️ℹ️]\s*/, '').trim();

  if (cleanMsg.length > 70 || isErr) {
    showAppAlert(cleanMsg, isErr ? 'Error' : isSuccess ? 'Operación Exitosa' : 'Aviso', type);
  } else {
    showToast(cleanMsg, type);
  }
};

// ============================================================
// 1. ESTADO GLOBAL DE LA APLICACIÓN POS
// ============================================================
const State = {
  cart: [],
  products: [],
  customers: [],
  categories: [],
  salesHistory: [],
  sunatConfig: null,
  activeCustomerForDetail: null,
  selectedCategoryId: '',
  catalogMode: 'frequent', // 'frequent' (predeterminado) o 'all'
  frequentProductIds: JSON.parse(localStorage.getItem('vf_frequent_products') || '[]'),
  documentType: '03' // 03=Boleta, 01=Factura, 00=Ticket interno
};

let checkoutPayMode = 'pay';
let checkoutPayMethod = 'EFECTIVO';
let editingSku = null;

// ============================================================
// 2. FUNCIONES DE CARGA ASÍNCRONA (API SQLite)
// ============================================================
async function loadProducts(searchTerm = '', categoryId = null) {
  try {
    let url = '/api/products?';
    if (searchTerm) url += `search=${encodeURIComponent(searchTerm)}&`;
    if (categoryId) url += `categoryId=${encodeURIComponent(categoryId)}&`;

    const res = await fetch(url);
    const json = await res.json();
    if (json.success) {
      State.products = json.data || [];
      renderProductListTable(State.products);
      renderProductGrid(State.products);
      renderInventory(State.products);
    }
  } catch (err) {
    console.error('Error cargando productos:', err);
  }
}

async function loadCategories() {
  try {
    const res = await fetch('/api/categories');
    const json = await res.json();
    if (json.success) {
      State.categories = json.data || [];
      renderCategoryChips(State.categories);
      renderCategorySelects(State.categories);
      renderCategoriesTable(State.categories);
    }
  } catch (err) {
    console.error('Error cargando categorías:', err);
  }
}

async function loadCustomers() {
  try {
    const res = await fetch('/api/customers');
    const json = await res.json();
    if (json.success) {
      State.customers = json.data || [];
      renderFiadoGrid(State.customers);
      renderCustomerSelects(State.customers);
    }
  } catch (err) {
    console.error('Error cargando clientes:', err);
  }
}

async function loadSalesHistory() {
  try {
    const res = await fetch('/api/sales');
    const json = await res.json();
    if (json.success) {
      State.sales = json.data || [];
      renderSalesHistory(State.sales);
      renderSunatTable(State.sales);
    }
  } catch (err) {
    console.error('Error cargando historial de ventas:', err);
  }
}

async function loadSunatConfig() {
  try {
    const res = await fetch('/api/sunat/config');
    const json = await res.json();
    if (json.success && json.data) {
      State.currentSunatConfig = json.data;
      const cfg = json.data;
      if (document.getElementById('cfgRuc')) document.getElementById('cfgRuc').textContent = cfg.ruc || '—';
      if (document.getElementById('cfgRazonSocial')) document.getElementById('cfgRazonSocial').textContent = cfg.razon_social || '—';
      if (document.getElementById('cfgNombreComercial')) document.getElementById('cfgNombreComercial').textContent = cfg.nombre_comercial || '—';
      if (document.getElementById('cfgDireccion')) document.getElementById('cfgDireccion').textContent = cfg.direccion || '—';
      if (document.getElementById('cfgAmbiente')) {
        document.getElementById('cfgAmbiente').textContent = cfg.is_production ? '🟢 PRODUCCIÓN' : '🟡 BETA (Pruebas)';
      }
      if (document.getElementById('tplSunatRuc')) document.getElementById('tplSunatRuc').value = cfg.ruc || '';
      if (document.getElementById('tplSunatRazonSocial')) document.getElementById('tplSunatRazonSocial').value = cfg.razon_social || '';
      if (document.getElementById('tplSunatDireccion')) document.getElementById('tplSunatDireccion').value = cfg.direccion || '';
    }
  } catch (err) {
    console.error('Error cargando configuración SUNAT:', err);
  }
}

// ============================================================
// 3. BARRA DE CHIPS DE CATEGORÍAS
// ============================================================
function renderCategoryChips(categories) {
  const container = document.getElementById('categoryChips');
  if (!container) return;

  const categoryIcons = {
    'ASEO': '🧴',
    'SALUD': '💊',
    'ABARROTES': '🥫',
    'BEBIDAS': '🥤',
    'LIMPIEZA': '🧹',
    'LACTEOS': '🧀',
    'CARNICOS': '🥩',
    'CRUDO': '🥩',
    'GRANEL': '⚖️',
    'PANADERIA': '🥖',
    'GOLOSINAS': '🍬',
    'SNACKS': '🍿',
    'CUIDADO': '🧴',
    'BELLEZA': '✨'
  };

  function getIconForCat(name) {
    const upper = name.toUpperCase();
    for (const [key, icon] of Object.entries(categoryIcons)) {
      if (upper.includes(key)) return icon;
    }
    return '🏷️';
  }

  let html = `<button class="cat-chip ${State.selectedCategoryId === '' ? 'active' : ''}" data-cat="">⚡ Todos (${State.products.length})</button>`;
  
  categories.forEach(c => {
    const icon = getIconForCat(c.name);
    // Contar según el modo activo y búsqueda actual (no solo total)
    const searchTerm = (document.getElementById('posSearchInput')?.value || '').trim();
    let poolForCount = State.products;
    if (State.catalogMode === 'frequent') {
      poolForCount = State.products.filter(p => State.frequentProductIds.includes(String(p.sku || p.barcode || p.id)));
    }
    if (searchTerm) {
      poolForCount = poolForCount.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    const count = poolForCount.filter(p => p.category_id === c.id).length;
    html += `<button class="cat-chip ${String(State.selectedCategoryId) === String(c.id) ? 'active' : ''}" data-cat="${c.id}">${icon} ${c.name} ${count > 0 ? `(${count})` : ''}</button>`;
  });

  container.innerHTML = html;

  container.querySelectorAll('.cat-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.cat-chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      State.selectedCategoryId = btn.dataset.cat;
      const term = document.getElementById('posSearchInput')?.value || '';
      loadProducts(term, State.selectedCategoryId || null);
    });
  });
}

// ============================================================
// 4. RENDERIZADORES DE CATÁLOGO (LISTA COMPACTA & GRILLA)
// ============================================================
function toggleFrequentProduct(barcodeKey) {
  const key = String(barcodeKey);
  const idx = State.frequentProductIds.indexOf(key);
  if (idx >= 0) {
    State.frequentProductIds.splice(idx, 1);
  } else {
    State.frequentProductIds.push(key);
  }
  localStorage.setItem('vf_frequent_products', JSON.stringify(State.frequentProductIds));
  renderProductListTable(State.products);
}

function switchToAllCatalog() {
  const btnModeAll = document.getElementById('btnModeAll');
  if (btnModeAll) btnModeAll.click();
}

function renderProductListTable(products) {
  const tbody = document.getElementById('posProductTableBody');
  if (!tbody) return;

  let displayProducts = products || [];
  const searchTerm = (document.getElementById('posSearchInput')?.value || '').trim();

  // Si estamos en modo Frecuentes, mostrar ÚNICAMENTE los productos guardados por el cliente
  if (State.catalogMode === 'frequent') {
    displayProducts = (products || []).filter(p => {
      const key = String(p.sku || p.barcode || p.id);
      return State.frequentProductIds.includes(key);
    });

    if (searchTerm) {
      displayProducts = displayProducts.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (p.barcode && p.barcode.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    if (!displayProducts.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:45px 20px; color:var(--text-muted);">
        <span style="font-size:36px; display:block; margin-bottom:10px;">⭐</span>
        <strong style="font-size:15px; color:var(--text-main); display:block; margin-bottom:6px;">No tienes productos frecuentes aún</strong>
        <p style="font-size:12.5px; margin-bottom:14px; max-width:420px; margin-left:auto; margin-right:auto; line-height:1.4;">
          Haz clic en <strong>"Catálogo Completo"</strong> y presiona la estrella <strong>(☆)</strong> en tus productos más vendidos para fijarlos aquí.
        </p>
        <button type="button" class="btn-primary btn-sm" onclick="switchToAllCatalog()" style="padding:7px 16px;">
          📦 Ir al Catálogo Completo
        </button>
      </td></tr>`;
      return;
    }
  }

  if (!displayProducts || !displayProducts.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:35px; color:var(--text-muted);">
      <span style="font-size:24px; display:block; margin-bottom:6px;">📦</span>
      <strong>No se encontraron productos</strong><br>
      <small>Prueba buscando con otro término o limpia los filtros de categoría.</small>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = displayProducts.map(p => {
    const isLow = p.stock <= p.min_stock;
    const typeLabel = p.is_bulk ? '🥩 Granel/Kg' : (p.unit_measure || 'UNIDAD');
    const brandName = p.brand_name ? `<span class="prod-brand-cell">${p.brand_name} · </span>` : '';
    const itemKey = String(p.sku || p.barcode || p.id);
    const isFav = State.frequentProductIds.includes(itemKey);
    const displayCode = p.sku || '—';

    return `
      <tr onclick="addToCart('${itemKey}')" title="Clic para añadir al carrito">
        <td style="text-align:center;" onclick="event.stopPropagation();">
          <button type="button" class="btn-star-fav ${isFav ? 'active' : ''}" onclick="toggleFrequentProduct('${itemKey}')" title="${isFav ? 'Quitar de frecuentes' : 'Fijar en frecuentes'}">
            ${isFav ? '⭐' : '☆'}
          </button>
        </td>
        <td><span class="prod-sku-badge">${displayCode}</span></td>
        <td><span class="prod-name-cell">${p.name}</span></td>
        <td><span class="prod-brand-cell">${brandName}${p.category_name || 'General'}</span></td>
        <td>
          <span class="prod-stock-cell ${isLow ? 'low' : ''}">
            ${isLow ? '⚠️ ' : ''}${parseFloat(p.stock).toFixed(p.is_bulk ? 3 : 0)} ${typeLabel}
          </span>
        </td>
        <td class="prod-price-cell">S/.&nbsp;${parseFloat(p.sale_price).toFixed(2)}</td>
        <td style="text-align:center;">
          <button class="btn-add-table" onclick="event.stopPropagation(); addToCart('${itemKey}')" title="Añadir">+</button>
        </td>
      </tr>`;
  }).join('');
}

function renderProductGrid(products) {
  const grid = document.getElementById('productGrid');
  if (!grid) return;

  if (!products || !products.length) {
    grid.innerHTML = `
      <div class="loading-state" style="padding: 40px; text-align: center; grid-column: 1/-1;">
        <span style="font-size: 40px; display: block; margin-bottom: 10px;">📦</span>
        <p style="font-size: 15px; color: var(--text-main); font-weight: 600; margin-bottom: 6px;">Catálogo vacío</p>
      </div>`;
    return;
  }

  grid.innerHTML = products.map(p => {
    const isLow = p.stock <= p.min_stock;
    const typeLabel = p.is_bulk ? '🥩 PESABLE/Kg' : `📦 ${p.unit_measure || 'UNIDAD'}`;
    const brandName = p.brand_name ? `${p.brand_name} · ` : '';
    const itemKey = p.sku || p.barcode || p.id;
    return `
      <div class="product-card ${p.is_bulk ? 'bulk-card' : ''}" onclick="addToCart('${itemKey}')" title="SKU: ${p.sku || p.barcode}">
        <span class="product-card-type">${typeLabel}</span>
        <h4>${p.name}</h4>
        <small class="category-name">${brandName}${p.category_name || 'General'}</small>
        <div class="price-row">
          <span class="price">S/. ${parseFloat(p.sale_price).toFixed(2)}</span>
          <span class="stock-indicator ${isLow ? 'low' : ''}">
            ${isLow ? '⚠️ ' : ''}${parseFloat(p.stock).toFixed(p.is_bulk ? 3 : 0)} ${p.unit_measure || 'UNIDAD'}
          </span>
        </div>
      </div>`;
  }).join('');
}

let pendingWeighProduct = null;
let weighInputNeedsReset = true;

function getIconForProduct(product) {
  const name = (product && product.name ? product.name : '').toLowerCase();
  if (name.includes('pollo') || name.includes('pechuga') || name.includes('carne') || name.includes('res') || name.includes('cerdo')) return '🥩';
  if (name.includes('papa') || name.includes('camote') || name.includes('yuca')) return '🥔';
  if (name.includes('cebolla')) return '🧅';
  if (name.includes('tomate')) return '🍅';
  if (name.includes('queso')) return '🧀';
  if (name.includes('jamon') || name.includes('embutido') || name.includes('tocino')) return '🥓';
  if (name.includes('huevo')) return '🥚';
  if (name.includes('mandarina') || name.includes('naranja') || name.includes('manzana') || name.includes('fruta')) return '🍊';
  if (name.includes('arroz') || name.includes('lenteja') || name.includes('frijol')) return '🌾';
  return '⚖️';
}

function openWeighModal(product, focusSearch = false) {
  const bulkProds = State.products.filter(p => p.is_bulk || p.unit_measure === 'KG');
  if (!product) {
    product = bulkProds.length > 0 ? bulkProds[0] : {
      barcode: 'GRANEL-GENERICO',
      name: '🥩 Producto a Granel / Balanza',
      sale_price: 10.00,
      unit_measure: 'KG',
      is_bulk: 1
    };
  }

  pendingWeighProduct = product;
  weighInputNeedsReset = true;

  if (document.getElementById('weighProdName')) {
    document.getElementById('weighProdName').textContent = product.name;
  }
  if (document.getElementById('weighProdPrice')) {
    document.getElementById('weighProdPrice').textContent = `Precio: S/. ${parseFloat(product.sale_price).toFixed(2)} / ${product.unit_measure || 'KG'}`;
  }
  if (document.getElementById('weighProdIcon')) {
    document.getElementById('weighProdIcon').textContent = getIconForProduct(product);
  }

  renderWeighChips(product);

  const searchInput = document.getElementById('weighSearchInput');
  if (searchInput) searchInput.value = '';
  const searchResults = document.getElementById('weighSearchResults');
  if (searchResults) searchResults.style.display = 'none';
  const clearBtn = document.getElementById('btnClearWeighSearch');
  if (clearBtn) clearBtn.style.display = 'none';

  const input = document.getElementById('weighInputKg');
  if (input) input.value = '1.000';

  updateWeighTotal();
  openModal('weighModal');

  setTimeout(() => {
    if (focusSearch && searchInput) {
      searchInput.focus();
      searchInput.select();
    } else if (input) {
      input.focus();
      input.select();
    }
  }, 100);
}

function renderWeighChips(activeProduct) {
  const container = document.getElementById('weighBulkChips');
  if (!container) return;

  const bulkProds = State.products.filter(p => p.is_bulk || p.unit_measure === 'KG');
  if (bulkProds.length === 0) {
    container.innerHTML = `<span style="font-size:11px; color:var(--text-muted);">Sin otros productos a granel</span>`;
    return;
  }

  const activeKey = activeProduct ? String(activeProduct.id || activeProduct.barcode) : null;

  container.innerHTML = bulkProds.map(p => {
    const key = String(p.id || p.barcode);
    const isActive = key === activeKey;
    const icon = getIconForProduct(p);
    return `<button type="button" class="weigh-chip-btn ${isActive ? 'active' : ''}" data-id="${key}">
      <span>${icon} ${p.name}</span>
      <small style="opacity:0.85">S/.${parseFloat(p.sale_price).toFixed(2)}</small>
    </button>`;
  }).join('');

  container.querySelectorAll('.weigh-chip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.id;
      const selected = bulkProds.find(p => String(p.id) === key || p.barcode === key);
      if (selected) {
        openWeighModal(selected, false);
      }
    });
  });
}

function setupWeighBulkSearch() {
  const searchInput = document.getElementById('weighSearchInput');
  const searchResults = document.getElementById('weighSearchResults');
  const clearBtn = document.getElementById('btnClearWeighSearch');
  if (!searchInput || !searchResults) return;

  const performSearch = () => {
    const q = searchInput.value.trim().toLowerCase();
    if (!q) {
      searchResults.style.display = 'none';
      if (clearBtn) clearBtn.style.display = 'none';
      return;
    }
    if (clearBtn) clearBtn.style.display = 'block';

    let matches = State.products.filter(p => p.is_bulk || p.unit_measure === 'KG');
    if (matches.length === 0) matches = State.products;

    matches = matches.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.toLowerCase().includes(q))
    ).slice(0, 8);

    if (matches.length === 0) {
      searchResults.innerHTML = `<div style="padding: 12px; font-size: 13px; color: var(--text-muted); text-align: center;">No se encontraron graneles con "${q}"</div>`;
    } else {
      searchResults.innerHTML = matches.map(p => {
        const icon = getIconForProduct(p);
        const key = String(p.id || p.barcode);
        return `<div class="weigh-search-item" data-id="${key}">
          <div class="item-main">
            <span class="item-icon">${icon}</span>
            <div>
              <div class="item-title">${p.name}</div>
              <div class="item-subtitle">Cód: ${p.barcode || '-'} | Stock: ${parseFloat(p.stock || 0).toFixed(3)} Kg</div>
            </div>
          </div>
          <span class="item-price-badge">S/. ${parseFloat(p.sale_price).toFixed(2)} / Kg</span>
        </div>`;
      }).join('');

      searchResults.querySelectorAll('.weigh-search-item').forEach(item => {
        item.addEventListener('click', () => {
          const key = item.dataset.id;
          const selected = State.products.find(p => String(p.id) === key || p.barcode === key);
          if (selected) {
            openWeighModal(selected, false);
          }
        });
      });
    }

    searchResults.style.display = 'block';
  };

  searchInput.addEventListener('input', performSearch);
  searchInput.addEventListener('focus', performSearch);

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const firstItem = searchResults.querySelector('.weigh-search-item');
      if (firstItem) {
        firstItem.click();
      }
    } else if (e.key === 'Escape') {
      searchResults.style.display = 'none';
    }
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      searchResults.style.display = 'none';
      clearBtn.style.display = 'none';
      searchInput.focus();
    });
  }

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.weigh-search-wrapper')) {
      searchResults.style.display = 'none';
    }
  });
}

function updateWeighTotal() {
  if (!pendingWeighProduct) return;
  const input = document.getElementById('weighInputKg');
  const weight = parseFloat(input ? input.value : 0) || 0;
  const unitPrice = parseFloat(pendingWeighProduct.sale_price || 0);
  const total = weight * unitPrice;
  const preview = document.getElementById('weighTotalPreview');
  if (preview) preview.textContent = `S/. ${total.toFixed(2)}`;
  const formula = document.getElementById('weighFormulaText');
  if (formula) formula.textContent = `${weight.toFixed(3)} Kg × S/. ${unitPrice.toFixed(2)}`;

  // Marcar botón preset activo si coincide
  document.querySelectorAll('.btn-weigh-big').forEach(btn => {
    const btnW = parseFloat(btn.dataset.weight);
    if (Math.abs(btnW - weight) < 0.001) btn.classList.add('active');
    else btn.classList.remove('active');
  });
}

function addToCart(productId) {
  let product = State.products.find(p => p.sku === String(productId) || p.barcode === String(productId) || p.id === productId);
  if (!product && typeof productId === 'object') product = productId;
  if (!product) return;

  if (product.is_bulk) {
    openWeighModal(product);
    return;
  }

  const key = product.sku || product.barcode || product.id;
  const existing = State.cart.find(i => (i.sku || i.barcode || i.id) === key);
  if (existing) existing.quantity += 1;
  else State.cart.push({ ...product, quantity: 1 });

  renderCart();
  const scanner = document.getElementById('globalBarcodeScanner');
  if (scanner) scanner.focus();
}

function removeFromCart(productId) {
  State.cart = State.cart.filter(i => (i.sku || i.barcode || i.id) !== productId);
  renderCart();
}

function changeQty(productId, delta) {
  const item = State.cart.find(i => (i.sku || i.barcode || i.id) === productId);
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

  if (document.getElementById('cartItemsCount')) document.getElementById('cartItemsCount').textContent = `${State.cart.length} ítems`;
  if (document.getElementById('cartSubtotalGravada')) document.getElementById('cartSubtotalGravada').textContent = `S/. ${subtotalGravada.toFixed(2)}`;
  if (document.getElementById('cartIgv')) document.getElementById('cartIgv').textContent = `S/. ${igv.toFixed(2)}`;
  if (document.getElementById('cartTotal')) document.getElementById('cartTotal').textContent = `S/. ${total.toFixed(2)}`;

  if (!tbody) return;

  if (!State.cart.length) {
    tbody.innerHTML = `<tr class="empty-cart-row"><td colspan="5"><div class="empty-cart-state"><span class="empty-icon">🛒</span><p>Escanee un código de barras o SKU<br>o haga clic en un producto</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = State.cart.map(item => {
    const lineTotal = item.sale_price * item.quantity;
    const itemKey = item.sku || item.barcode || item.id;
    return `
      <tr class="cart-item-row">
        <td class="cart-col-qty">
          <div class="qty-controls">
            <button type="button" class="btn-qty" onclick="changeQty('${itemKey}', -${item.is_bulk ? 0.1 : 1})">−</button>
            <span class="qty-number">${item.is_bulk ? item.quantity.toFixed(2) : item.quantity}</span>
            <button type="button" class="btn-qty" onclick="changeQty('${itemKey}', ${item.is_bulk ? 0.1 : 1})">+</button>
          </div>
        </td>
        <td class="cart-col-info">
          <div class="cart-item-title">${item.name}</div>
          <div class="cart-item-meta">
            <span class="cart-item-barcode">${item.sku || item.barcode}</span>
            ${item.is_bulk ? '<span class="cart-item-bulk-tag">Kg</span>' : ''}
          </div>
        </td>
        <td class="cart-col-price">
          <span class="cart-unit-price">S/.${parseFloat(item.sale_price).toFixed(2)}</span>
        </td>
        <td class="cart-col-total">
          <strong class="cart-line-total">S/.${lineTotal.toFixed(2)}</strong>
        </td>
        <td class="cart-col-remove">
          <button type="button" class="btn-cart-remove" onclick="removeFromCart('${itemKey}')" title="Quitar">✕</button>
        </td>
      </tr>`;
  }).join('');

  // Actualizar vista previa del ticket cada vez que cambia el carrito
  renderTicketPreview();
}

// ============================================================
// VISTA PREVIA DEL TICKET
// ============================================================
function renderTicketPreview() {
  const previewEl = document.getElementById('ticketPreviewContent');
  if (!previewEl) return;

  if (!State.cart.length) {
    previewEl.textContent = 'Agregue productos al carrito\npara ver la vista previa...';
    return;
  }

  const tplCfg = TicketTemplateConfig ? TicketTemplateConfig.get() : {};
  const companyName = tplCfg.companyName || 'COMERCIAL BELEZA & HOGAR';
  const ruc = tplCfg.ruc || '20601234567';
  const address = tplCfg.address || 'Av. Las Flores 456, Lima';
  const footer1 = tplCfg.footer1 || '¡Gracias por su preferencia!';
  const footer2 = tplCfg.footer2 || 'Conserve este comprobante';
  const W = tplCfg.columns || 32;

  const cText = (t) => {
    const s = String(t || '').trim();
    if (s.length >= W) return s.substring(0, W);
    return ' '.repeat(Math.floor((W - s.length) / 2)) + s;
  };
  const jBetween = (l, r) => {
    const ls = String(l || '');
    const rs = String(r || '');
    const maxL = W - rs.length - 1;
    const tl = ls.length > maxL ? ls.substring(0, maxL) : ls;
    return tl + ' '.repeat(Math.max(1, W - tl.length - rs.length)) + rs;
  };
  const divLine = (c = '-') => c.repeat(W);

  // Resolver etiqueta de unidad de medida
  const resolveUnit = (item) => {
    if (item.is_bulk) return 'KG';
    const raw = String(item.unit_measure || '').toUpperCase();
    if (['KG','KGM','KILOGRAMO','GRANEL'].includes(raw)) return 'KG';
    if (['BOT','BOTELLA'].includes(raw)) return 'BOT';
    if (['BLS','BOLSA'].includes(raw)) return 'BLS';
    if (['PAQ','PAQUETE'].includes(raw)) return 'PAQ';
    if (['LT','LTR','LITRO'].includes(raw)) return 'LT';
    if (raw && raw.length <= 5) return raw;
    return 'UND';
  };

  const docType = State.documentType || '00';
  const isBve = docType === '03';
  const isFactura = docType === '01';
  const docTitle = isFactura ? 'FACTURA ELECTRONICA' : isBve ? 'BOLETA DE VENTA ELEC.' : 'TICKET DE VENTA';
  const total = State.cart.reduce((s, i) => s + (i.sale_price * i.quantity), 0);
  const now = new Date().toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' });

  const lines = [];
  lines.push(cText(companyName));
  lines.push(cText('RUC: ' + ruc));
  lines.push(cText(address));
  lines.push(divLine('='));
  lines.push(cText(docTitle));
  lines.push(cText('VISTA PREVIA'));
  lines.push(divLine('-'));
  lines.push(jBetween('FECHA:', now));
  lines.push(jBetween('CAJERO:', 'Caja 1'));
  lines.push(jBetween('CLIENTE:', 'CLIENTE GENERAL'));
  lines.push(divLine('-'));
  lines.push(jBetween('CANT/UNID  x  P.UNIT', 'TOTAL'));
  lines.push(divLine('-'));

  State.cart.forEach(item => {
    const qty = item.quantity;
    const unit = resolveUnit(item);
    const isKg = ['KG','GR'].includes(unit);
    const qtyFmt = isKg ? qty.toFixed(3) : String(parseInt(qty));
    const name = (item.name || 'Producto').substring(0, W);
    const price = parseFloat(item.sale_price);
    const subtotal = price * qty;
    lines.push(name);
    lines.push(jBetween(`${qtyFmt} ${unit} x S/.${price.toFixed(2)}`, `S/.${subtotal.toFixed(2)}`));
  });

  lines.push(divLine('-'));
  if (isBve || isFactura) {
    const base = total / 1.18;
    const igv = total - base;
    lines.push(jBetween('OP. GRAVADA:', `S/.${base.toFixed(2)}`));
    lines.push(jBetween('I.G.V. (18%):', `S/.${igv.toFixed(2)}`));
  } else {
    lines.push(jBetween('SUBTOTAL:', `S/.${total.toFixed(2)}`));
  }
  lines.push(divLine('-'));
  lines.push(jBetween('TOTAL A PAGAR:', `S/.${total.toFixed(2)}`));
  lines.push(divLine('-'));
  lines.push(divLine('='));
  lines.push(jBetween('FORMA DE PAGO:', 'EFECTIVO'));
  lines.push(divLine('='));
  lines.push(cText(footer1));
  if (footer2) lines.push(cText(footer2));
  lines.push(divLine('='));

  previewEl.textContent = lines.join('\n');
}


// ============================================================
// 5. BÚSQUEDA Y ESCÁNER DE CÓDIGOS DE BARRAS & SKU
// ============================================================
async function searchByBarcode(barcode) {
  const clean = barcode.trim();
  if (!clean) return;

  let product = State.products.find(p => 
    (p.barcode && p.barcode.toLowerCase() === clean.toLowerCase()) || 
    (p.sku && p.sku.toLowerCase() === clean.toLowerCase())
  );

  if (!product) {
    product = State.products.find(p => p.name.toLowerCase().includes(clean.toLowerCase()));
  }

  if (!product) {
    try {
      const res = await fetch(`/api/products/barcode/${encodeURIComponent(clean)}`);
      const json = await res.json();
      if (json.success && json.data) {
        product = json.data;
      }
    } catch (e) {}
  }

  if (product) {
    addToCart(product.sku || product.barcode || product.id);
    const sc = document.getElementById('globalBarcodeScanner');
    if (sc) sc.value = '';
    showToast(`✅ Añadido: ${product.sku || ''} · ${product.name}`, 'success');

    // Activar dot del escáner brevemente (indica actividad del lector)
    const dotScanner = document.getElementById('dotScanner');
    if (dotScanner) {
      dotScanner.className = 'status-dot dot-green';
      clearTimeout(dotScanner._scannerTimer);
      dotScanner._scannerTimer = setTimeout(() => {
        dotScanner.className = 'status-dot dot-gray';
      }, 3000);
    }

  } else {
    showToast(`❌ Producto no encontrado para "${clean}"`, 'warning');
    const sc = document.getElementById('globalBarcodeScanner');
    if (sc) sc.value = '';
  }
}

// ============================================================
// 6. RENDERIZADO DE FIADOS / CLIENTES (PROTASK DESIGN)
// ============================================================
function renderFiadoGrid(customers) {
  const grid = document.getElementById('fiadoCustomerGrid');
  if (!grid) return;

  let totalDebt = 0;
  let withDebt = 0;

  if (!customers.length) {
    grid.innerHTML = `
      <div class="loading-state" style="grid-column:1/-1; padding:40px; text-align:center;">
        <span style="font-size:40px;">👥</span>
        <p style="margin-top:10px; font-weight:600;">No hay clientes registrados aún</p>
        <small style="color:var(--text-muted);">Haga clic en "+ Nuevo Cliente" para registrar su primer cliente.</small>
      </div>`;
    return;
  }

  grid.innerHTML = customers.map(c => {
    const debt = parseFloat(c.current_debt || 0);
    const limit = parseFloat(c.credit_limit || 0);
    const available = Math.max(0, limit - debt);
    const pct = limit > 0 ? Math.min(100, (debt / limit) * 100) : 0;
    totalDebt += debt;
    if (debt > 0) withDebt++;

    return `
      <div class="fiado-card ${debt > 0 ? 'has-debt' : ''}">
        <div class="fiado-card-header">
          <div>
            <h4>${c.name}</h4>
            <span class="fiado-doc">DNI/RUC: ${c.document_number || '—'} · Tel: ${c.phone || '—'}</span>
          </div>
          <span class="fiado-status-badge ${debt > 0 ? 'badge-danger' : 'badge-success'}">
            ${debt > 0 ? 'CON DEUDA' : 'AL DÍA'}
          </span>
        </div>

        <div class="fiado-amounts">
          <div class="fiado-amount-box debt">
            <span class="label">Deuda Actual</span>
            <strong class="value">S/. ${debt.toFixed(2)}</strong>
          </div>
          <div class="fiado-amount-box limit">
            <span class="label">Límite Crédito</span>
            <strong class="value">S/. ${limit.toFixed(2)}</strong>
          </div>
          <div class="fiado-amount-box available">
            <span class="label">Disponible</span>
            <strong class="value">S/. ${available.toFixed(2)}</strong>
          </div>
        </div>

        <div class="credit-bar-wrapper">
          <div class="credit-bar-fill ${pct > 80 ? 'danger' : (pct > 50 ? 'warning' : 'ok')}" style="width:${pct}%"></div>
        </div>

        <div class="fiado-card-actions">
          <button class="btn-secondary btn-sm" onclick="openCustomerDetailModal(${c.id})">📋 Detalle</button>
          <button class="btn-success btn-sm" onclick="openAbonoModal(${c.id})">💵 Abonar</button>
          <button class="btn-primary btn-sm" onclick="editCustomer(${c.id})" title="Editar datos del cliente">✏️</button>
          <button class="btn-danger btn-sm" onclick="deleteCustomer(${c.id})" title="Eliminar cliente">🗑️</button>
        </div>
      </div>`;
  }).join('');

  if (document.getElementById('statsDebtors')) document.getElementById('statsDebtors').textContent = `${withDebt} clientes`;
  if (document.getElementById('statsTotalDebt')) document.getElementById('statsTotalDebt').textContent = `S/. ${totalDebt.toFixed(2)}`;
  if (document.getElementById('statsGoodStanding')) document.getElementById('statsGoodStanding').textContent = `${customers.length - withDebt} clientes`;
}

function renderCustomerSelects(customers) {
  const select = document.getElementById('coFiadoSelect');
  if (!select) return;
  select.innerHTML = `<option value="">-- Seleccionar Cliente para Fiado --</option>` +
    customers.map(c => `<option value="${c.id}">${c.name} (Deuda: S/. ${parseFloat(c.current_debt || 0).toFixed(2)})</option>`).join('');
}

async function openCustomerDetailModal(customerId) {
  const c = State.customers.find(x => x.id === customerId);
  if (!c) return;

  State.activeCustomerForDetail = c;
  const debt = parseFloat(c.current_debt || 0);
  const limit = parseFloat(c.credit_limit || 0);
  const available = Math.max(0, limit - debt);

  document.getElementById('fiadoDetailTitle').textContent = `📋 Historial de Fiados — ${c.name}`;
  document.getElementById('fiadoDetailSubtitle').textContent = `DNI/RUC: ${c.document_number || '—'} · Tel: ${c.phone || '—'}`;
  document.getElementById('fdsDebtTotal').textContent = `S/. ${debt.toFixed(2)}`;
  document.getElementById('fdsLimit').textContent = `S/. ${limit.toFixed(2)}`;
  document.getElementById('fdsAvailable').textContent = `S/. ${available.toFixed(2)}`;
  document.getElementById('fiadoDetailCustId').value = c.id;
  document.getElementById('abonoAmountInput').value = '';

  openModal('fiadoDetailModal');
}

function openAbonoModal(customerId) {
  openCustomerDetailModal(customerId);
  setTimeout(() => {
    const input = document.getElementById('abonoAmountInput');
    if (input) input.focus();
  }, 100);
}

// ============================================================
// 7. RENDERIZADO DE INVENTARIO, ALERTAS DE STOCK Y CATEGORÍAS
// ============================================================
let inventoryFilterMode = 'all'; // 'all' | 'low' | 'zero'
let inventorySearchQuery = '';
let inventorySelectedCategory = '';

function updateStockAlertBanner() {
  const allProds = State.products || [];
  const totalCount = allProds.length;
  const lowProds = allProds.filter(p => parseFloat(p.stock || 0) <= parseFloat(p.min_stock || 5));
  const zeroProds = allProds.filter(p => parseFloat(p.stock || 0) <= 0);

  const banner = document.getElementById('lowStockAlertBanner');
  const countAll = document.getElementById('countAllStock');
  const countLow = document.getElementById('countLowStock');
  const countZero = document.getElementById('countZeroStock');
  const badgeCount = document.getElementById('stockAlertBadgeCount');
  const alertText = document.getElementById('lowStockAlertText');

  if (countAll) countAll.textContent = totalCount;
  if (countLow) countLow.textContent = lowProds.length;
  if (countZero) countZero.textContent = zeroProds.length;
  if (badgeCount) badgeCount.textContent = `${lowProds.length} Críticos`;

  if (banner) {
    if (lowProds.length > 0) {
      banner.style.display = 'flex';
      if (alertText) {
        alertText.innerHTML = `Detectados <strong>${lowProds.length} producto(s)</strong> por debajo del stock mínimo (${zeroProds.length} sin existencia). Reabastezca para evitar pérdidas de venta.`;
      }
    } else {
      banner.style.display = 'none';
    }
  }
}

function applyInventoryFilters() {
  let list = State.products || [];

  // 1. Filtro de Nivel de Stock
  if (inventoryFilterMode === 'low') {
    list = list.filter(p => parseFloat(p.stock || 0) <= parseFloat(p.min_stock || 5));
  } else if (inventoryFilterMode === 'zero') {
    list = list.filter(p => parseFloat(p.stock || 0) <= 0);
  }

  // 2. Filtro de Categoría
  if (inventorySelectedCategory) {
    list = list.filter(p => String(p.category_id) === String(inventorySelectedCategory));
  }

  // 3. Búsqueda por texto (Nombre, SKU, Código o Marca)
  if (inventorySearchQuery.trim()) {
    const q = inventorySearchQuery.trim().toLowerCase();
    list = list.filter(p => 
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.sku && p.sku.toLowerCase().includes(q)) ||
      (p.barcode && p.barcode.toLowerCase().includes(q)) ||
      (p.brand_name && p.brand_name.toLowerCase().includes(q))
    );
  }

  // Actualizar estado activo en botones de filtro
  const btnAll = document.getElementById('btnFilterAllStock');
  const btnLow = document.getElementById('btnViewLowStock');
  const btnZero = document.getElementById('btnFilterZeroStock');

  if (btnAll) btnAll.classList.toggle('active-filter', inventoryFilterMode === 'all');
  if (btnLow) btnLow.classList.toggle('active-filter', inventoryFilterMode === 'low');
  if (btnZero) btnZero.classList.toggle('active-filter', inventoryFilterMode === 'zero');

  // Actualizar indicador de filtro en la barra de herramientas
  const badge = document.getElementById('inventoryFilterStatusBadge');
  const badgeText = document.getElementById('inventoryFilterStatusText');
  if (badge) {
    if (inventoryFilterMode !== 'all' || inventorySelectedCategory || inventorySearchQuery) {
      badge.style.display = 'inline-flex';
      const labels = [];
      if (inventoryFilterMode === 'low') labels.push('⚠️ Stock Bajo');
      if (inventoryFilterMode === 'zero') labels.push('🚨 Solo Agotados');
      if (inventorySelectedCategory) {
        const cat = State.categories.find(c => String(c.id) === String(inventorySelectedCategory));
        if (cat) labels.push(`📁 ${cat.name}`);
      }
      if (inventorySearchQuery) labels.push(`🔍 "${inventorySearchQuery}"`);
      if (badgeText) badgeText.textContent = `Filtro: ${labels.join(' + ')} (${list.length} items)`;
    } else {
      badge.style.display = 'none';
    }
  }

  renderInventoryTableRows(list);
}

function resetInventoryFilters() {
  inventoryFilterMode = 'all';
  inventorySearchQuery = '';
  inventorySelectedCategory = '';

  const searchInput = document.getElementById('inventorySearchInput');
  if (searchInput) searchInput.value = '';
  const searchClear = document.getElementById('btnInventorySearchClear');
  if (searchClear) searchClear.style.display = 'none';
  const catSelect = document.getElementById('inventoryCategoryFilter');
  if (catSelect) catSelect.value = '';

  applyInventoryFilters();
}

function renderInventory(products) {
  updateStockAlertBanner();
  applyInventoryFilters();
}

function renderInventoryTableRows(products) {
  const tbody = document.getElementById('inventoryTableBody');
  if (!tbody) return;

  if (!products.length) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:35px 20px; color:var(--text-muted);">
      <span style="font-size:28px; display:block; margin-bottom:6px;">📦</span>
      <strong>No hay productos que coincidan con los filtros aplicados</strong><br>
      <small style="display:block; margin-top:4px;">Prueba cambiando el término de búsqueda o categoría.</small>
      <button type="button" class="btn-secondary btn-sm" onclick="resetInventoryFilters()" style="margin-top: 10px; cursor:pointer;">📋 Restablecer Filtros</button>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = products.map((p, i) => {
    const isZero = parseFloat(p.stock || 0) <= 0;
    const isLow = parseFloat(p.stock || 0) <= parseFloat(p.min_stock || 5);
    const rowClass = isZero ? 'tr-stock-danger' : (isLow ? 'tr-stock-warning' : '');

    const typeLabel = p.is_bulk
      ? `<span class="status-badge" style="background:#fef3c7; color:#92400e;">🥩 Granel/Kg</span>`
      : `<span style="color:var(--text-muted); font-size:12px">📦 ${p.unit_measure || 'UNIDAD'}</span>`;
    const statusLabel = p.is_active
      ? `<span class="status-badge" style="background:var(--success-light);color:var(--success)">Activo</span>`
      : `<span class="status-badge" style="background:#e2e8f0;color:var(--text-muted)">Inactivo</span>`;
    const itemKey = p.sku || p.barcode || p.id;
    const displayCode = p.sku || '—';

    let stockDisplay = '';
    if (isZero) {
      stockDisplay = `<span style="color:var(--danger); font-weight:800; display:inline-flex; align-items:center; gap:4px;">🚨 0.000 (AGOTADO)</span>`;
    } else if (isLow) {
      stockDisplay = `<span style="color:var(--warning); font-weight:700; display:inline-flex; align-items:center; gap:4px;">⚠️ ${parseFloat(p.stock).toFixed(p.is_bulk ? 3 : 0)} ${p.unit_measure || 'UNIDAD'}</span>`;
    } else {
      stockDisplay = `<span style="color:var(--text-main); font-weight:600;">${parseFloat(p.stock).toFixed(p.is_bulk ? 3 : 0)} ${p.unit_measure || 'UNIDAD'}</span>`;
    }

    return `
      <tr class="${rowClass}">
        <td style="color:var(--text-dim)">${i + 1}</td>
        <td><span class="barcode-badge" title="Identificador SKU">${displayCode}</span></td>
        <td><strong>${p.name}</strong><br><small style="color:var(--text-muted);">${p.brand_name || ''}</small></td>
        <td>${typeLabel}</td>
        <td style="font-family:var(--font-mono)">S/.${parseFloat(p.purchase_price || 0).toFixed(2)}</td>
        <td style="font-family:var(--font-mono); color:var(--success); font-weight:700">S/.${parseFloat(p.sale_price).toFixed(2)}</td>
        <td style="font-family:var(--font-mono)">${stockDisplay}</td>
        <td style="font-family:var(--font-mono); color:var(--text-muted)">${p.min_stock || 5}</td>
        <td>${statusLabel}</td>
        <td style="white-space:nowrap;">
          <button class="btn-primary btn-sm" onclick="editProduct('${itemKey}')" title="Editar producto completo">✏️</button>
          <button class="btn-warning btn-sm" onclick="adjustStock('${itemKey}')" title="Ajustar / Registrar Entrada-Salida de Stock">📦 Stock</button>
          <button class="btn-danger btn-sm" onclick="deleteProduct('${itemKey}')" title="Eliminar producto">🗑️</button>
        </td>
      </tr>`;
  }).join('');
}

function renderCategoriesTable(categories) {
  const tbody = document.getElementById('categoriesTableBody');
  if (!tbody) return;

  if (!categories.length) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:30px; color:var(--text-muted);">No hay categorías registradas. Haga clic en <strong>"+ Nueva Categoría"</strong>.</td></tr>`;
    return;
  }

  tbody.innerHTML = categories.map((c, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><strong>${c.name}</strong></td>
      <td style="color:var(--text-muted);">${c.description || '—'}</td>
      <td>
        <button class="btn-primary btn-sm" onclick="editCategory(${c.id})">✏️ Editar</button>
        <button class="btn-danger btn-sm" onclick="deleteCategory(${c.id})" style="margin-left:4px;">🗑️ Eliminar</button>
      </td>
    </tr>
  `).join('');
}

function renderCategorySelects(categories) {
  const prodSelect = document.getElementById('prodCategory');
  if (prodSelect) {
    prodSelect.innerHTML = `<option value="">-- Seleccionar Categoría --</option>` +
      categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  }

  const invCatFilter = document.getElementById('inventoryCategoryFilter');
  if (invCatFilter) {
    const currentVal = invCatFilter.value;
    invCatFilter.innerHTML = `<option value="">📁 Todas las Categorías</option>` +
      categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    invCatFilter.value = currentVal;
  }
}

// ============================================================
// 8. RENDERIZADO DE HISTORIAL Y SUNAT
// ============================================================
function renderSalesHistory(sales) {
  const tbody = document.getElementById('salesHistoryBody');
  if (!tbody) return;

  if (!sales.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:30px; color:var(--text-muted);">No hay ventas registradas aún.</td></tr>`;
    return;
  }

  tbody.innerHTML = sales.map(s => {
    const docTypeLabel = s.document_type === '01' ? 'Factura' : (s.document_type === '03' ? 'Boleta' : 'Ticket');
    const isCancelled = s.sunat_status === 'ANULADO';
    const sunatBadge = isCancelled
      ? `<span class="status-badge" style="background:#fee2e2;color:#b91c1c;">ANULADO</span>`
      : (s.sunat_status === 'ACEPTADO'
        ? `<span class="status-badge" style="background:var(--success-light);color:var(--success)">ACEPTADO</span>`
        : `<span class="status-badge" style="background:var(--warning-light);color:var(--warning)">PENDIENTE</span>`);

    return `
      <tr>
        <td><strong>${s.invoice_number}</strong></td>
        <td>${docTypeLabel}</td>
        <td>${s.created_at}</td>
        <td>${s.customer_name || 'Cliente Final'}</td>
        <td><span class="barcode-badge">${s.payment_method}</span></td>
        <td style="font-family:var(--font-mono); font-weight:700; color:${isCancelled ? 'var(--danger)' : 'var(--success)'}">S/. ${parseFloat(s.total || s.total_amount || 0).toFixed(2)}</td>
        <td>${sunatBadge}</td>
        <td style="white-space:nowrap;">
          <button class="btn-success btn-sm" onclick="printSaleDirect(${s.id})" title="Imprimir directamente en impresora térmica">🖨️ Imprimir</button>
          <button class="btn-primary btn-sm" onclick="showTicket(${s.id})" style="margin-left:4px;" title="Ver vista previa de la boleta">👁️ Ver</button>
          ${!isCancelled ? `<button class="btn-danger btn-sm" onclick="cancelSale(${s.id})" style="margin-left:4px;" title="Anular venta y devolver stock">🚫 Anular</button>` : ''}
        </td>
      </tr>`;
  }).join('');
}

function renderSunatTable(sales) {
  const tbody = document.getElementById('sunatTableBody');
  if (!tbody) return;

  const sunatSales = sales.filter(s => s.document_type === '01' || s.document_type === '03');
  let pendingCount = 0;
  let acceptedCount = 0;
  let rejectedCount = 0;

  sunatSales.forEach(s => {
    if (s.sunat_status === 'ACEPTADO') acceptedCount++;
    else if (s.sunat_status === 'RECHAZADO') rejectedCount++;
    else pendingCount++;
  });

  if (document.getElementById('sunatStatPending')) document.getElementById('sunatStatPending').textContent = pendingCount;
  if (document.getElementById('sunatStatAccepted')) document.getElementById('sunatStatAccepted').textContent = acceptedCount;
  if (document.getElementById('sunatStatRejected')) document.getElementById('sunatStatRejected').textContent = rejectedCount;

  if (!sunatSales.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:30px; color:var(--text-muted);">No hay comprobantes electrónicos emitidos aún.</td></tr>`;
    return;
  }

  tbody.innerHTML = sunatSales.map(s => {
    const docTypeLabel = s.document_type === '01' ? 'Factura' : 'Boleta';
    const sunatBadge = s.sunat_status === 'ACEPTADO'
      ? `<span class="status-badge" style="background:var(--success-light);color:var(--success)">ACEPTADO</span>`
      : `<span class="status-badge" style="background:var(--warning-light);color:var(--warning)">PENDIENTE</span>`;
    return `
      <tr>
        <td><strong>${s.invoice_number}</strong></td>
        <td>${docTypeLabel}</td>
        <td>${s.created_at}</td>
        <td>${s.customer_name || 'Cliente Final'}</td>
        <td style="font-family:var(--font-mono)">S/. ${parseFloat(s.total).toFixed(2)}</td>
        <td style="font-family:var(--font-mono)">S/. ${parseFloat(s.igv).toFixed(2)}</td>
        <td>${sunatBadge}</td>
        <td style="white-space:nowrap;">
          <button class="btn-success btn-sm" onclick="printSaleDirect(${s.id})" title="Imprimir en impresora térmica">🖨️ Imprimir</button>
          <button class="btn-secondary btn-sm" onclick="showTicket(${s.id})" style="margin-left:4px;" title="Ver boleta">👁️ Ver</button>
        </td>
      </tr>`;
  }).join('');
}

async function showTicket(saleId) {
  try {
    const res = await fetch(`/api/sales/${saleId}/ticket`);
    const json = await res.json();
    if (json.success && json.ticketText) {
      document.getElementById('receiptPaperText').textContent = json.ticketText;
      const btn = document.getElementById('btnPrintTicketWindow');
      if (btn) btn.dataset.saleId = saleId;
      openModal('ticketModal');
    } else {
      alert('❌ No se pudo cargar el ticket: ' + (json.error || 'Venta no encontrada'));
    }
  } catch (err) {
    alert('Error al obtener el ticket: ' + err.message);
  }
}

async function printSaleDirect(saleId) {
  const cfg = PrinterConfig.get();
  const printerName = cfg.deviceName || 'POS-58-Series';
  const paperWidth = cfg.paperWidth || '58';

  try {
    const res = await fetch(`/api/sales/${saleId}/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ printerName, paperWidth })
    });
    const json = await res.json();
    if (json.success) {
      alert(`✅ ¡BOLETA IMPRESA EN POS-58-SERIES!\n\nComprobante enviado exitosamente a la impresora física.`);
    } else {
      alert(`❌ Error al imprimir boleta:\n\n${json.error || 'Verifique que la impresora esté encendida con cable USB conectado.'}`);
    }
  } catch (err) {
    alert('❌ Error al comunicarse con la impresora: ' + err.message);
  }
}

// ============================================================
// 9. CONTROL DE MODALES Y NAVEGACIÓN
// ============================================================
function openModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.add('active');
}

function closeModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.remove('active');
}

function switchTab(tabId) {
  document.querySelectorAll('.tab-pane').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.sidebar-nav .nav-btn').forEach(b => b.classList.remove('active'));
  const target = document.getElementById(tabId);
  if (target) target.classList.add('active');
  const btn = document.querySelector(`[data-tab="${tabId}"]`);
  if (btn) btn.classList.add('active');

  if (tabId === 'posTab') loadProducts();
  else if (tabId === 'customersTab') loadCustomers();
  else if (tabId === 'inventoryTab') loadProducts();
  else if (tabId === 'sunatTab') { loadSalesHistory(); loadSunatConfig(); }
  else if (tabId === 'categoriesTab') loadCategories();
  else if (tabId === 'salesHistoryTab') loadSalesHistory();
  else if (tabId === 'settingsTab') loadSettingsView();
}

function calculateNextSku() {
  let maxNum = 0;
  if (State.products && State.products.length) {
    State.products.forEach(p => {
      const s = p.sku || p.barcode || '';
      const match = s.match(/SKU-(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    });
  }
  return `SKU-${String(maxNum + 1).padStart(6, '0')}`;
}

function openProductModalForCreate() {
  editingSku = null;
  const title = document.getElementById('productModalTitle');
  if (title) title.textContent = '📦 Registrar Producto';
  const form = document.getElementById('productForm');
  if (form) form.reset();

  const nextSku = calculateNextSku();
  if (document.getElementById('prodSku')) document.getElementById('prodSku').value = nextSku;
  if (document.getElementById('prodBarcode')) document.getElementById('prodBarcode').value = '';

  openModal('productModal');
}

async function editProduct(itemKey) {
  const p = State.products.find(x => x.sku === String(itemKey) || x.barcode === String(itemKey) || x.id === itemKey || String(x.id) === String(itemKey));
  if (!p) return;
  editingSku = p.sku || p.barcode || p.id;
  const title = document.getElementById('productModalTitle');
  if (title) title.textContent = `✏️ Editar Producto — ${p.name}`;

  if (document.getElementById('prodSku')) document.getElementById('prodSku').value = p.sku || '';
  if (document.getElementById('prodBarcode')) document.getElementById('prodBarcode').value = p.barcode || '';
  if (document.getElementById('prodName')) document.getElementById('prodName').value = p.name || '';
  if (document.getElementById('prodCategory')) document.getElementById('prodCategory').value = p.category_id || '';
  if (document.getElementById('prodIsBulk')) document.getElementById('prodIsBulk').value = p.is_bulk ? '1' : '0';
  if (document.getElementById('prodCostPrice')) document.getElementById('prodCostPrice').value = p.purchase_price || 0;
  if (document.getElementById('prodSalePrice')) document.getElementById('prodSalePrice').value = p.sale_price || 0;
  if (document.getElementById('prodStock')) document.getElementById('prodStock').value = p.stock || 0;
  if (document.getElementById('prodMinStock')) document.getElementById('prodMinStock').value = p.min_stock || 5;
  if (document.getElementById('prodUnit')) document.getElementById('prodUnit').value = p.unit_measure || (p.is_bulk ? 'KG' : 'UNIDAD');

  openModal('productModal');
}

async function adjustStock(itemKey) {
  const p = State.products.find(x => x.sku === String(itemKey) || x.barcode === String(itemKey) || x.id === itemKey || String(x.id) === String(itemKey));
  if (!p) return;

  const type = prompt(
    `📦 AJUSTE DE STOCK PARA: "${p.name}" (SKU: ${p.sku})\nStock Actual: ${p.stock} ${p.unit_measure || 'UNIDAD'}\n\nSeleccione el tipo de movimiento:\n1 = 📥 ENTRADA / COMPRA (+)\n2 = 📤 SALIDA / MERMA (-)`,
    '1'
  );

  if (type !== '1' && type !== '2') return;

  const qtyStr = prompt(
    type === '1' ? `Ingrese la cantidad a INGRESAR al stock (+):` : `Ingrese la cantidad a RETIRAR del stock (-):`,
    '1'
  );
  const qty = parseFloat(qtyStr);
  if (isNaN(qty) || qty <= 0) {
    alert('⚠️ Cantidad ingresada no es válida.');
    return;
  }

  const reason = prompt('Motivo del movimiento:', type === '1' ? 'Compra a proveedor' : 'Merma / Ajuste de inventario') || 'Ajuste manual';

  try {
    const res = await fetch('/api/stock/movement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_id: p.sku || p.barcode,
        barcode: p.barcode,
        movement_type: type === '1' ? 'ENTRADA' : 'SALIDA',
        quantity: qty,
        notes: reason
      })
    });
    const json = await res.json();
    if (json.success) {
      showToast(`✅ Stock actualizado exitosamente.`, 'success');
      loadProducts();
    } else {
      showToast('❌ Error al ajustar stock: ' + (json.error || 'Error en servidor'), 'error');
    }
  } catch (err) {
    showToast('❌ Error de comunicación: ' + err.message, 'error');
  }
}

async function deleteProduct(itemKey) {
  const confirmed = await showAppConfirm(`¿Está seguro de eliminar el producto "${itemKey}"?`, 'Eliminar Producto', 'danger', '🗑️ Sí, Eliminar', 'Cancelar');
  if (confirmed) {
    await fetch(`/api/products/${encodeURIComponent(itemKey)}`, { method: 'DELETE' });
    showToast('Producto eliminado exitosamente', 'success');
    loadProducts();
  }
}

function openCustomerModalForCreate() {
  editingCustomerId = null;
  const title = document.querySelector('#customerModal h3');
  if (title) title.textContent = '👥 Registrar Nuevo Cliente';
  const form = document.getElementById('customerForm');
  if (form) form.reset();
  openModal('customerModal');
}

async function editCustomer(customerId) {
  const c = State.customers.find(x => x.id === customerId);
  if (!c) return;
  editingCustomerId = c.id;
  const title = document.querySelector('#customerModal h3');
  if (title) title.textContent = `✏️ Editar Cliente — ${c.name}`;

  if (document.getElementById('custName')) document.getElementById('custName').value = c.name || '';
  if (document.getElementById('custDocType')) document.getElementById('custDocType').value = c.document_type || '1';
  if (document.getElementById('custDoc')) document.getElementById('custDoc').value = c.document_number || '';
  if (document.getElementById('custPhone')) document.getElementById('custPhone').value = c.phone || '';
  if (document.getElementById('custCreditLimit')) document.getElementById('custCreditLimit').value = c.credit_limit || 200;

  openModal('customerModal');
}

async function deleteCustomer(id) {
  const c = State.customers.find(x => x.id === id);
  const confirmed = await showAppConfirm(`¿Está seguro de eliminar al cliente "${c ? c.name : id}"?`, 'Eliminar Cliente', 'danger', '🗑️ Sí, Eliminar', 'Cancelar');
  if (confirmed) {
    try {
      const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        showToast('Cliente eliminado exitosamente', 'success');
        loadCustomers();
      } else {
        showAppAlert('❌ ' + (json.error || 'No se pudo eliminar'), 'Error al Eliminar', 'error');
      }
    } catch (err) {
      showAppAlert('❌ Error: ' + err.message, 'Error de Comunicación', 'error');
    }
  }
}

function openCategoryModalForCreate() {
  editingCategoryId = null;
  const title = document.querySelector('#categoryModal h3');
  if (title) title.textContent = '🏷️ Registrar Nueva Categoría';
  const form = document.getElementById('categoryForm');
  if (form) form.reset();
  openModal('categoryModal');
}

async function editCategory(catId) {
  const c = State.categories.find(x => x.id === catId);
  if (!c) return;
  editingCategoryId = c.id;
  const title = document.querySelector('#categoryModal h3');
  if (title) title.textContent = `✏️ Editar Categoría — ${c.name}`;

  if (document.getElementById('catName')) document.getElementById('catName').value = c.name || '';
  if (document.getElementById('catDescription')) document.getElementById('catDescription').value = c.description || '';

  openModal('categoryModal');
}

async function deleteCategory(catId) {
  const confirmed = await showAppConfirm('¿Está seguro de eliminar esta categoría?', 'Eliminar Categoría', 'danger', '🗑️ Sí, Eliminar', 'Cancelar');
  if (confirmed) {
    await fetch(`/api/categories/${catId}`, { method: 'DELETE' });
    showToast('Categoría eliminada exitosamente', 'success');
    loadCategories();
  }
}

async function cancelSale(saleId) {
  const confirmed = await showAppConfirm(`¿Está seguro de anular la venta #${saleId}?\n\nSe devolverá el stock de los productos al inventario.`, 'Anular Venta', 'danger', '🚫 Sí, Anular Venta', 'Cancelar');
  if (confirmed) {
    try {
      const res = await fetch(`/api/sales/${saleId}/cancel`, { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        showToast('✅ Venta anulada exitosamente y stock devuelto.', 'success');
        loadSalesHistory();
        loadProducts();
      } else {
        showAppAlert(`❌ No se pudo anular la venta:\n\n${json.error || 'Error en servidor'}`, 'Error al Anular Venta', 'error');
      }
    } catch (err) {
      showAppAlert(`❌ Error de comunicación:\n\n${err.message}`, 'Error de Red', 'error');
    }
  }
}

// ============================================================
// 10. CHECKOUT Y VENTAS
// ============================================================
// ============================================================
// MODAL SELECTOR DE TIPO DE COMPROBANTE (antes de cobrar)
// ============================================================
function openDocTypePicker() {
  // Si ya existe, eliminar el anterior
  const existing = document.getElementById('docTypePickerOverlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'doc-picker-overlay';
  overlay.id = 'docTypePickerOverlay';

  const options = [
    { type: '03', icon: '📄', label: 'Boleta',  serial: 'B001' },
    { type: '01', icon: '📋', label: 'Factura', serial: 'F001' },
    { type: '00', icon: '🧾', label: 'Ticket',  serial: 'Interno' }
  ];

  let selected = State.documentType || '03';

  const buildOptions = () => options.map(o => `
    <button type="button" class="doc-picker-option ${selected === o.type ? 'selected' : ''}" data-type="${o.type}">
      <span class="dp-icon">${o.icon}</span>
      <span>${o.label}</span>
      <span class="dp-serial">${o.serial}</span>
    </button>`).join('');

  overlay.innerHTML = `
    <div class="doc-picker-box">
      <div class="doc-picker-title">¿Qué tipo de comprobante?</div>
      <div class="doc-picker-subtitle">Selecciona antes de procesar la venta</div>
      <div class="doc-picker-options" id="dpOptions">${buildOptions()}</div>
      <button class="doc-picker-confirm" id="dpConfirm">✅ Confirmar y Cobrar</button>
    </div>`;

  document.body.appendChild(overlay);

  // Eventos de selección
  overlay.querySelectorAll('.doc-picker-option').forEach(btn => {
    btn.addEventListener('click', () => {
      selected = btn.dataset.type;
      overlay.querySelectorAll('.doc-picker-option').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });

  // Confirmar
  overlay.querySelector('#dpConfirm').addEventListener('click', () => {
    State.documentType = selected;
    // Actualizar etiqueta en la cabecera de la vista previa
    const previewLabel = document.getElementById('previewDocTypeLabel');
    if (previewLabel) {
      previewLabel.textContent = selected === '00' ? 'TICKET' : (selected === '01' ? 'FACTURA' : 'BOLETA');
    }
    // Actualizar etiqueta en el botón principal
    const label = document.getElementById('sunatLabelBtn');
    if (label) label.textContent = selected === '00' ? 'TICKET INTERNO' : (selected === '01' ? 'FACTURA SUNAT' : 'BVE SUNAT');
    overlay.remove();
    // Regenerar la vista previa con el nuevo tipo seleccionado
    renderTicketPreview();
    openCheckoutPayModal();
  });

  // Cerrar al hacer clic fuera del box
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
}

function openCheckoutModal() {
  if (!State.cart.length) {
    alert('El carrito está vacío. Agregue productos antes de cobrar.');
    return;
  }
  openDocTypePicker();
}

function openCheckoutPayModal() {
  const total = State.cart.reduce((s, i) => s + (i.sale_price * i.quantity), 0);
  if (document.getElementById('checkoutTotalDisplay')) {
    document.getElementById('checkoutTotalDisplay').textContent = `S/. ${total.toFixed(2)}`;
  }
  if (document.getElementById('coEfectivoInput')) {
    document.getElementById('coEfectivoInput').value = total.toFixed(2);
  }
  updateCashChange();
  openModal('checkoutModal');
}

function updateCashChange() {
  const total = State.cart.reduce((s, i) => s + (i.sale_price * i.quantity), 0);
  const input = document.getElementById('coEfectivoInput');
  const paid = parseFloat(input ? input.value : 0) || 0;
  const change = Math.max(0, paid - total);
  if (document.getElementById('coChangeDisplay')) {
    document.getElementById('coChangeDisplay').textContent = `S/. ${change.toFixed(2)}`;
  }
}

async function confirmCheckout() {
  const total = State.cart.reduce((s, i) => s + (i.sale_price * i.quantity), 0);
  const isFiado = checkoutPayMode === 'fiar';
  const customerId = isFiado ? document.getElementById('coFiadoSelect').value : null;

  if (isFiado && !customerId) {
    alert('Por favor seleccione un cliente obligatorio para registrar la venta fiada.');
    return;
  }

  const payload = {
    document_type: State.documentType,
    payment_method: isFiado ? 'FIADO' : checkoutPayMethod,
    amount_paid: isFiado ? 0 : parseFloat(document.getElementById('coEfectivoInput')?.value || total),
    customer_id: customerId ? parseInt(customerId) : null,
    items: State.cart
  };

  try {
    const res = await fetch('/api/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (json.success) {
      const saleId = json.data?.id || json.data?.saleId;
      State.cart = [];
      renderCart();
      closeModal('checkoutModal');
      loadProducts();
      loadCustomers();

      const cfg = PrinterConfig.get();
      if (saleId && cfg.printOnSale !== false) {
        printSaleDirect(saleId, true);
      }

      if (saleId) {
        showTicket(saleId);
      }
    } else {
      alert(`❌ Error al registrar venta: ${json.error || json.message}`);
    }
  } catch (err) {
    alert(`❌ Error de comunicación: ${err.message}`);
  }
}

// ============================================================
// 11. INICIALIZACIÓN COMPLETA DE EVENTOS
// ============================================================

// Verificar estado real de dispositivos (impresora, SUNAT)
async function checkDeviceStatuses() {
  // 1. ESCÁNER: Se activa solo cuando escanea exitosamente (ver searchByBarcode)
  //    Por defecto: gris (no hay API para detectar USB sin backend)

  // 2. IMPRESORA: verificar si hay impresoras en Windows vía API
  try {
    const res = await fetch('/api/printers');
    const json = await res.json();
    const hasPrinters = json && json.data && json.data.length > 0;
    const dot = document.getElementById('dotPrinter');
    const indicator = document.getElementById('btnOpenPrinterConfig');
    if (dot) {
      dot.className = `status-dot ${hasPrinters ? 'dot-green' : 'dot-gray'}`;
    }
    if (indicator) {
      indicator.title = hasPrinters
        ? `Impresora lista: ${json.data[0].Name} (clic para configurar)`
        : 'Sin impresora detectada en Windows (clic para configurar)';
    }
  } catch (_) {}

  // 3. SUNAT: verificar si hay credenciales configuradas
  try {
    const sunatCfg = JSON.parse(localStorage.getItem('vf_sunat_config'));
    const hasCredentials = sunatCfg && sunatCfg.ruc && sunatCfg.sol_user && sunatCfg.sol_pass;
    const dot = document.getElementById('dotSunat');
    const indicator = document.getElementById('sunatStatusPill');
    if (dot) {
      dot.className = `status-dot ${hasCredentials ? 'dot-green' : 'dot-gray'}`;
    }
    if (indicator) {
      indicator.title = hasCredentials
        ? `SUNAT BVE: Credenciales configuradas (RUC ${sunatCfg.ruc})`
        : 'SUNAT: Sin credenciales configuradas';
    }
  } catch (_) {}
}

document.addEventListener('DOMContentLoaded', () => {
  // Cargar datos iniciales
  loadProducts();
  loadCategories();
  loadCustomers();
  loadSunatConfig();
  renderCart();

  // Verificar estado de dispositivos al iniciar y cada 30s
  checkDeviceStatuses();
  setInterval(checkDeviceStatuses, 30000);

  // Toggle de vista previa del ticket
  const btnPreviewToggle = document.getElementById('btnTicketPreviewToggle');
  const previewBody = document.getElementById('ticketPreviewBody');
  if (btnPreviewToggle && previewBody) {
    btnPreviewToggle.addEventListener('click', () => {
      const isOpen = previewBody.classList.toggle('open');
      btnPreviewToggle.classList.toggle('open', isOpen);
      const arrow = btnPreviewToggle.querySelector('.toggle-arrow');
      if (arrow) arrow.style.transform = isOpen ? 'rotate(180deg)' : '';
      if (isOpen) renderTicketPreview();
    });
  }

  // Reloj en vivo
  function updateClock() {
    const now = new Date();
    const clock = document.getElementById('liveClock');
    if (clock) {
      clock.textContent = now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
  }
  setInterval(updateClock, 1000);
  updateClock();


  // Navegación Sidebar
  document.querySelectorAll('.sidebar-nav .nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Escáner de código de barras
  const scanInput = document.getElementById('globalBarcodeScanner');
  if (scanInput) {
    scanInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        searchByBarcode(scanInput.value);
      }
    });
  }

  const btnScanSearch = document.getElementById('btnScanSearch');
  if (btnScanSearch && scanInput) {
    btnScanSearch.addEventListener('click', () => searchByBarcode(scanInput.value));
  }

  // Selector de comprobante (botones eliminados del DOM, ahora solo via modal emergente)
  // Se mantiene State.documentType = '03' (Boleta) por defecto
  // La selección ocurre en openDocTypePicker() al presionar PROCESAR E IMPRIMIR

  // Botón checkout
  const btnCheckout = document.getElementById('btnCheckout');
  if (btnCheckout) btnCheckout.addEventListener('click', openCheckoutModal);

  // Selector Pagar / Fiar
  const pofBtnPay = document.getElementById('pofBtnPay');
  const pofBtnFiar = document.getElementById('pofBtnFiar');
  if (pofBtnPay && pofBtnFiar) {
    pofBtnPay.addEventListener('click', () => {
      checkoutPayMode = 'pay';
      pofBtnPay.classList.add('active');
      pofBtnFiar.classList.remove('active');
      document.getElementById('panelPay').style.display = 'block';
      document.getElementById('panelFiar').style.display = 'none';
    });
    pofBtnFiar.addEventListener('click', () => {
      checkoutPayMode = 'fiar';
      pofBtnFiar.classList.add('active');
      pofBtnPay.classList.remove('active');
      document.getElementById('panelPay').style.display = 'none';
      document.getElementById('panelFiar').style.display = 'block';
    });
  }

  // Métodos de pago
  document.querySelectorAll('.pay-method-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.pay-method-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      checkoutPayMethod = btn.dataset.method;
    });
  });

  // Calculadora de cambio
  const coEfectivoInput = document.getElementById('coEfectivoInput');
  if (coEfectivoInput) {
    coEfectivoInput.addEventListener('input', updateCashChange);
  }

  const btnConfirmCheckout = document.getElementById('btnConfirmCheckout');
  if (btnConfirmCheckout) btnConfirmCheckout.addEventListener('click', confirmCheckout);

  const btnClearCart = document.getElementById('btnClearCart');
  if (btnClearCart) {
    btnClearCart.addEventListener('click', async () => {
      if (!State.cart.length) return;
      const confirmed = await showAppConfirm('¿Desea vaciar todos los productos del carrito actual?', 'Vaciar Carrito', 'warning', '🗑️ Sí, Vaciar', 'Cancelar');
      if (confirmed) {
        State.cart = [];
        renderCart();
        showToast('Carrito vaciado exitosamente', 'info');
      }
    });
  }

  // Filtros POS Buscador
  const posSearchInput = document.getElementById('posSearchInput');
  if (posSearchInput) {
    posSearchInput.addEventListener('input', (e) => {
      const term = e.target.value;
      loadProducts(term, State.selectedCategoryId || null);
    });
  }

  // Vista Lista / Grilla Toggle
  const btnListView = document.getElementById('btnListView');
  const btnGridView = document.getElementById('btnGridView');
  const posListView = document.getElementById('posListView');
  const productGrid = document.getElementById('productGrid');

  if (btnListView && btnGridView && posListView && productGrid) {
    btnListView.addEventListener('click', () => {
      btnListView.classList.add('active');
      btnGridView.classList.remove('active');
      posListView.style.display = 'block';
      productGrid.style.display = 'none';
    });

    btnGridView.addEventListener('click', () => {
      btnGridView.classList.add('active');
      btnListView.classList.remove('active');
      posListView.style.display = 'none';
      productGrid.style.display = 'grid';
    });
  }

  // Limpiar buscador de filtro de catálogo
  const btnFilterClearInput = document.getElementById('btnFilterClearInput');
  if (btnFilterClearInput) {
    btnFilterClearInput.addEventListener('click', () => {
      const searchInput = document.getElementById('posSearchInput');
      if (searchInput) {
        searchInput.value = '';
        loadProducts('', State.selectedCategoryId || null);
        searchInput.focus();
      }
    });
  }

  // ==================== TOGGLE BARRA LATERAL (COLAPSAR / EXPANDIR) ====================
  const appSidebar = document.getElementById('appSidebar');
  const btnToggleSidebar = document.getElementById('btnToggleSidebar');
  const btnTopbarMenu = document.getElementById('btnTopbarMenu');

  const toggleSidebar = () => {
    if (appSidebar) {
      appSidebar.classList.toggle('collapsed');
    }
  };

  if (btnToggleSidebar) btnToggleSidebar.addEventListener('click', toggleSidebar);
  if (btnTopbarMenu) btnTopbarMenu.addEventListener('click', toggleSidebar);

  // ==================== PANEL RESIZABLE Y TAMAÑOS FLEXIBLES ====================
  const posSpeedPanel = document.getElementById('posSpeedPanel');
  const speedBody = document.getElementById('speedPanelBody');

  // Presets de tamaño (Compacto, Normal, Amplio)
  document.querySelectorAll('.btn-size-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.btn-size-preset').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const size = btn.dataset.size;
      posSpeedPanel.classList.remove('size-compact', 'size-normal', 'size-large');
      if (size === 'compact') {
        posSpeedPanel.classList.add('size-compact');
        if (speedBody) speedBody.style.height = '120px';
      } else if (size === 'large') {
        posSpeedPanel.classList.add('size-large');
        if (speedBody) speedBody.style.height = '260px';
      } else {
        posSpeedPanel.classList.add('size-normal');
        if (speedBody) speedBody.style.height = '180px';
      }
    });
  });

  // Tirador de arrastre para altura flexible interactiva (Mouse y Touch)
  const keyboardResizerHandle = document.getElementById('keyboardResizerHandle');
  if (keyboardResizerHandle && speedBody) {
    let isDragging = false;
    let startY = 0;
    let startHeight = 0;

    const startDrag = (clientY) => {
      isDragging = true;
      startY = clientY;
      startHeight = speedBody.offsetHeight;
      document.body.style.cursor = 'ns-resize';
      document.body.style.userSelect = 'none';
      posSpeedPanel.classList.remove('size-compact', 'size-normal', 'size-large');
    };

    const doDrag = (clientY) => {
      if (!isDragging) return;
      const deltaY = startY - clientY;
      const newHeight = Math.max(90, Math.min(380, startHeight + deltaY));
      speedBody.style.height = `${newHeight}px`;
    };

    const endDrag = () => {
      if (isDragging) {
        isDragging = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    keyboardResizerHandle.addEventListener('mousedown', (e) => startDrag(e.clientY));
    window.addEventListener('mousemove', (e) => doDrag(e.clientY));
    window.addEventListener('mouseup', endDrag);

    keyboardResizerHandle.addEventListener('touchstart', (e) => {
      if (e.touches[0]) startDrag(e.touches[0].clientY);
    }, { passive: true });
    window.addEventListener('touchmove', (e) => {
      if (isDragging && e.touches[0]) doDrag(e.touches[0].clientY);
    }, { passive: true });
    window.addEventListener('touchend', endDrag);
  }

  // ==================== TECLADO TÁCTIL QWERTY (BUSCADOR RÁPIDO) ====================
  document.querySelectorAll('.q-key[data-char]').forEach(btn => {
    btn.addEventListener('click', () => {
      const char = btn.dataset.char;
      const searchInput = document.getElementById('posSearchInput');
      if (searchInput) {
        searchInput.value = (searchInput.value || '') + char;
        loadProducts(searchInput.value, State.selectedCategoryId || null);
      }
    });
  });

  const btnQwertySpace = document.getElementById('btnQwertySpace');
  if (btnQwertySpace) {
    btnQwertySpace.addEventListener('click', () => {
      const searchInput = document.getElementById('posSearchInput');
      if (searchInput) {
        searchInput.value = (searchInput.value || '') + ' ';
        loadProducts(searchInput.value, State.selectedCategoryId || null);
      }
    });
  }

  const btnQwertyBackspace = document.getElementById('btnQwertyBackspace');
  if (btnQwertyBackspace) {
    btnQwertyBackspace.addEventListener('click', () => {
      const searchInput = document.getElementById('posSearchInput');
      if (searchInput && searchInput.value) {
        searchInput.value = searchInput.value.slice(0, -1);
        loadProducts(searchInput.value, State.selectedCategoryId || null);
      }
    });
  }

  const btnClearSearchKey = document.getElementById('btnClearSearchKey');
  if (btnClearSearchKey) {
    btnClearSearchKey.addEventListener('click', () => {
      const searchInput = document.getElementById('posSearchInput');
      if (searchInput) {
        searchInput.value = '';
        loadProducts('', State.selectedCategoryId || null);
        searchInput.focus();
      }
    });
  }

  const btnQwertySearch = document.getElementById('btnQwertySearch');
  if (btnQwertySearch) {
    btnQwertySearch.addEventListener('click', () => {
      const searchInput = document.getElementById('posSearchInput');
      if (searchInput) {
        loadProducts(searchInput.value, State.selectedCategoryId || null);
      }
    });
  }

  // ==================== TECLADO NUMPAD POS ====================
  document.querySelectorAll('.num-key[data-val]').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.dataset.val;
      const scanner = document.getElementById('globalBarcodeScanner');
      const checkoutOpen = document.getElementById('checkoutModal')?.classList.contains('active');
      const cashInput = document.getElementById('coEfectivoInput');

      if (checkoutOpen && cashInput) {
        cashInput.value = (cashInput.value || '') + val;
        updateCashChange();
      } else if (scanner) {
        scanner.value = (scanner.value || '') + val;
        scanner.focus();
      }
    });
  });

  const numActionClear = document.getElementById('numActionClear');
  if (numActionClear) {
    numActionClear.addEventListener('click', () => {
      const checkoutOpen = document.getElementById('checkoutModal')?.classList.contains('active');
      const cashInput = document.getElementById('coEfectivoInput');
      const scanner = document.getElementById('globalBarcodeScanner');

      if (checkoutOpen && cashInput) {
        cashInput.value = cashInput.value.slice(0, -1);
        updateCashChange();
      } else if (scanner) {
        scanner.value = scanner.value.slice(0, -1);
        scanner.focus();
      }
    });
  }

  const btnNumpadEnter = document.getElementById('btnNumpadEnter');
  if (btnNumpadEnter) {
    btnNumpadEnter.addEventListener('click', () => {
      const checkoutOpen = document.getElementById('checkoutModal')?.classList.contains('active');
      if (checkoutOpen) {
        confirmCheckout();
      } else {
        const scanner = document.getElementById('globalBarcodeScanner');
        if (scanner && scanner.value) searchByBarcode(scanner.value);
      }
    });
  }

  const numActionQty = document.getElementById('numActionQty');
  if (numActionQty) {
    numActionQty.addEventListener('click', () => {
      if (!State.cart.length) {
        alert('Agregue primero un producto al carrito para modificar su cantidad.');
        return;
      }
      const lastItem = State.cart[State.cart.length - 1];
      const qtyStr = prompt(`Multiplicar cantidad para "${lastItem.name}":`, '2');
      if (qtyStr !== null) {
        const qty = parseFloat(qtyStr);
        if (qty > 0) {
          lastItem.quantity = qty;
          renderCart();
        }
      }
    });
  }

  // ==================== EVENTOS DEL MODAL DE PESAJE GIGANTE (A GRANEL / BALANZA) ====================
  const weighInputKg = document.getElementById('weighInputKg');
  if (weighInputKg) {
    weighInputKg.addEventListener('input', () => {
      weighInputNeedsReset = false;
      updateWeighTotal();
    });
    weighInputKg.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('btnConfirmWeighModal')?.click();
      }
    });
  }

  // Teclado Numérico Táctil Dedicado de Balanza (0-9, ., C, ⌫)
  document.querySelectorAll('.btn-touch-num[data-val]').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.dataset.val;
      if (!weighInputKg) return;

      if (weighInputNeedsReset) {
        if (val === '.') weighInputKg.value = '0.';
        else weighInputKg.value = val;
        weighInputNeedsReset = false;
      } else {
        if (val === '.' && weighInputKg.value.includes('.')) return; // Evitar puntos duplicados
        weighInputKg.value = (weighInputKg.value || '') + val;
      }
      updateWeighTotal();
    });
  });

  const btnWeighNumpadClear = document.getElementById('btnWeighNumpadClear');
  if (btnWeighNumpadClear && weighInputKg) {
    btnWeighNumpadClear.addEventListener('click', () => {
      weighInputKg.value = '0';
      weighInputNeedsReset = true;
      updateWeighTotal();
    });
  }

  const btnWeighNumpadBack = document.getElementById('btnWeighNumpadBack');
  if (btnWeighNumpadBack && weighInputKg) {
    btnWeighNumpadBack.addEventListener('click', () => {
      if (weighInputKg.value.length > 1) {
        weighInputKg.value = weighInputKg.value.slice(0, -1);
      } else {
        weighInputKg.value = '0';
        weighInputNeedsReset = true;
      }
      updateWeighTotal();
    });
  }

  // Botones de ajuste paso a paso (- 100g / + 100g)
  const btnWeightMinus = document.getElementById('btnWeightMinus');
  if (btnWeightMinus && weighInputKg) {
    btnWeightMinus.addEventListener('click', () => {
      const current = parseFloat(weighInputKg.value || 0);
      const next = Math.max(0.005, parseFloat((current - 0.100).toFixed(3)));
      weighInputKg.value = next.toFixed(3);
      weighInputNeedsReset = false;
      updateWeighTotal();
    });
  }

  const btnWeightPlus = document.getElementById('btnWeightPlus');
  if (btnWeightPlus && weighInputKg) {
    btnWeightPlus.addEventListener('click', () => {
      const current = parseFloat(weighInputKg.value || 0);
      const next = parseFloat((current + 0.100).toFixed(3));
      weighInputKg.value = next.toFixed(3);
      weighInputNeedsReset = false;
      updateWeighTotal();
    });
  }

  // Presets táctiles rápidos (¼ kg, ½ kg, etc.)
  document.querySelectorAll('.btn-weigh-big').forEach(btn => {
    btn.addEventListener('click', () => {
      const w = parseFloat(btn.dataset.weight);
      if (weighInputKg) {
        weighInputKg.value = w.toFixed(3);
        weighInputNeedsReset = true;
        updateWeighTotal();
      }
    });
  });

  const btnConfirmWeighModal = document.getElementById('btnConfirmWeighModal');
  if (btnConfirmWeighModal) {
    btnConfirmWeighModal.addEventListener('click', () => {
      if (!pendingWeighProduct) return;
      const weight = parseFloat(document.getElementById('weighInputKg')?.value || 0);
      if (weight <= 0) {
        alert('Por favor ingrese un peso válido mayor a 0 Kg.');
        return;
      }

      const key = pendingWeighProduct.barcode || pendingWeighProduct.id;
      const existing = State.cart.find(i => (i.barcode || i.id) === key);
      if (existing) {
        existing.quantity = parseFloat((existing.quantity + weight).toFixed(3));
      } else {
        State.cart.push({ ...pendingWeighProduct, quantity: weight });
      }

      renderCart();
      closeModal('weighModal');
      pendingWeighProduct = null;
    });
  }

  setupWeighBulkSearch();

  const numActionWeigh = document.getElementById('numActionWeigh');
  if (numActionWeigh) {
    numActionWeigh.addEventListener('click', () => {
      openWeighModal(null, true);
    });
  }

  // ==================== SELECTOR DE MODO DE CATÁLOGO (FRECUENTES vs COMPLETO) ====================
  const btnModeFrequent = document.getElementById('btnModeFrequent');
  const btnModeAll = document.getElementById('btnModeAll');
  const catWrapper = document.getElementById('categoryChipsWrapper');

  if (btnModeFrequent && btnModeAll) {
    btnModeFrequent.addEventListener('click', () => {
      State.catalogMode = 'frequent';
      btnModeFrequent.classList.add('active');
      btnModeAll.classList.remove('active');
      if (catWrapper) catWrapper.style.display = 'none';
      renderProductListTable(State.products);
    });

    btnModeAll.addEventListener('click', () => {
      State.catalogMode = 'all';
      btnModeAll.classList.add('active');
      btnModeFrequent.classList.remove('active');
      if (catWrapper) catWrapper.style.display = 'block';
      renderProductListTable(State.products);
    });
  }

  // Modales abrir
  const btnOpenProductModal = document.getElementById('btnOpenProductModal');
  if (btnOpenProductModal) btnOpenProductModal.addEventListener('click', openProductModalForCreate);

  const btnOpenCustomerModal = document.getElementById('btnOpenCustomerModal');
  if (btnOpenCustomerModal) btnOpenCustomerModal.addEventListener('click', openCustomerModalForCreate);

  const btnOpenCategoryModal = document.getElementById('btnOpenCategoryModal');
  if (btnOpenCategoryModal) btnOpenCategoryModal.addEventListener('click', openCategoryModalForCreate);

  // ==================== ALERTAS DE STOCK BAJO & FILTROS DE INVENTARIO ====================
  const btnFilterAllStock = document.getElementById('btnFilterAllStock');
  const btnViewLowStock = document.getElementById('btnViewLowStock');
  const btnFilterZeroStock = document.getElementById('btnFilterZeroStock');
  const btnGeneratePurchaseList = document.getElementById('btnGeneratePurchaseList');

  if (btnFilterAllStock) {
    btnFilterAllStock.addEventListener('click', () => {
      inventoryFilterMode = 'all';
      applyInventoryFilters();
    });
  }

  if (btnViewLowStock) {
    btnViewLowStock.addEventListener('click', () => {
      inventoryFilterMode = (inventoryFilterMode === 'low') ? 'all' : 'low';
      applyInventoryFilters();
    });
  }

  if (btnFilterZeroStock) {
    btnFilterZeroStock.addEventListener('click', () => {
      inventoryFilterMode = (inventoryFilterMode === 'zero') ? 'all' : 'zero';
      applyInventoryFilters();
    });
  }

  // Barra de búsqueda de inventario en tiempo real
  const inventorySearchInput = document.getElementById('inventorySearchInput');
  const btnInventorySearchClear = document.getElementById('btnInventorySearchClear');
  const inventoryCategoryFilter = document.getElementById('inventoryCategoryFilter');
  const btnResetInventoryFilter = document.getElementById('btnResetInventoryFilter');

  if (inventorySearchInput) {
    inventorySearchInput.addEventListener('input', (e) => {
      inventorySearchQuery = e.target.value;
      if (btnInventorySearchClear) {
        btnInventorySearchClear.style.display = inventorySearchQuery ? 'inline-block' : 'none';
      }
      applyInventoryFilters();
    });
  }

  if (btnInventorySearchClear) {
    btnInventorySearchClear.addEventListener('click', () => {
      if (inventorySearchInput) inventorySearchInput.value = '';
      inventorySearchQuery = '';
      btnInventorySearchClear.style.display = 'none';
      applyInventoryFilters();
      if (inventorySearchInput) inventorySearchInput.focus();
    });
  }

  if (inventoryCategoryFilter) {
    inventoryCategoryFilter.addEventListener('change', (e) => {
      inventorySelectedCategory = e.target.value;
      applyInventoryFilters();
    });
  }

  if (btnResetInventoryFilter) {
    btnResetInventoryFilter.addEventListener('click', resetInventoryFilters);
  }

  // Modal de Pedido a Proveedor / Lista de Reposición
  if (btnGeneratePurchaseList) {
    btnGeneratePurchaseList.addEventListener('click', openPurchaseListModal);
  }

  const btnCopyPurchaseList = document.getElementById('btnCopyPurchaseList');
  if (btnCopyPurchaseList) {
    btnCopyPurchaseList.addEventListener('click', copyPurchaseListForWhatsApp);
  }

  const btnPrintPurchaseTicket = document.getElementById('btnPrintPurchaseTicket');
  if (btnPrintPurchaseTicket) {
    btnPrintPurchaseTicket.addEventListener('click', printPurchaseListTicket);
  }

  function openPurchaseListModal() {
    const allProds = State.products || [];
    const lowProds = allProds.filter(p => parseFloat(p.stock || 0) <= parseFloat(p.min_stock || 5));

    if (!lowProds.length) {
      showToast('✨ Todos los productos cuentan con stock suficiente. No hay artículos críticos para reponer.', 'success');
      return;
    }

    const tbody = document.getElementById('purchaseListTableBody');
    const itemsCountEl = document.getElementById('pssItemsCount');
    const unitsCountEl = document.getElementById('pssUnitsCount');
    const costEl = document.getElementById('pssEstimatedCost');

    let totalUnitsToOrder = 0;
    let totalEstimatedCost = 0;

    if (tbody) {
      tbody.innerHTML = lowProds.map((p, i) => {
        const stock = parseFloat(p.stock || 0);
        const min = parseFloat(p.min_stock || 5);
        const isZero = stock <= 0;
        const targetStock = min * 2;
        const suggestedQty = Math.max(1, Math.ceil(targetStock - stock));
        const purchasePrice = parseFloat(p.purchase_price || 0);
        const subtotal = suggestedQty * purchasePrice;

        totalUnitsToOrder += suggestedQty;
        totalEstimatedCost += subtotal;

        const unitText = p.unit_measure || 'UNIDAD';
        const stockDisplay = isZero 
          ? `<strong style="color:var(--danger)">0 (AGOTADO)</strong>`
          : `<span style="color:var(--warning); font-weight:700;">${stock.toFixed(p.is_bulk ? 3 : 0)} ${unitText}</span>`;

        return `
          <tr>
            <td style="color:var(--text-dim)">${i + 1}</td>
            <td><span class="barcode-badge">${p.barcode}</span></td>
            <td><strong>${p.name}</strong><br><small style="color:var(--text-muted);">${p.brand_name || ''}</small></td>
            <td>${stockDisplay}</td>
            <td style="font-family:var(--font-mono)">${min.toFixed(p.is_bulk ? 3 : 0)}</td>
            <td style="font-family:var(--font-mono); color:var(--primary); font-weight:800; font-size:13px;">
              +${suggestedQty} ${unitText}
            </td>
            <td style="font-family:var(--font-mono)">S/. ${purchasePrice.toFixed(2)}</td>
            <td style="font-family:var(--font-mono); color:var(--success); font-weight:700">S/. ${subtotal.toFixed(2)}</td>
          </tr>
        `;
      }).join('');
    }

    if (itemsCountEl) itemsCountEl.textContent = `${lowProds.length} productos`;
    if (unitsCountEl) unitsCountEl.textContent = `+${totalUnitsToOrder} unidades`;
    if (costEl) costEl.textContent = `S/. ${totalEstimatedCost.toFixed(2)}`;

    openModal('purchaseListModal');
  }

  function copyPurchaseListForWhatsApp() {
    const allProds = State.products || [];
    const lowProds = allProds.filter(p => parseFloat(p.stock || 0) <= parseFloat(p.min_stock || 5));

    if (!lowProds.length) return;

    const dateStr = new Date().toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    let text = `📦 *PEDIDO DE REPOSICIÓN DE MERCADERÍA*\n`;
    text += `🏬 *VentaFácil POS*\n`;
    text += `📅 Fecha: ${dateStr}\n`;
    text += `────────────────────────────\n`;

    let totalQty = 0;
    let totalCost = 0;

    lowProds.forEach((p, idx) => {
      const stock = parseFloat(p.stock || 0);
      const min = parseFloat(p.min_stock || 5);
      const suggestedQty = Math.max(1, Math.ceil((min * 2) - stock));
      const purchasePrice = parseFloat(p.purchase_price || 0);
      const subtotal = suggestedQty * purchasePrice;
      totalQty += suggestedQty;
      totalCost += subtotal;

      const brand = p.brand_name ? ` (${p.brand_name})` : '';
      const status = stock <= 0 ? ' [AGOTADO]' : ` [Stock: ${stock}]`;
      text += `${idx + 1}. *${p.name}${brand}*\n`;
      text += `   • Código: ${p.barcode}\n`;
      text += `   • Cantidad a Pedir: *${suggestedQty} ${p.unit_measure || 'UNIDAD'}*${status}\n`;
      if (purchasePrice > 0) {
        text += `   • Costo Est.: S/. ${purchasePrice.toFixed(2)} | Subt: S/. ${subtotal.toFixed(2)}\n`;
      }
    });

    text += `────────────────────────────\n`;
    text += `📊 *TOTAL:* ${lowProds.length} productos | ${totalQty} unidades\n`;
    if (totalCost > 0) {
      text += `💰 *INVERSIÓN ESTIMADA:* S/. ${totalCost.toFixed(2)}\n`;
    }
    text += `\n_Generado automáticamente desde VentaFácil POS_`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        showToast('✅ Lista copiada al portapapeles. Pégala directamente en WhatsApp para tu proveedor.', 'success');
      }).catch(() => {
        showToast('⚠️ No se pudo copiar automáticamente.', 'warning');
      });
    } else {
      showToast('✅ Lista generada con éxito.', 'success');
    }
  }

  function printPurchaseListTicket() {
    const allProds = State.products || [];
    const lowProds = allProds.filter(p => parseFloat(p.stock || 0) <= parseFloat(p.min_stock || 5));

    if (!lowProds.length) return;

    const dateStr = new Date().toLocaleString('es-PE');
    let lines = [];
    lines.push('================================');
    lines.push('    PEDIDO DE REPOSICION POS    ');
    lines.push('       VENTAFACIL MARKET        ');
    lines.push('================================');
    lines.push(`Fecha: ${dateStr}`);
    lines.push('--------------------------------');
    lines.push('PRODUCTO / CODIGO          CANT.');
    lines.push('--------------------------------');

    let totalQty = 0;
    let totalCost = 0;

    lowProds.forEach((p, idx) => {
      const stock = parseFloat(p.stock || 0);
      const min = parseFloat(p.min_stock || 5);
      const suggestedQty = Math.max(1, Math.ceil((min * 2) - stock));
      const pPrice = parseFloat(p.purchase_price || 0);
      totalQty += suggestedQty;
      totalCost += (suggestedQty * pPrice);

      let name = p.name.substring(0, 24);
      let qtyStr = `${suggestedQty} ${p.unit_measure === 'KG' ? 'Kg' : 'Und'}`;
      lines.push(`${(idx + 1)}. ${name}`);
      lines.push(`   ${p.barcode.padEnd(16)} -> ${qtyStr.padStart(10)}`);
    });

    lines.push('--------------------------------');
    lines.push(`TOTAL ARTICULOS: ${lowProds.length}`);
    lines.push(`TOTAL UNIDADES:  ${totalQty}`);
    if (totalCost > 0) {
      lines.push(`COSTO ESTIMADO:  S/. ${totalCost.toFixed(2)}`);
    }
    lines.push('================================');
    lines.push('     LISTO PARA COMPRAS         \n\n\n');

    const ticketText = lines.join('\n');
    const printWin = window.open('', '', 'width=400,height=600');
    if (printWin) {
      printWin.document.write(`<html><head><title>Pedido de Reposicion</title><style>body{font-family:monospace;font-size:12px;white-space:pre;padding:10px;line-height:1.35;}</style></head><body>${ticketText}</body></html>`);
      printWin.document.close();
      printWin.focus();
      printWin.print();
      printWin.close();
    }
  }

  // Filtro por Estado SUNAT
  const sunatFilterStatus = document.getElementById('sunatFilterStatus');
  if (sunatFilterStatus) {
    sunatFilterStatus.addEventListener('change', () => {
      const filterVal = sunatFilterStatus.value;
      if (!State.salesHistory) return;
      const filtered = filterVal
        ? State.salesHistory.filter(s => s.sunat_status === filterVal)
        : State.salesHistory;
      renderSunatTable(filtered);
    });
  }

  const btnOpenEditTemplatesSunat = document.getElementById('btnOpenEditTemplatesSunat');
  if (btnOpenEditTemplatesSunat) btnOpenEditTemplatesSunat.addEventListener('click', () => openModal('editTemplateModal'));

  const btnSyncSunat = document.getElementById('btnSyncSunat');
  if (btnSyncSunat) {
    btnSyncSunat.addEventListener('click', async () => {
      btnSyncSunat.textContent = '⏳ Sincronizando...';
      try {
        const res = await fetch('/api/sunat/sync', { method: 'POST' });
        const json = await res.json();
        alert(`✅ Sincronización finalizada:\n${json.syncedCount || 0} comprobantes sincronizados.`);
        loadSalesHistory();
      } catch (err) {
        alert('❌ Error al sincronizar con SUNAT: ' + err.message);
      } finally {
        btnSyncSunat.textContent = '🔄 Sincronizar con SUNAT';
      }
    });
  }

  // Generador de SKU
  const btnGenBarcode = document.getElementById('btnGenBarcode');
  if (btnGenBarcode) {
    btnGenBarcode.addEventListener('click', () => {
      const nextSku = calculateNextSku();
      if (document.getElementById('prodSku')) document.getElementById('prodSku').value = nextSku;
    });
  }

  // Modales cerrar
  document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', () => {
      const modalId = btn.dataset.modal || btn.closest('.modal-overlay')?.id;
      if (modalId) closeModal(modalId);
    });
  });

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal(overlay.id);
    });
  });

  // Cerrar modales con tecla Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const activeModal = document.querySelector('.modal-overlay.active');
      if (activeModal) {
        closeModal(activeModal.id);
        if (activeModal.id === 'systemDialogModal' && sysDialogResolver) {
          sysDialogResolver(false);
          sysDialogResolver = null;
        }
      }
    }
  });

  // Botones del Diálogo del Sistema
  const btnSysDialogConfirm = document.getElementById('btnSysDialogConfirm');
  if (btnSysDialogConfirm) {
    btnSysDialogConfirm.addEventListener('click', () => {
      closeModal('systemDialogModal');
      if (sysDialogResolver) {
        sysDialogResolver(true);
        sysDialogResolver = null;
      }
    });
  }

  const btnSysDialogCancel = document.getElementById('btnSysDialogCancel');
  if (btnSysDialogCancel) {
    btnSysDialogCancel.addEventListener('click', () => {
      closeModal('systemDialogModal');
      if (sysDialogResolver) {
        sysDialogResolver(false);
        sysDialogResolver = null;
      }
    });
  }

  // Imprimir Ticket desde Modal de Vista Previa
  const btnPrintTicketWindow = document.getElementById('btnPrintTicketWindow');
  if (btnPrintTicketWindow) {
    btnPrintTicketWindow.addEventListener('click', async () => {
      const saleId = btnPrintTicketWindow.dataset.saleId;
      if (saleId) {
        await printSaleDirect(saleId);
        closeModal('ticketModal');
        return;
      }

      const content = document.getElementById('receiptPaperText')?.textContent || '';
      const cfg = PrinterConfig.get();
      const printerName = cfg.deviceName || 'POS-58-Series';
      const paperWidth = cfg.paperWidth || '58';

      try {
        const res = await fetch('/api/printers/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ printerName, paperWidth, ticketText: content })
        });
        const json = await res.json();
        if (json.success) {
          alert(`✅ Ticket impreso físicamente en "${printerName}".`);
          closeModal('ticketModal');
          return;
        }
      } catch (err) {
        console.warn('Fallo impresión directa, abriendo diálogo:', err);
      }

      // Fallback: diálogo de impresión
      const w = window.open('', '', 'width=340,height=600');
      if (w) {
        w.document.write(`<html><head><title>Ticket 58mm</title>
          <style>body{font-family:monospace;font-size:11px;white-space:pre-wrap;margin:4px}@media print{body{width:58mm;margin:0}}</style>
        </head><body>${content}</body></html>`);
        w.document.close();
        w.print();
      }
    });
  }

  // Registrar Abono
  const btnRegistrarAbono = document.getElementById('btnRegistrarAbono');
  if (btnRegistrarAbono) {
    btnRegistrarAbono.addEventListener('click', async () => {
      const custId = parseInt(document.getElementById('fiadoDetailCustId')?.value);
      const amount = parseFloat(document.getElementById('abonoAmountInput')?.value || 0);
      const method = document.getElementById('abonoMethodSelect')?.value || 'EFECTIVO';

      if (!custId || amount <= 0) {
        alert('Por favor ingrese un monto de abono válido mayor a S/. 0.00');
        return;
      }

      try {
        const res = await fetch('/api/customers/payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customer_id: custId, amount, payment_method: method })
        });
        const json = await res.json();
        if (json.success) {
          alert(`✅ Abono de S/. ${amount.toFixed(2)} registrado exitosamente.`);
          closeModal('fiadoDetailModal');
          loadCustomers();
        } else {
          alert(`❌ Error al registrar abono: ${json.error}`);
        }
      } catch (err) {
        alert('❌ Error: ' + err.message);
      }
    });
  }

  // ==================== CSV / SHEETS IMPORT MODAL ====================
  const btnOpenImportCsvModal = document.getElementById('btnOpenImportCsvModal');
  let selectedCsvText = '';

  if (btnOpenImportCsvModal) {
    btnOpenImportCsvModal.addEventListener('click', () => {
      openModal('importCsvModal');
      selectedCsvText = '';
      const info = document.getElementById('fileSelectedInfo');
      if (info) info.style.display = 'none';
      const res = document.getElementById('importStatusResult');
      if (res) res.style.display = 'none';
      const fileInput = document.getElementById('csvFileInput');
      if (fileInput) fileInput.value = '';
      const urlInput = document.getElementById('csvUrlInput');
      if (urlInput) urlInput.value = '';
    });
  }

  const tabOptionFile = document.getElementById('tabOptionFile');
  const tabOptionUrl = document.getElementById('tabOptionUrl');
  const sectionOptionFile = document.getElementById('sectionOptionFile');
  const sectionOptionUrl = document.getElementById('sectionOptionUrl');

  if (tabOptionFile && tabOptionUrl) {
    tabOptionFile.addEventListener('click', () => {
      tabOptionFile.className = 'btn-sm btn-primary active';
      tabOptionUrl.className = 'btn-sm btn-secondary';
      if (sectionOptionFile) sectionOptionFile.style.display = 'block';
      if (sectionOptionUrl) sectionOptionUrl.style.display = 'none';
    });

    tabOptionUrl.addEventListener('click', () => {
      tabOptionUrl.className = 'btn-sm btn-primary active';
      tabOptionFile.className = 'btn-sm btn-secondary';
      if (sectionOptionFile) sectionOptionFile.style.display = 'none';
      if (sectionOptionUrl) sectionOptionUrl.style.display = 'block';
    });
  }

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
    if (!file.name.toLowerCase().endsWith('.csv')) {
      alert('Por favor selecciona un archivo con extensión .csv');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      selectedCsvText = e.target.result;
      if (fileSelectedInfo) {
        fileSelectedInfo.style.display = 'block';
        fileSelectedInfo.textContent = `📄 Archivo seleccionado: ${file.name} (${Math.round(file.size / 1024)} KB)`;
      }
    };
    reader.readAsText(file, 'UTF-8');
  }

  const btnExecuteImport = document.getElementById('btnExecuteImport');
  if (btnExecuteImport) {
    btnExecuteImport.addEventListener('click', async () => {
      const isFileTab = sectionOptionFile && sectionOptionFile.style.display !== 'none';
      const sheetsUrl = document.getElementById('csvUrlInput')?.value.trim() || '';

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
      if (importStatusResult) importStatusResult.style.display = 'none';

      try {
        const payload = isFileTab ? { csvText: selectedCsvText } : { sheetsUrl };
        const response = await fetch('/api/products/import-csv', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (result.success) {
          if (importStatusResult) {
            importStatusResult.className = 'alert-banner text-success';
            importStatusResult.style.display = 'block';
          }
          if (importStatusText) {
            importStatusText.innerHTML = `
              <strong>✅ Importación completada con éxito:</strong><br>
              • ${result.stats.importedCount} productos nuevos insertados<br>
              • ${result.stats.updatedCount} productos actualizados<br>
              • ${result.stats.categoryCount} categorías procesadas<br>
              • ${result.stats.brandCount} marcas procesadas
            `;
          }

          loadProducts();
          loadCategories();
        } else {
          if (importStatusResult) {
            importStatusResult.className = 'alert-banner text-danger';
            importStatusResult.style.display = 'block';
          }
          if (importStatusText) {
            importStatusText.textContent = '❌ Error: ' + (result.error || 'Error en el formato de importación');
          }
        }
      } catch (err) {
        if (importStatusResult) {
          importStatusResult.className = 'alert-banner text-danger';
          importStatusResult.style.display = 'block';
        }
        if (importStatusText) {
          importStatusText.textContent = '❌ Error de comunicación: ' + err.message;
        }
      } finally {
        btnExecuteImport.disabled = false;
        btnExecuteImport.textContent = '⚡ IMPORTAR AHORA';
      }
    });
  }

  // Sincronización automática de Tipo de Venta y Unidad de Medida
  const prodIsBulk = document.getElementById('prodIsBulk');
  const prodUnit = document.getElementById('prodUnit');
  if (prodIsBulk && prodUnit) {
    prodIsBulk.addEventListener('change', () => {
      if (prodIsBulk.value === '1') {
        prodUnit.value = 'KG';
      } else if (prodIsBulk.value === '0') {
        prodUnit.value = 'UNIDAD';
      }
    });
  }

  // Guardar / Editar Producto Manual
  const productForm = document.getElementById('productForm');
  if (productForm) {
    productForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        sku: document.getElementById('prodSku')?.value.trim(),
        barcode: document.getElementById('prodBarcode')?.value.trim() || null,
        name: document.getElementById('prodName')?.value.trim(),
        category_id: document.getElementById('prodCategory')?.value || null,
        purchase_price: parseFloat(document.getElementById('prodCostPrice')?.value || 0),
        sale_price: parseFloat(document.getElementById('prodSalePrice')?.value || 0),
        stock: parseFloat(document.getElementById('prodStock')?.value || 0),
        min_stock: parseFloat(document.getElementById('prodMinStock')?.value || 5),
        unit_measure: document.getElementById('prodUnit')?.value || 'UNIDAD',
        is_bulk: document.getElementById('prodIsBulk')?.value === '1' ? 1 : 0
      };

      try {
        const url = editingSku ? `/api/products/${encodeURIComponent(editingSku)}` : '/api/products';
        const method = editingSku ? 'PUT' : 'POST';

        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (json.success) {
          showToast(editingSku ? '✅ Producto actualizado exitosamente' : '✅ Producto registrado exitosamente', 'success');
          closeModal('productModal');
          editingSku = null;
          productForm.reset();
          loadProducts();
        } else {
          showToast('❌ Error: ' + json.error, 'error');
        }
      } catch (err) {
        showToast('❌ Error al guardar producto: ' + err.message, 'error');
      }
    });
  }

  // Guardar / Editar Cliente Manual
  const customerForm = document.getElementById('customerForm');
  if (customerForm) {
    customerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        name: document.getElementById('custName')?.value.trim(),
        document_type: document.getElementById('custDocType')?.value || '1',
        document_number: document.getElementById('custDoc')?.value.trim(),
        phone: document.getElementById('custPhone')?.value.trim(),
        credit_limit: parseFloat(document.getElementById('custCreditLimit')?.value || 200)
      };

      try {
        const url = editingCustomerId ? `/api/customers/${editingCustomerId}` : '/api/customers';
        const method = editingCustomerId ? 'PUT' : 'POST';

        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (json.success) {
          alert(editingCustomerId ? '✅ Datos del cliente actualizados' : '✅ Cliente registrado exitosamente');
          closeModal('customerModal');
          editingCustomerId = null;
          customerForm.reset();
          loadCustomers();
        } else {
          alert('❌ Error: ' + json.error);
        }
      } catch (err) {
        alert('❌ Error al guardar cliente: ' + err.message);
      }
    });
  }

  // Guardar / Editar Categoría Manual
  const categoryForm = document.getElementById('categoryForm');
  if (categoryForm) {
    categoryForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        name: document.getElementById('catName')?.value.trim(),
        description: document.getElementById('catDescription')?.value.trim()
      };

      try {
        const url = editingCategoryId ? `/api/categories/${editingCategoryId}` : '/api/categories';
        const method = editingCategoryId ? 'PUT' : 'POST';

        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (json.success) {
          alert(editingCategoryId ? '✅ Categoría actualizada exitosamente' : '✅ Categoría creada exitosamente');
          closeModal('categoryModal');
          editingCategoryId = null;
          categoryForm.reset();
          loadCategories();
        } else {
          alert('❌ Error: ' + json.error);
        }
      } catch (err) {
        alert('❌ Error: ' + err.message);
      }
    });
  }

  // Guardar Config SUNAT
  const formTemplateSunat = document.getElementById('formTemplateSunat');
  if (formTemplateSunat) {
    formTemplateSunat.addEventListener('submit', async (e) => {
      e.preventDefault();
      const ruc = document.getElementById('tplSunatRuc')?.value.trim();
      const razonSocial = document.getElementById('tplSunatRazonSocial')?.value.trim();
      const direccion = document.getElementById('tplSunatDireccion')?.value.trim();
      const ambiente = document.getElementById('tplSunatAmbiente')?.value;

      const config = { ruc, razon_social: razonSocial, direccion, ambiente };
      localStorage.setItem('vf_sunat_config', JSON.stringify(config));

      if (document.getElementById('cfgRuc')) document.getElementById('cfgRuc').textContent = ruc;
      if (document.getElementById('cfgRazonSocial')) document.getElementById('cfgRazonSocial').textContent = razonSocial;
      if (document.getElementById('cfgDireccion')) document.getElementById('cfgDireccion').textContent = direccion;
      if (document.getElementById('cfgAmbiente')) document.getElementById('cfgAmbiente').textContent = ambiente;

      alert('✅ Datos del Emisor SUNAT guardados y actualizados.');
      closeModal('editTemplateModal');
    });
  }

  // ==================== MÓDULO DE GESTIÓN Y SINCRONIZACIÓN DE IMPRESORA ====================
  // Botón superior de impresora -> Abre directamente la pestaña de Configuración
  const btnOpenPrinterConfig = document.getElementById('btnOpenPrinterConfig');
  if (btnOpenPrinterConfig) {
    btnOpenPrinterConfig.addEventListener('click', () => {
      switchTab('settingsTab');
      const card = document.getElementById('cardPrinterConfig');
      if (card) card.scrollIntoView({ behavior: 'smooth' });
    });
  }

  const btnRefreshPrinters = document.getElementById('btnRefreshPrinters');
  if (btnRefreshPrinters) {
    btnRefreshPrinters.addEventListener('click', () => {
      loadSystemPrinters();
    });
  }

  const btnSettingsRefreshPrinters = document.getElementById('btnSettingsRefreshPrinters');
  if (btnSettingsRefreshPrinters) {
    btnSettingsRefreshPrinters.addEventListener('click', () => {
      loadSystemPrinters();
    });
  }

  const btnTestPrinter = document.getElementById('btnTestPrinter');
  if (btnTestPrinter) {
    btnTestPrinter.addEventListener('click', () => {
      const select = document.getElementById('selectPrinterDevice');
      const paperWidth = document.getElementById('printerPaperWidth')?.value || '58';
      const printerName = select ? select.value : 'POS-58';
      testPrinterPrintAction(printerName, paperWidth);
    });
  }

  const btnSettingsTestPrinter = document.getElementById('btnSettingsTestPrinter');
  if (btnSettingsTestPrinter) {
    btnSettingsTestPrinter.addEventListener('click', () => {
      const select = document.getElementById('settingsSelectPrinterDevice');
      const paperWidth = document.getElementById('settingsPrinterPaperWidth')?.value || '58';
      const printerName = select ? select.value : 'POS-58';
      testPrinterPrintAction(printerName, paperWidth);
    });
  }

  // Guardar Impresora desde Tarjeta de Configuración
  const formSettingsPrinter = document.getElementById('formSettingsPrinter');
  if (formSettingsPrinter) {
    formSettingsPrinter.addEventListener('submit', (e) => {
      e.preventDefault();
      const select = document.getElementById('settingsSelectPrinterDevice');
      const paperWidth = document.getElementById('settingsPrinterPaperWidth')?.value || '58';
      const printMode = document.getElementById('settingsPrinterPrintMode')?.value || 'direct';
      const printOnSale = document.getElementById('settingsChkPrintOnSale')?.checked;

      const config = {
        deviceName: select ? select.value : 'POS-58-Series',
        paperWidth,
        printMode,
        printOnSale
      };

      PrinterConfig.save(config);
      alert(`✅ Impresora "${config.deviceName}" guardada y sincronizada como predeterminada.`);
    });
  }

  // Guardar Datos SUNAT / Empresa desde Configuración
  const formSettingsSunat = document.getElementById('formSettingsSunat');
  if (formSettingsSunat) {
    formSettingsSunat.addEventListener('submit', (e) => {
      e.preventDefault();
      const ruc = document.getElementById('settingsSunatRuc')?.value.trim();
      const razonSocial = document.getElementById('settingsSunatRazonSocial')?.value.trim();
      const direccion = document.getElementById('settingsSunatDireccion')?.value.trim();
      const serie = document.getElementById('settingsSunatSerie')?.value.trim() || 'B001';
      const ambiente = document.getElementById('settingsSunatAmbiente')?.value;

      const config = { ruc, razon_social: razonSocial, direccion, serie, ambiente };
      localStorage.setItem('vf_sunat_config', JSON.stringify(config));

      if (document.getElementById('cfgRuc')) document.getElementById('cfgRuc').textContent = ruc;
      if (document.getElementById('cfgRazonSocial')) document.getElementById('cfgRazonSocial').textContent = razonSocial;
      if (document.getElementById('cfgDireccion')) document.getElementById('cfgDireccion').textContent = direccion;
      if (document.getElementById('cfgAmbiente')) document.getElementById('cfgAmbiente').textContent = ambiente;

      alert('✅ Datos de la Empresa y SUNAT guardados exitosamente.');
    });
  }

  // ==================== EDITOR Y PERSONALIZADOR DE TICKET 58MM ====================
  const formSettingsTicketTemplate = document.getElementById('formSettingsTicketTemplate');
  if (formSettingsTicketTemplate) {
    formSettingsTicketTemplate.addEventListener('submit', (e) => {
      e.preventDefault();
      const tpl = {
        companyName: document.getElementById('tplTicketCompanyName')?.value.trim() || 'COMERCIAL BELEZA & HOGAR',
        ruc: document.getElementById('tplTicketRuc')?.value.trim() || '20601234567',
        address: document.getElementById('tplTicketAddress')?.value.trim() || 'Av. Las Flores 456, Lima',
        footer1: document.getElementById('tplTicketFooter1')?.value.trim() || '¡Gracias por su preferencia!',
        footer2: document.getElementById('tplTicketFooter2')?.value.trim() || 'Conserve este comprobante',
        fontSize: parseFloat(document.getElementById('tplTicketFontSize')?.value) || 7.2,
        marginLeft: parseInt(document.getElementById('tplTicketMarginLeft')?.value, 10) || 3,
        columns: parseInt(document.getElementById('tplTicketColumns')?.value, 10) || 32
      };

      TicketTemplateConfig.save(tpl);
      alert('✅ Plantilla y calibración de tamaño guardadas exitosamente.');
    });
  }

  // Live preview en tiempo real al tipear o mover sliders
  ['tplTicketCompanyName', 'tplTicketRuc', 'tplTicketAddress', 'tplTicketFooter1', 'tplTicketFooter2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updateTicketLivePreview);
  });

  const tplTicketFontSize = document.getElementById('tplTicketFontSize');
  if (tplTicketFontSize) {
    tplTicketFontSize.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value).toFixed(1);
      const lbl = document.getElementById('lblTicketFontSize');
      if (lbl) lbl.textContent = `${val} pt`;
      updateTicketLivePreview();
    });
  }

  const tplTicketMarginLeft = document.getElementById('tplTicketMarginLeft');
  if (tplTicketMarginLeft) {
    tplTicketMarginLeft.addEventListener('input', (e) => {
      const val = e.target.value;
      const lbl = document.getElementById('lblTicketMarginLeft');
      if (lbl) lbl.textContent = `${val} px`;
      updateTicketLivePreview();
    });
  }

  const tplTicketColumns = document.getElementById('tplTicketColumns');
  if (tplTicketColumns) {
    tplTicketColumns.addEventListener('change', updateTicketLivePreview);
  }

  // Restaurar plantilla predeterminada
  const btnSettingsResetTicketTpl = document.getElementById('btnSettingsResetTicketTpl');
  if (btnSettingsResetTicketTpl) {
    btnSettingsResetTicketTpl.addEventListener('click', () => {
      const defaultTpl = {
        companyName: 'COMERCIAL BELEZA & HOGAR',
        ruc: '20601234567',
        address: 'Av. Las Flores 456, Lima',
        footer1: '¡Gracias por su preferencia!',
        footer2: 'Conserve este comprobante',
        fontSize: 7.2,
        marginLeft: 3,
        columns: 32
      };

      if (document.getElementById('tplTicketCompanyName')) document.getElementById('tplTicketCompanyName').value = defaultTpl.companyName;
      if (document.getElementById('tplTicketRuc')) document.getElementById('tplTicketRuc').value = defaultTpl.ruc;
      if (document.getElementById('tplTicketAddress')) document.getElementById('tplTicketAddress').value = defaultTpl.address;
      if (document.getElementById('tplTicketFooter1')) document.getElementById('tplTicketFooter1').value = defaultTpl.footer1;
      if (document.getElementById('tplTicketFooter2')) document.getElementById('tplTicketFooter2').value = defaultTpl.footer2;
      if (document.getElementById('tplTicketFontSize')) document.getElementById('tplTicketFontSize').value = defaultTpl.fontSize;
      if (document.getElementById('lblTicketFontSize')) document.getElementById('lblTicketFontSize').textContent = `${defaultTpl.fontSize} pt`;
      if (document.getElementById('tplTicketMarginLeft')) document.getElementById('tplTicketMarginLeft').value = defaultTpl.marginLeft;
      if (document.getElementById('lblTicketMarginLeft')) document.getElementById('lblTicketMarginLeft').textContent = `${defaultTpl.marginLeft} px`;
      if (document.getElementById('tplTicketColumns')) document.getElementById('tplTicketColumns').value = defaultTpl.columns;

      TicketTemplateConfig.save(defaultTpl);
      alert('↺ Calibración y plantilla de ticket restauradas a valores predeterminados.');
    });
  }

  // Probar impresión con la plantilla personalizada actual
  const btnSettingsTestCustomTicket = document.getElementById('btnSettingsTestCustomTicket');
  if (btnSettingsTestCustomTicket) {
    btnSettingsTestCustomTicket.addEventListener('click', async () => {
      const cfg = PrinterConfig.get();
      const tplCfg = TicketTemplateConfig.get();
      const printerName = cfg.deviceName || 'POS-58-Series';
      const paperWidth = cfg.paperWidth || '58';
      const previewText = document.getElementById('settingsTicketLivePreview')?.textContent || '';

      try {
        const res = await fetch('/api/printers/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            printerName,
            paperWidth,
            ticketText: previewText,
            fontSize: tplCfg.fontSize || 7.2,
            marginLeft: tplCfg.marginLeft || 3
          })
        });
        const json = await res.json();
        if (json.success) {
          alert(`✅ ¡TICKET DE PRUEBA PERSONALIZADO IMPRESO!\n\nEnviado a "${printerName}" (Tamaño: ${tplCfg.fontSize}pt, Margen: ${tplCfg.marginLeft}px).`);
        } else {
          alert(`❌ Error al imprimir: ${json.error}`);
        }
      } catch (err) {
        alert('❌ Error de comunicación con la impresora: ' + err.message);
      }
    });
  }

  // Inicializar estado de la impresora en la barra superior
  updateTopbarPrinterBadge();
});

// ============================================================
// OBJETO Y CONTROLADOR DE IMPRESORA TÉRMICA & CONFIGURACIÓN
// ============================================================
const PrinterConfig = {
  get: () => {
    try {
      return JSON.parse(localStorage.getItem('vf_printer_config')) || {
        deviceName: 'POS-58-Series',
        paperWidth: '58',
        printMode: 'direct',
        autoCut: true,
        openDrawer: true,
        printOnSale: true
      };
    } catch {
      return { deviceName: 'POS-58-Series', paperWidth: '58', printMode: 'direct', autoCut: true, openDrawer: true, printOnSale: true };
    }
  },
  save: (cfg) => {
    localStorage.setItem('vf_printer_config', JSON.stringify(cfg));
    updateTopbarPrinterBadge();
  }
};

function updateTopbarPrinterBadge() {
  const cfg = PrinterConfig.get();
  const topbarName = document.getElementById('topbarPrinterName');
  if (topbarName) {
    topbarName.textContent = `${cfg.deviceName || 'POS-58-Series'} (${cfg.paperWidth}mm)`;
  }
}

async function testPrinterPrintAction(printerName, paperWidth) {
  try {
    const res = await fetch('/api/printers/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ printerName, paperWidth })
    });
    const json = await res.json();
    if (json.success) {
      alert(`✅ ¡TICKET DE PRUEBA IMPRESO!\n\nImpresora: ${printerName}\nAncho de Rollo: ${paperWidth}mm\n\nEl trabajo de impresión fue despachado exitosamente a la impresora física.`);
    } else {
      alert(`❌ Error al imprimir en "${printerName}":\n\n${json.error || 'Verifique que la impresora esté encendida con papel y cable USB conectado.'}`);
    }
  } catch (err) {
    alert('❌ Error de comunicación con la impresora: ' + err.message);
  }
}

async function loadSystemPrinters() {
  const selects = [
    document.getElementById('settingsSelectPrinterDevice'),
    document.getElementById('selectPrinterDevice')
  ].filter(Boolean);

  selects.forEach(sel => {
    sel.innerHTML = '<option value="">Buscando impresoras en Windows...</option>';
  });

  try {
    const res = await fetch('/api/printers');
    const json = await res.json();
    const printers = (json && json.data) ? json.data : [];
    let activeCfg = PrinterConfig.get();

    if (!printers.length) {
      selects.forEach(sel => {
        sel.innerHTML = '<option value="POS-58-Series">POS-58-Series (Impresora Térmica 58mm)</option>';
      });
      return;
    }

    // Auto-vincular a POS-58-Series o impresora predeterminada
    const exists = printers.some(p => p.Name === activeCfg.deviceName);
    if (!exists) {
      const defaultPrn = printers.find(p => p.Default) || printers.find(p => p.Name.toLowerCase().includes('pos') || p.Name.toLowerCase().includes('58')) || printers[0];
      if (defaultPrn) {
        activeCfg.deviceName = defaultPrn.Name;
        PrinterConfig.save(activeCfg);
      }
    }

    const optionsHtml = printers.map(p => {
      const isSelected = (p.Name === activeCfg.deviceName);
      return `<option value="${p.Name}" ${isSelected ? 'selected' : ''}>${p.Name} ${p.PortName ? `[${p.PortName}]` : ''} ${p.Default ? '(Predeterminada de Windows)' : ''}</option>`;
    }).join('');

    selects.forEach(sel => {
      sel.innerHTML = optionsHtml;
    });

    ['settingsPrinterStatusTitle', 'printerModalStatusTitle'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = `Impresora Lista (${printers.length} detectadas en Windows)`;
    });

    ['settingsPrinterStatusSubtitle', 'printerModalStatusSubtitle'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = `Conectada a ${activeCfg.deviceName} · Puerto USB verificado.`;
    });
  } catch (err) {
    console.error('Error cargando impresoras:', err);
    selects.forEach(sel => {
      sel.innerHTML = '<option value="POS-58-Series">POS-58-Series (Impresora Térmica 58mm)</option>';
    });
  }
}

function loadSettingsView() {
  const cfg = PrinterConfig.get();
  
  const paperSel = document.getElementById('settingsPrinterPaperWidth');
  const modeSel = document.getElementById('settingsPrinterPrintMode');
  const saleChk = document.getElementById('settingsChkPrintOnSale');

  if (paperSel) paperSel.value = cfg.paperWidth || '58';
  if (modeSel) modeSel.value = cfg.printMode || 'direct';
  if (saleChk) saleChk.checked = cfg.printOnSale !== false;

  const sunatCfg = JSON.parse(localStorage.getItem('vf_sunat_config')) || {
    ruc: '20601234567',
    razon_social: 'COMERCIAL BELEZA & HOGAR S.A.C.',
    direccion: 'Av. Las Flores 456, Lima',
    serie: 'B001',
    ambiente: 'BETA'
  };

  if (document.getElementById('settingsSunatRuc')) document.getElementById('settingsSunatRuc').value = sunatCfg.ruc || '';
  if (document.getElementById('settingsSunatRazonSocial')) document.getElementById('settingsSunatRazonSocial').value = sunatCfg.razon_social || '';
  if (document.getElementById('settingsSunatDireccion')) document.getElementById('settingsSunatDireccion').value = sunatCfg.direccion || '';
  if (document.getElementById('settingsSunatSerie')) document.getElementById('settingsSunatSerie').value = sunatCfg.serie || 'B001';
  if (document.getElementById('settingsSunatAmbiente')) document.getElementById('settingsSunatAmbiente').value = sunatCfg.ambiente || 'BETA';

  // Cargar valores del Editor de Plantilla de Ticket
  const tplCfg = TicketTemplateConfig.get();
  if (document.getElementById('tplTicketCompanyName')) document.getElementById('tplTicketCompanyName').value = tplCfg.companyName || 'COMERCIAL BELEZA & HOGAR';
  if (document.getElementById('tplTicketRuc')) document.getElementById('tplTicketRuc').value = tplCfg.ruc || '20601234567';
  if (document.getElementById('tplTicketAddress')) document.getElementById('tplTicketAddress').value = tplCfg.address || 'Av. Las Flores 456, Lima';
  if (document.getElementById('tplTicketFooter1')) document.getElementById('tplTicketFooter1').value = tplCfg.footer1 || '¡Gracias por su preferencia!';
  if (document.getElementById('tplTicketFooter2')) document.getElementById('tplTicketFooter2').value = tplCfg.footer2 || 'Conserve este comprobante';
  
  if (document.getElementById('tplTicketFontSize')) document.getElementById('tplTicketFontSize').value = tplCfg.fontSize || 7.1;
  if (document.getElementById('lblTicketFontSize')) document.getElementById('lblTicketFontSize').textContent = `${tplCfg.fontSize || 7.1} pt`;
  if (document.getElementById('tplTicketMarginLeft')) document.getElementById('tplTicketMarginLeft').value = tplCfg.marginLeft || 3;
  if (document.getElementById('lblTicketMarginLeft')) document.getElementById('lblTicketMarginLeft').textContent = `${tplCfg.marginLeft || 3} px`;
  if (document.getElementById('tplTicketColumns')) document.getElementById('tplTicketColumns').value = tplCfg.columns || 32;

  updateTicketLivePreview();
  loadSystemPrinters();
}

// Event Listeners de Configuración para Mantenimiento de Catálogo
document.addEventListener('DOMContentLoaded', () => {
  const btnSettingsClearInventory = document.getElementById('btnSettingsClearInventory');
  if (btnSettingsClearInventory) {
    btnSettingsClearInventory.addEventListener('click', async () => {
      const confirmed = await showAppConfirm(
        '⚠️ ATENCIÓN: ¿Está seguro de que desea VACIAR TODO EL INVENTARIO A CERO?\n\nEsta acción eliminará todos los productos registrados para permitirle cargar una nueva base de datos limpia.',
        'Vaciar Catálogo a Cero',
        'danger',
        '🗑️ Sí, Vaciar Inventario',
        'Cancelar'
      );
      if (!confirmed) return;

      try {
        const res = await fetch('/api/products/clear-catalog', { method: 'POST' });
        const json = await res.json();
        if (json.success) {
          showToast('✅ Catálogo de productos vaciado exitosamente a 0.', 'success');
          loadProducts();
          loadCategories();
        } else {
          showToast('❌ Error: ' + json.error, 'error');
        }
      } catch (err) {
        showToast('❌ Error de comunicación: ' + err.message, 'error');
      }
    });
  }
});

// ============================================================
// CONFIGURACIÓN DE PLANTILLA DE TICKET 58MM & LIVE PREVIEW
// ============================================================
const TicketTemplateConfig = {
  get: () => {
    try {
      return JSON.parse(localStorage.getItem('vf_ticket_template')) || {
        companyName: 'COMERCIAL BELEZA & HOGAR',
        ruc: '20601234567',
        address: 'Av. Las Flores 456, Lima',
        footer1: '¡Gracias por su preferencia!',
        footer2: 'Conserve este comprobante',
        fontSize: 7.1,
        marginLeft: 3,
        columns: 32
      };
    } catch {
      return {
        companyName: 'COMERCIAL BELEZA & HOGAR',
        ruc: '20601234567',
        address: 'Av. Las Flores 456, Lima',
        footer1: '¡Gracias por su preferencia!',
        footer2: 'Conserve este comprobante',
        fontSize: 7.1,
        marginLeft: 3,
        columns: 32
      };
    }
  },
  save: (cfg) => {
    localStorage.setItem('vf_ticket_template', JSON.stringify(cfg));
    updateTicketLivePreview();
  }
};

function updateTicketLivePreview() {
  const previewEl = document.getElementById('settingsTicketLivePreview');
  if (!previewEl) return;

  const companyName = document.getElementById('tplTicketCompanyName')?.value || 'COMERCIAL BELEZA & HOGAR';
  const ruc = document.getElementById('tplTicketRuc')?.value || '20601234567';
  const address = document.getElementById('tplTicketAddress')?.value || 'Av. Las Flores 456, Lima';
  const footer1 = document.getElementById('tplTicketFooter1')?.value || '¡Gracias por su preferencia!';
  const footer2 = document.getElementById('tplTicketFooter2')?.value || 'Conserve este comprobante';
  const fontSize = parseFloat(document.getElementById('tplTicketFontSize')?.value) || 7.2;
  const marginLeft = parseInt(document.getElementById('tplTicketMarginLeft')?.value, 10) || 3;
  const columns = parseInt(document.getElementById('tplTicketColumns')?.value, 10) || 32;

  // Ajustar tamaño de letra en la vista previa
  previewEl.style.fontSize = `${Math.max(9.5, Math.min(13.5, fontSize * 1.5))}px`;
  previewEl.style.paddingLeft = `${marginLeft}px`;

  const tpl = { companyName, ruc, address, footer1, footer2 };

  const sampleLines = [];
  const LINE_WIDTH = columns;

  function cText(t) {
    const s = String(t || '').trim();
    if (s.length >= LINE_WIDTH) return s.substring(0, LINE_WIDTH);
    const leftPad = Math.floor((LINE_WIDTH - s.length) / 2);
    return ' '.repeat(leftPad) + s;
  }

  function jBetween(l, r) {
    const ls = String(l || '');
    const rs = String(r || '');
    const maxL = LINE_WIDTH - rs.length - 1;
    const truncL = ls.length > maxL ? ls.substring(0, maxL) : ls;
    const sp = LINE_WIDTH - (truncL.length + rs.length);
    return truncL + ' '.repeat(Math.max(1, sp)) + rs;
  }

  sampleLines.push(cText(tpl.companyName));
  sampleLines.push(cText("RUC: " + tpl.ruc));
  sampleLines.push(cText(tpl.address));
  sampleLines.push("=".repeat(LINE_WIDTH));
  sampleLines.push(cText("BOLETA DE VENTA ELECTRÓNICA"));
  sampleLines.push(cText("B001-00000008"));
  sampleLines.push("-".repeat(LINE_WIDTH));
  sampleLines.push(jBetween("FECHA:", "18/08/26, 6:47 a.m."));
  sampleLines.push(jBetween("CAJERO:", "Administrador"));
  sampleLines.push(jBetween("CLIENTE:", "CLIENTE GENERAL"));
  sampleLines.push("-".repeat(LINE_WIDTH));
  sampleLines.push(jBetween("DESCRIPCION / CANT x P.U.", "TOTAL"));
  sampleLines.push("-".repeat(LINE_WIDTH));
  sampleLines.push("VENTURA BLNC. 600 ML 1 BOT");
  sampleLines.push(jBetween("  1x @ S/.4.00", "S/.4.00"));
  sampleLines.push("VENTURA TINT. 600 ML 1 BOT");
  sampleLines.push(jBetween("  1x @ S/.4.00", "S/.4.00"));
  sampleLines.push("3 OSITOS AVEN. PREC. 100 G");
  sampleLines.push(jBetween("  1x @ S/.1.20", "S/.1.20"));
  sampleLines.push("CEBOLLA ROJA");
  sampleLines.push(jBetween("  0.750kg @ S/.3.50", "S/.2.63"));
  sampleLines.push("-".repeat(LINE_WIDTH));
  sampleLines.push(jBetween("OP. GRAVADA:", "S/. 10.03"));
  sampleLines.push(jBetween("I.G.V. (18%):", "S/. 1.80"));
  sampleLines.push("-".repeat(LINE_WIDTH));
  sampleLines.push(jBetween("TOTAL A PAGAR:", "S/. 11.83"));
  sampleLines.push("=".repeat(LINE_WIDTH));
  sampleLines.push(jBetween("FORMA DE PAGO:", "EFECTIVO"));
  sampleLines.push(jBetween("IMPORTE PAGADO:", "S/. 20.00"));
  sampleLines.push(jBetween("VUELTO / CAMBIO:", "S/. 8.17"));
  sampleLines.push("=".repeat(LINE_WIDTH));
  sampleLines.push(cText("Representación Impresa de la"));
  sampleLines.push(cText("BOLETA DE VENTA ELECTRÓNICA"));
  sampleLines.push(cText("Autorizado según R.S. SUNAT"));
  sampleLines.push(cText("Hash: mnrtxek06neae110"));
  sampleLines.push("-".repeat(LINE_WIDTH));
  sampleLines.push(cText(tpl.footer1));
  if (tpl.footer2) sampleLines.push(cText(tpl.footer2));
  sampleLines.push("=".repeat(LINE_WIDTH));

  previewEl.textContent = sampleLines.join("\n");

  // Actualizar indicador dinámico de límites térmicos
  const badgeEl = document.getElementById('thermalMarginStatusBadge');
  const badgeText = document.getElementById('thermalMarginStatusText');
  if (badgeEl && badgeText) {
    const isExceeded = (fontSize > 8.0 && columns >= 32) || (fontSize > 7.6 && marginLeft > 4);
    if (isExceeded) {
      badgeEl.className = 'margin-status-badge warning';
      badgeText.textContent = `⚠️ Tamaño ${fontSize}pt / Margen ${marginLeft}px: Podría rozar el límite derecho en rollos de 58mm.`;
    } else {
      badgeEl.className = 'margin-status-badge safe';
      badgeText.textContent = `🟢 Calibración Óptima: Texto 100% dentro del cabezal térmico (${columns} cols).`;
    }
  }
}
