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

    // Let's find a real sale and real client to make a mock insert
    const { data: lastSale } = await supabase
      .from("ventas")
      .select("id, codigo_venta, cliente_id, usuario_registro_id, closer_principal_id")
      .order("creado_en", { ascending: false })
      .limit(1)
      .single();

    if (!lastSale) {
      console.log("No last sale found.");
      return;
    }

    console.log("Last Sale:", lastSale);

    // Mock an extension insert using the same code
    const insertData = {
      es_continuacion: true,
      tipo_continuacion: "extension",
      proyecto_previo_id: lastSale.id,
      tipo_venta: "Extensión de Proyecto",
      tipo_proyecto: "Precio Fijo",
      status_pago: "Pago Adelantado",
      plataforma: "Workana",
      cliente_id: lastSale.cliente_id,
      proyecto_nombre: "Test Extension",
      moneda: "USD",
      monto_total: 100.00,
      comprobante_no_aplica: true,
      tipo_cierre: "Cierre por closer",
      usuario_registro_id: lastSale.usuario_registro_id,
      closer_principal_id: lastSale.closer_principal_id,
      codigo_venta: lastSale.codigo_venta // Duplicate code!
    };

    console.log("Inserting duplicate code...");
    const { data: inserted, error } = await supabase
      .from("ventas")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error("Insert failed with error:", error);
    } else {
      console.log("Insert succeeded?!", inserted);
    }
  } catch (err) {
    console.error("Crash:", err);
  }
}

run();
