-- ====================================================================
-- SCRIPT COMPLETO DE BASE DE DATOS PARA SUPABASE (POSTGRESQL)
-- Contiene: Esquema, Migración, Semillas de 3 Usuarios Dev Únicos,
-- Generador de Código de Venta y Políticas de Seguridad RLS.
-- ====================================================================
-- WARNING: Este script borrará las tablas existentes si ya existen.
-- Ejecutar en el SQL Editor de Supabase únicamente para inicialización
-- o pruebas limpias.
-- ====================================================================

-- 1. Definición Segura del Tipo Enumerado para los Roles (evita recreación)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rol_usuario') THEN 
        CREATE TYPE rol_usuario AS ENUM ('admin', 'ventas', 'auditor'); 
    END IF; 
END $$;

-- 3. Creación de la Tabla de Usuarios Agencia
CREATE TABLE IF NOT EXISTS usuarios_agencia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    rol rol_usuario NOT NULL,
    pin_hash VARCHAR(255) NOT NULL,
    pin_salt VARCHAR(255) NOT NULL,
    activo BOOLEAN DEFAULT TRUE NOT NULL,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_usuarios_agencia_username ON usuarios_agencia(username);

-- 4. Creación de la Tabla de Clientes
CREATE TABLE IF NOT EXISTS clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(150) UNIQUE NOT NULL,
    telefono VARCHAR(50),
    email VARCHAR(100),
    pais VARCHAR(100),
    empresa VARCHAR(150),
    link_usuario_plataforma VARCHAR(255),
    setter_original_id UUID REFERENCES usuarios_agencia(id) ON DELETE SET NULL,
    ghl_contact_id VARCHAR(100),
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE clientes ADD COLUMN IF NOT EXISTS ghl_contact_id VARCHAR(100);

-- 5. Creación de la Tabla de Ventas
CREATE TABLE IF NOT EXISTS ventas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_venta VARCHAR(100) UNIQUE,
    es_continuacion BOOLEAN DEFAULT FALSE NOT NULL,
    tipo_continuacion VARCHAR(50), -- 'extension', 'pago_parcial'
    proyecto_previo_id UUID REFERENCES ventas(id) ON DELETE SET NULL,
    tipo_venta VARCHAR(50) NOT NULL, -- 'Cargo Horas', 'Nueva Venta', 'Extensión de Proyecto', 'Pago Parcial'
    tipo_proyecto VARCHAR(50) NOT NULL, -- 'Precio Fijo', 'Por Hora', 'Otro'
    tipo_proyecto_otro VARCHAR(255),
    status_pago VARCHAR(50) NOT NULL, -- 'Scrow', 'Pago Adelantado', 'Pago Parcial'
    plataforma VARCHAR(50) NOT NULL, -- 'Workana', 'Freelancer', etc.
    cliente_id UUID REFERENCES clientes(id) ON DELETE RESTRICT NOT NULL,
    proyecto_nombre VARCHAR(255) NOT NULL,
    proyecto_link VARCHAR(255),
    proyecto_brief VARCHAR(255),
    descripcion_operativa TEXT,
    carpeta_dropbox VARCHAR(255),
    deadline DATE,
    urgente BOOLEAN DEFAULT FALSE NOT NULL,
    motivo_urgencia TEXT,
    moneda VARCHAR(50) NOT NULL, -- 'USD', 'EUR', 'VES', 'COP', 'Otra'
    moneda_otra VARCHAR(50),
    monto_total NUMERIC NOT NULL,
    monto_explicacion TEXT,
    monto_pagado NUMERIC,
    comision_total NUMERIC,
    fecha_pago DATE,
    fecha_liberacion_pendiente BOOLEAN DEFAULT FALSE NOT NULL,
    comprobante_link VARCHAR(255),
    comprobante_no_aplica BOOLEAN DEFAULT FALSE NOT NULL,
    setter_principal_id UUID REFERENCES usuarios_agencia(id) ON DELETE SET NULL,
    setters_adicionales_ids UUID[], -- array de UUIDs
    closer_principal_id UUID REFERENCES usuarios_agencia(id) ON DELETE SET NULL,
    closers_adicionales_ids UUID[], -- array de UUIDs
    tipo_cierre VARCHAR(50) NOT NULL, -- 'Cierre por closer', 'Cierre combinado', 'Cierre por dirección'
    oferta_presentada TEXT,
    condiciones_acordadas TEXT,
    notas_internas TEXT,
    usuario_registro_id UUID REFERENCES usuarios_agencia(id) ON DELETE RESTRICT NOT NULL,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    estado_interno VARCHAR(50) DEFAULT 'Registrada' NOT NULL,
    status_trello VARCHAR(50) DEFAULT 'PENDIENTE' NOT NULL,
    status_ghl VARCHAR(50) DEFAULT 'PENDIENTE' NOT NULL,
    status_dropbox VARCHAR(50) DEFAULT 'PENDIENTE' NOT NULL,
    status_whatsapp VARCHAR(50) DEFAULT 'PENDIENTE' NOT NULL,
    status_email VARCHAR(50) DEFAULT 'PENDIENTE' NOT NULL,
    status_sheets VARCHAR(50) DEFAULT 'PENDIENTE' NOT NULL,
    link_trello VARCHAR(255)
);

