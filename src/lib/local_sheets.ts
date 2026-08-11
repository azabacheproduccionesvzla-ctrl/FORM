import fs from "fs";
import path from "path";
import { supabase } from "./supabase";

export function formatExcelDate(dateStr?: string | Date | null) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "";
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const dayName = days[date.getUTCDay()];
  const monthName = months[date.getUTCMonth()];
  const day = date.getUTCDate();
  const year = date.getUTCFullYear();
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  return `${dayName} ${monthName} ${day} ${hours}:${minutes}:${seconds} +0000 ${year}`;
}

export const getComision = (plataforma: string) => {
  const plat = (plataforma || "").toLowerCase();
  if (plat === "freelancer") return "10%";
  if (plat === "workana") return "REVISAR";
  if (plat.includes("contrato") || plat === "freelancer con contrato") return "15%";
  return "0%";
};

export async function updateLocalWorkspaceSheet() {
  try {
    console.log("[Local Sheets] Actualizando Cuadro Maestro local en el workspace...");
    
    // 1. Obtener todas las ventas con sus clientes y usuarios principales
    const { data: sales, error: salesErr } = await supabase
      .from("ventas")
      .select(`
        *,
        clientes (
          nombre,
          ghl_contact_id
        ),
        setter_principal:usuarios_agencia!setter_principal_id (
          nombre
        ),
        closer_principal:usuarios_agencia!closer_principal_id (
          nombre
        )
      `)
      .order("creado_en", { ascending: true });

    if (salesErr || !sales) {
      console.error("[Local Sheets] Error al obtener ventas para CSV local:", salesErr);
      return;
    }

    // 2. Obtener todos los usuarios de la agencia para resolver setters/closers adicionales
    const { data: users, error: usersErr } = await supabase
      .from("usuarios_agencia")
      .select("id, nombre");

    const usersMap = new Map<string, string>();
    if (users) {
      users.forEach(u => usersMap.set(u.id, u.nombre));
    }

    const headers = [
      "Etapa",
      "Plataforma",
      "Codigo Venta",
      "ID Factura",
      "Fecha de inicio",
      "Cliente ",
      "Codigo Cliente",
      "Proyecto",
      "Monto C/C",
      "Comision",
      "Setter I",
      "Setter II",
      "Closer I",
      "Closer II",
      "Closer III",
      "Factura",
      "Fecha de Pago",
      "Comisión de transferencia",
      "Fondo Gerencial",
      "Lider",
      "Asociaciado I",
      "% Asociaciado I",
      "Asociaciado II",
      "% Asociaciado II",
      "Asociaciado III",
      "% Asociaciado III",
      "Asociaciado IV",
      "% Asociaciado IV",
      "Asociaciado V",
      "% Asociaciado V"
    ];



    const escapeCsv = (val: string | number | null | undefined) => {
      if (val === null || val === undefined) return '""';
      const clean = String(val).replace(/"/g, '""');
      return `"${clean}"`;
    };

    const rows = sales.map(sale => {
      const setter2 = sale.setters_adicionales_ids && sale.setters_adicionales_ids.length > 0
        ? (usersMap.get(sale.setters_adicionales_ids[0]) || "")
        : "";
      const closer2 = sale.closers_adicionales_ids && sale.closers_adicionales_ids.length > 0
        ? (usersMap.get(sale.closers_adicionales_ids[0]) || "")
        : "";
      const closer3 = sale.closers_adicionales_ids && sale.closers_adicionales_ids.length > 1
        ? (usersMap.get(sale.closers_adicionales_ids[1]) || "")
        : "";

      const clientName = (sale.clientes as any)?.nombre || "Cliente";
      const clientGhlId = (sale.clientes as any)?.ghl_contact_id || "";

      return [
        escapeCsv(sale.status_pago || "PAGO ADELANTADO"),
        escapeCsv(sale.plataforma),
        escapeCsv(sale.codigo_venta),
        escapeCsv(sale.codigo_factura),
        escapeCsv(formatExcelDate(sale.creado_en)),
        escapeCsv(clientName),
        escapeCsv(clientGhlId),
        escapeCsv(sale.proyecto_nombre),
        escapeCsv(`${sale.monto_total || 0} ${(sale.moneda === "Otra" ? (sale.moneda_otra || "Otra") : (sale.moneda || "USD")).toUpperCase()}`),
        escapeCsv(getComision(sale.plataforma)),
        escapeCsv((sale.setter_principal as any)?.nombre || ""),
        escapeCsv(setter2),
        escapeCsv((sale.closer_principal as any)?.nombre || ""),
        escapeCsv(closer2),
        escapeCsv(closer3),
        escapeCsv(sale.comprobante_link),
        escapeCsv(sale.fecha_pago),
        '""', // Comisión de transferencia
        '""', // Fondo Gerencial
        '""', // Lider
        '""', // Asociaciado I
        '""', // % Asociaciado I
        '""', // Asociaciado II
        '""', // % Asociaciado II
        '""', // Asociaciado III
        '""', // % Asociaciado III
        '""', // Asociaciado IV
        '""', // % Asociaciado IV
        '""', // Asociaciado V
        '""'  // % Asociaciado V
      ];
    });

    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map(r => r.join(";"))].join("\n");
    const filePath = path.join(process.cwd(), "Cuadro Maestro (Local).csv");
    fs.writeFileSync(filePath, csvContent, "utf-8");
    console.log(`[Local Sheets] Archivo guardado con éxito en: ${filePath}`);
  } catch (err) {
    console.error("[Local Sheets] Excepción al escribir Cuadro Maestro local:", err);
  }
}
