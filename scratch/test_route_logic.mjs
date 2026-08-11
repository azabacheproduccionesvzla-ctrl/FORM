import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

// Since we want to run in node, let's write a simple implementation of PIN verify or just mock it.
import crypto from "crypto";
function hashPin(pin, salt) {
  return crypto.scryptSync(pin, salt, 64).toString("hex");
}
function verifyPinLocal(pin, hash, salt) {
  try {
    const testHash = hashPin(pin, salt);
    return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(testHash, "hex"));
  } catch (e) {
    return false;
  }
}

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

    // Let's mock a registrar user: "VictoriaR"
    const username = "VictoriaR";
    
    // 1. Fetch operator pin
    console.log("1. Querying operator: " + username);
    const { data: operator, error: opError } = await supabase
      .from("usuarios_agencia")
      .select("pin_hash, pin_salt")
      .eq("username", username)
      .single();

    if (opError || !operator) {
      console.log("Failed operator select:", opError);
      return;
    }
    console.log("Operator select success.");

    // 2. Find a previous sale to use as extension parent
    const { data: parentSale } = await supabase
      .from("ventas")
      .select("id, codigo_venta, cliente_id, usuario_registro_id")
      .order("creado_en", { ascending: false })
      .limit(1)
      .single();

    if (!parentSale) {
      console.log("No sales in DB to extend.");
      return;
    }
    console.log("Parent Sale code:", parentSale.codigo_venta);

    // 3. Prepare insert data
    const insertData = {
      es_continuacion: true,
      tipo_continuacion: "extension",
      proyecto_previo_id: parentSale.id,
      tipo_venta: "Extensión de Proyecto",
      tipo_proyecto: "Precio Fijo",
      status_pago: "Pago Adelantado",
      plataforma: "Workana",
      cliente_id: parentSale.cliente_id,
      proyecto_nombre: "Extensión - " + parentSale.codigo_venta,
      moneda: "USD",
      monto_total: 150,
      comprobante_no_aplica: true,
      tipo_cierre: "Cierre por closer",
      usuario_registro_id: parentSale.usuario_registro_id
    };

    console.log("Inserting sale with payload:", insertData);

    const { data: salesInserted, error: salesErr } = await supabase
      .from("ventas")
      .insert(insertData)
      .select()
      .single();

    if (salesErr) {
      console.error("Sales Insert Error:", salesErr);
    } else {
      console.log("Inserted successfully:", salesInserted);
    }

  } catch (err) {
    console.error("Crash:", err);
  }
}

run();
