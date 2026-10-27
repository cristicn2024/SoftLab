-- Creación de la base de datos
CREATE DATABASE IF NOT EXISTS softlab_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE softlab_db;

-- 1. TENANTS (Laboratorios clientes del SaaS)
CREATE TABLE tenants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    subdomain VARCHAR(50) NOT NULL UNIQUE,
    status ENUM('active', 'suspended', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2. SUCURSALES (Multi-sucursal por laboratorio)
CREATE TABLE branches (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    address VARCHAR(255),
    phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 3. USUARIOS Y ROLES (Aislamiento por Tenant)
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    branch_id INT NULL,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'receptionist', 'chemist', 'doctor') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 4. PACIENTES
CREATE TABLE patients (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    birth_date DATE NOT NULL,
    gender ENUM('M', 'F', 'Other') NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(150),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 5. CATÁLOGO DE ESTUDIOS / PRUEBAS
CREATE TABLE test_catalog (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    code VARCHAR(30) NOT NULL,
    name VARCHAR(150) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    sample_type VARCHAR(50) NOT NULL, -- ej. Sangre, Orina, Popó
    reference_range TEXT,             -- Rangos de referencia
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    UNIQUE KEY uq_tenant_test_code (tenant_id, code)
) ENGINE=InnoDB;

-- 6. ÓRDENES Y CAJA
CREATE TABLE orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    branch_id INT NOT NULL,
    patient_id INT NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    paid_amount DECIMAL(10, 2) DEFAULT 0.00,
    status ENUM('pending', 'in_process', 'completed', 'cancelled') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (branch_id) REFERENCES branches(id),
    FOREIGN KEY (patient_id) REFERENCES patients(id)
) ENGINE=InnoDB;

-- 7. DETALLE DE ÓRDENES (Pruebas solicitadas)
CREATE TABLE order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    test_id INT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (test_id) REFERENCES test_catalog(id)
) ENGINE=InnoDB;

-- 8. RASTREO DE MUESTRAS (Código de barras por tubo)
CREATE TABLE samples (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    order_id INT NOT NULL,
    barcode VARCHAR(100) NOT NULL UNIQUE,
    status ENUM('collected', 'received', 'rejected', 'processed') DEFAULT 'collected',
    collected_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 9. CAPTURA Y VALIDACIÓN DE RESULTADOS (LIS Core)
CREATE TABLE test_results (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    order_item_id INT NOT NULL,
    result_value VARCHAR(255),
    is_alert BOOLEAN DEFAULT FALSE,
    status ENUM('captured', 'validated') DEFAULT 'captured',
    validated_by INT NULL,             -- ID del médico/químico con VoBo
    validated_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE,
    FOREIGN KEY (validated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- DUMMY DATA PARA PRUEBAS INICIALES
INSERT INTO tenants (id, name, subdomain) VALUES (1, 'Laboratorio Central', 'central');
INSERT INTO branches (id, tenant_id, name) VALUES (1, 1, 'Matriz Centro');
INSERT INTO users (id, tenant_id, branch_id, full_name, email, password_hash, role) 
VALUES (1, 1, 1, 'Admin Demo', 'admin@central.com', '$2b$10$hashedpassword', 'admin');
INSERT INTO test_catalog (tenant_id, code, name, price, sample_type, reference_range) 
VALUES (1, 'BH', 'Biometría Hemática', 250.00, 'Sangre (Tubo Rojo)', 'Hemoglobina 12-16 g/dL');