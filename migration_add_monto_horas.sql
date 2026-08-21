-- ====================================================================
-- SCRIPT DE MIGRACIÓN: AGREGAR SOPORTE PARA MONTO POR HORA Y CANTIDAD DE HORAS
-- Proyecto: Azabache Formulario / Control de Ventas
-- ====================================================================
-- Este script es seguro e idempotente (IF NOT EXISTS).
-- No borra ni modifica datos existentes en la tabla 'ventas'.
-- ====================================================================

-- 1. Agregar columna para tarifa/monto por hora (numérico decimal)
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS monto_por_hora NUMERIC;

-- 2. Agregar columna para cantidad de horas presupuestadas/asignadas
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS cantidad_horas NUMERIC;

-- Comentarios explicativos en las columnas
COMMENT ON COLUMN ventas.monto_por_hora IS 'Tarifa pactada por hora cuando tipo_proyecto es Por Hora';
COMMENT ON COLUMN ventas.cantidad_horas IS 'Cantidad de horas asignadas o presupuestadas para la venta';
