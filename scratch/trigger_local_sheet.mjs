import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

async function run() {
  try {
    const envPath = path.resolve(process.cwd(), ".env.local");
    const envContent = fs.readFileSync(envPath, "utf-8");
    const getEnvVal = (key) => {
      const match = envContent.match(new RegExp(`^${key}=(.*)$`, "m"));
      return match ? match[1].trim() : null;
    };

    const supabaseUrl = getEnvVal("SUPABASE_URL");
    const supabaseAnonKey = getEnvVal("SUPABASE_ANON_KEY");
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    console.log("[Rebuild CSV] Fetching sales from Supabase...");
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
      .order("creado_en", { ascending: false });

    if (salesErr || !sales) {
      console.error("[Rebuild CSV] Error fetching sales:", salesErr);
      return;
    }

    const { data: users } = await supabase
      .from("usuarios_agencia")
      .select("id, nombre");

    const usersMap = new Map();
    if (users) {
      users.forEach(u => usersMap.set(u.id, u.nombre));
    }

    const headers = [
      "Etapa",
      "Plataforma",
      "Codigo Venta",
      "Codigo Factura",
      "Fecha de inicio",
      "Cliente",
      "Codigo Cliente (GHL ID)",
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

    const getComision = (plataforma) => {
      const plat = (plataforma || "").toLowerCase();
      if (plat === "freelancer") return "10%";
      if (plat === "workana") return "REVISAR";
      if (plat.includes("contrato") || plat === "freelancer con contrato") return "15%";
      return "0%";
    };

    const escapeCsv = (val) => {
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

      const clientName = sale.clientes?.nombre || "Cliente";
      const clientGhlId = sale.clientes?.ghl_contact_id || "";

      return [
        escapeCsv(sale.status_pago || "PAGO ADELANTADO"),
        escapeCsv(sale.plataforma),
        escapeCsv(sale.codigo_venta),
        escapeCsv(sale.codigo_factura),
        escapeCsv(new Date(sale.creado_en).toLocaleDateString("es-ES")),
        escapeCsv(clientName),
        escapeCsv(clientGhlId),
        escapeCsv(sale.proyecto_nombre),
        escapeCsv(`${sale.monto_total || 0} ${(sale.moneda || "USD").toUpperCase()}`),
        escapeCsv(getComision(sale.plataforma)),
        escapeCsv(sale.setter_principal?.nombre || ""),
        escapeCsv(setter2),
        escapeCsv(sale.closer_principal?.nombre || ""),
        escapeCsv(closer2),
        escapeCsv(closer3),
        escapeCsv(sale.comprobante_link),
        escapeCsv(sale.fecha_pago),
        '""',
        '""',
        '""',
        '""',
        '""',
        '""',
        '""',
        '""',
        '""',
        '""',
        '""',
        '""',
        '""'
      ];
    });

    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map(r => r.join(";"))].join("\n");
    const filePath = path.join(process.cwd(), "Cuadro Maestro (Local).csv");
    fs.writeFileSync(filePath, csvContent, "utf-8");
    console.log(`[Rebuild CSV] Saved successfully to: ${filePath}`);
  } catch (err) {
    console.error("[Rebuild CSV] Exception:", err);
  }
}

run();
