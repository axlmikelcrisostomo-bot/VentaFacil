PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS company_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ruc TEXT NOT NULL UNIQUE,
    razon_social TEXT NOT NULL,
    nombre_comercial TEXT,
    direccion TEXT,
    ubigeo TEXT DEFAULT '150101',
    departamento TEXT DEFAULT 'LIMA',
    provincia TEXT DEFAULT 'LIMA',
    distrito TEXT DEFAULT 'LIMA',
    sol_user TEXT,
    sol_pass TEXT,
    is_production INTEGER DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS brands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
    barcode TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    brand_id INTEGER,
    category_id INTEGER,
    purchase_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    sale_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    stock DECIMAL(10, 3) NOT NULL DEFAULT 0.000,
    min_stock DECIMAL(10, 3) DEFAULT 5.000,
    expiration_date TEXT,
    status TEXT DEFAULT 'DISPONIBLE',
    is_bulk INTEGER DEFAULT 0,
    unit_measure TEXT DEFAULT 'UNIDAD',
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
    FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);

CREATE TABLE IF NOT EXISTS stock_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id TEXT NOT NULL,
    movement_type TEXT NOT NULL,
    quantity DECIMAL(10, 3) NOT NULL,
    previous_stock DECIMAL(10, 3) NOT NULL,
    new_stock DECIMAL(10, 3) NOT NULL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(barcode) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'CASHIER',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_type TEXT DEFAULT '1',
    document_number TEXT UNIQUE,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    credit_limit DECIMAL(10, 2) DEFAULT 500.00,
    current_debt DECIMAL(10, 2) DEFAULT 0.00,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number TEXT NOT NULL UNIQUE,
    document_type TEXT NOT NULL DEFAULT '03',
    series TEXT NOT NULL DEFAULT 'B001',
    correlative_number INTEGER NOT NULL DEFAULT 1,
    user_id INTEGER,
    customer_id INTEGER,
    subtotal DECIMAL(10, 2) NOT NULL,
    igv DECIMAL(10, 2) DEFAULT 0.00,
    total_amount DECIMAL(10, 2) NOT NULL,
    amount_paid DECIMAL(10, 2) NOT NULL,
    change_due DECIMAL(10, 2) NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'EFECTIVO',
    is_paid INTEGER DEFAULT 1,
    due_date DATETIME,
    sunat_status TEXT DEFAULT 'PENDIENTE',
    sunat_hash TEXT,
    cdr_code TEXT,
    cdr_description TEXT,
    qr_code_data TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE INDEX IF NOT EXISTS idx_sales_invoice ON sales(invoice_number);
CREATE INDEX IF NOT EXISTS idx_sales_sunat_status ON sales(sunat_status);

CREATE TABLE IF NOT EXISTS sale_details (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL,
    product_id TEXT,
    product_name TEXT NOT NULL,
    barcode TEXT,
    unit_price DECIMAL(10, 2) NOT NULL,
    quantity DECIMAL(10, 3) NOT NULL,
    unit_measure TEXT DEFAULT 'UNIDAD',
    igv DECIMAL(10, 2) DEFAULT 0.00,
    subtotal DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(barcode) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_sale_details_sale ON sale_details(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_details_product ON sale_details(product_id);

CREATE TABLE IF NOT EXISTS credit_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    sale_id INTEGER,
    amount_paid DECIMAL(10, 2) NOT NULL,
    payment_method TEXT DEFAULT 'EFECTIVO',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_credit_payments_customer ON credit_payments(customer_id);