-- Secuencia y trigger para generar código autoincrementable de ventas
CREATE SEQUENCE IF NOT EXISTS seq_codigo_venta START WITH 1;

CREATE OR REPLACE FUNCTION generar_codigo_venta()
RETURNS TRIGGER AS $$
DECLARE
    next_val INT;
    anio TEXT;
BEGIN
    next_val := nextval('seq_codigo_venta');
    anio := to_char(CURRENT_DATE, 'YYYY');
    NEW.codigo_venta := 'AZB-VENTA-' || anio || '-' || lpad(next_val::text, 4, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generar_codigo_venta ON ventas;

CREATE TRIGGER trg_generar_codigo_venta
BEFORE INSERT ON ventas
FOR EACH ROW
WHEN (NEW.codigo_venta IS NULL)
EXECUTE FUNCTION generar_codigo_venta();

-- 6. Creación de la Tabla de Historial de Actividades
CREATE TABLE IF NOT EXISTS historial_actividades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID REFERENCES usuarios_agencia(id) ON DELETE CASCADE,
    accion_descripcion TEXT NOT NULL,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 6.5 Creación de la Tabla de Configuraciones
CREATE TABLE IF NOT EXISTS configuraciones (
    clave VARCHAR(100) PRIMARY KEY,
    valor JSONB NOT NULL,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 6.8 Creación de la Tabla de Proyectos
CREATE TABLE IF NOT EXISTS proyectos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(255) NOT NULL,
    cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
    venta_id UUID REFERENCES ventas(id) ON DELETE SET NULL,
    trello_card_id VARCHAR(100) UNIQUE,
    trello_list_id VARCHAR(100),
    link_trello VARCHAR(255),
    carpeta_dropbox VARCHAR(255),
    activo BOOLEAN DEFAULT TRUE NOT NULL,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 7. Semillas de Clientes Base (Útiles para pruebas)
INSERT INTO clientes (nombre, telefono, email, pais, empresa, link_usuario_plataforma)
VALUES 
('Cliente Dev S.A.', '+34 600 000 000', 'contacto@clientedev.com', 'España', 'Devcorp Inc.', 'https://www.workana.com/u/clientedev'),
('Chris Producciones', '+58 412 000 0000', 'chris@azabache.com', 'Venezuela', 'Azabache', 'https://www.freelancer.com/u/chrisazabache')
ON CONFLICT (nombre) DO NOTHING;

-- 8. Semillas de los 3 Únicos Usuarios Dev Requeridos
-- Encriptación scrypt del PIN precalculada para coincidir con la lógica del backend
-- - admin dev: PIN 444444
-- - auditor dev: PIN 666666
-- - ventas dev: PIN 333333

INSERT INTO usuarios_agencia (username, nombre, rol, pin_hash, pin_salt, activo) 
VALUES 
(
    'admin_dev', 
    'admin dev', 
    'admin', 
    '9e60b624479760513e8b639526b7bfef361e451f40b26167bccf148fbde7c40a80a63f83d9948d56ed39309cc88db8823ab6dfe18a8a782a82338c5d89e6bd96', 
    '42cb82e67219a2837cac5e0fc93d21d0', 
    true
),
(
    'auditor_dev', 
    'auditor dev', 
    'auditor', 
    'bf3d124106983667685fd409745bbc5a816a6458f260984e5876f2fbd20554d56b69997f165de718fa822e9cee97c0d38cc20a7cfc004ebf933e297e134762f9', 
    '7f24061f9486fc5d3082ea4e259c9597', 
    true
),
(
    'ventas_dev', 
    'ventas dev', 
    'ventas', 
    '14e2c6dd7214688f3c60eae2d1a35f3961faad4e1f221f9c2156a27bea7609304ac04365780830b6a54d303bafb3658e3e13a19d8783174163efe87f9a87cbb5', 
    '05d56807d038be9b190346fe7546e31a', 
    true
)
ON CONFLICT (username) DO NOTHING;

-- Insertar log inicial en historial asignado al administrador
INSERT INTO historial_actividades (usuario_id, accion_descripcion)
SELECT 
    (SELECT id FROM usuarios_agencia WHERE username = 'admin_dev' LIMIT 1),
    'Esquema unificado inicializado y 3 usuarios de desarrollo únicos creados.'
WHERE NOT EXISTS (
    SELECT 1 FROM historial_actividades 
    WHERE accion_descripcion = 'Esquema unificado inicializado y 3 usuarios de desarrollo únicos creados.'
);

-- Insertar configuración inicial por defecto para las integraciones
INSERT INTO configuraciones (clave, valor)
VALUES ('integraciones', '{"dropbox": true, "trello": true, "ghl_email": true, "ghl_factura": true, "zapier_whatsapp": true}'::jsonb)
ON CONFLICT (clave) DO NOTHING;

-- ====================================================================
-- 9. Políticas de Seguridad RLS (Row Level Security)
-- ====================================================================

-- Habilitar/Deshabilitar RLS
-- Para permitir que la API de Next.js consulte directamente, se deja deshabilitado por defecto.
-- Puedes habilitarlo si implementas políticas personalizadas o utilizas Supabase Auth.
ALTER TABLE usuarios_agencia DISABLE ROW LEVEL SECURITY;
ALTER TABLE clientes DISABLE ROW LEVEL SECURITY;
ALTER TABLE ventas DISABLE ROW LEVEL SECURITY;
ALTER TABLE historial_actividades DISABLE ROW LEVEL SECURITY;
ALTER TABLE configuraciones DISABLE ROW LEVEL SECURITY;
ALTER TABLE proyectos DISABLE ROW LEVEL SECURITY;

-- A. Políticas para usuarios_agencia
DROP POLICY IF EXISTS "Admin completo usuarios" ON usuarios_agencia;
DROP POLICY IF EXISTS "Lectura y login usuarios" ON usuarios_agencia;

CREATE POLICY "Admin completo usuarios" ON usuarios_agencia
    FOR ALL USING (current_setting('app.current_user_role', true) = 'admin');

CREATE POLICY "Lectura y login usuarios" ON usuarios_agencia
    FOR SELECT USING (
        current_setting('app.current_user_id', true)::uuid = id OR 
        current_setting('app.current_user_role', true) IS NULL
    );

-- B. Políticas para clientes
DROP POLICY IF EXISTS "Admin completo clientes" ON clientes;
DROP POLICY IF EXISTS "Ventas/Auditor ver clientes" ON clientes;
DROP POLICY IF EXISTS "Ventas crear clientes" ON clientes;
DROP POLICY IF EXISTS "Ventas actualizar clientes" ON clientes;

CREATE POLICY "Admin completo clientes" ON clientes
    FOR ALL USING (current_setting('app.current_user_role', true) = 'admin');

CREATE POLICY "Ventas/Auditor ver clientes" ON clientes
    FOR SELECT USING (current_setting('app.current_user_role', true) IN ('ventas', 'auditor'));

CREATE POLICY "Ventas crear clientes" ON clientes
    FOR INSERT WITH CHECK (current_setting('app.current_user_role', true) = 'ventas');

CREATE POLICY "Ventas actualizar clientes" ON clientes
    FOR UPDATE USING (current_setting('app.current_user_role', true) = 'ventas');

-- C. Políticas para ventas
DROP POLICY IF EXISTS "Admin completo ventas" ON ventas;
DROP POLICY IF EXISTS "Auditor leer todas las ventas" ON ventas;
DROP POLICY IF EXISTS "Ventas crear sus ventas" ON ventas;
DROP POLICY IF EXISTS "Ventas leer sus propias ventas" ON ventas;

CREATE POLICY "Admin completo ventas" ON ventas
    FOR ALL USING (current_setting('app.current_user_role', true) = 'admin');

CREATE POLICY "Auditor leer todas las ventas" ON ventas
    FOR SELECT USING (current_setting('app.current_user_role', true) = 'auditor');

CREATE POLICY "Ventas crear sus ventas" ON ventas
    FOR INSERT WITH CHECK (
        current_setting('app.current_user_role', true) = 'ventas' AND 
        usuario_registro_id = current_setting('app.current_user_id', true)::uuid
    );

CREATE POLICY "Ventas leer sus propias ventas" ON ventas
    FOR SELECT USING (
        current_setting('app.current_user_role', true) = 'ventas' AND 
        usuario_registro_id = current_setting('app.current_user_id', true)::uuid
    );

-- D. Políticas para historial_actividades
DROP POLICY IF EXISTS "Admin completo historial" ON historial_actividades;
DROP POLICY IF EXISTS "Auditor leer todo historial" ON historial_actividades;
DROP POLICY IF EXISTS "Ventas leer propio historial" ON historial_actividades;
DROP POLICY IF EXISTS "Cualquiera registrar historial" ON historial_actividades;

CREATE POLICY "Admin completo historial" ON historial_actividades
    FOR ALL USING (current_setting('app.current_user_role', true) = 'admin');

CREATE POLICY "Auditor leer todo historial" ON historial_actividades
    FOR SELECT USING (current_setting('app.current_user_role', true) = 'auditor');

CREATE POLICY "Ventas leer propio historial" ON historial_actividades
    FOR SELECT USING (
        current_setting('app.current_user_role', true) = 'ventas' AND 
        usuario_id = current_setting('app.current_user_id', true)::uuid
    );

CREATE POLICY "Cualquiera registrar historial" ON historial_actividades
    FOR INSERT WITH CHECK (
        usuario_id = current_setting('app.current_user_id', true)::uuid OR
        current_setting('app.current_user_role', true) IS NULL
    );

-- E. Políticas para configuraciones
DROP POLICY IF EXISTS "Admin completo configuraciones" ON configuraciones;
DROP POLICY IF EXISTS "Cualquiera leer configuraciones" ON configuraciones;

CREATE POLICY "Admin completo configuraciones" ON configuraciones
    FOR ALL USING (current_setting('app.current_user_role', true) = 'admin');

CREATE POLICY "Cualquiera leer configuraciones" ON configuraciones
    FOR SELECT USING (true);

-- F. Políticas para proyectos
DROP POLICY IF EXISTS "Admin completo proyectos" ON proyectos;
DROP POLICY IF EXISTS "Ventas/Auditor ver proyectos" ON proyectos;

CREATE POLICY "Admin completo proyectos" ON proyectos
    FOR ALL USING (current_setting('app.current_user_role', true) = 'admin');

CREATE POLICY "Ventas/Auditor ver proyectos" ON proyectos
    FOR SELECT USING (current_setting('app.current_user_role', true) IN ('ventas', 'auditor'));
