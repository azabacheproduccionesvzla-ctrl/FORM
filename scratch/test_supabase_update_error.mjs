import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

// 1. Cargar variables de entorno
try {
  const envPath = path.resolve(".env.local");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    envContent.split("\n").forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || "";
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.substring(1, value.length - 1);
        } else if (value.startsWith("'") && value.endsWith("'")) {
          value = value.substring(1, value.length - 1);
        }
        process.env[key] = value.trim();
      }
    });
  }
} catch (e) {
  console.error("Error leyendo .env.local:", e);
}

async function runUpdateTest() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  console.log("Supabase URL:", supabaseUrl);

  try {
    // 1. Obtener un cliente existente
    const { data: client, error: getErr } = await supabase
      .from("clientes")
      .select("*")
      .limit(1)
      .single();

    if (getErr || !client) {
      console.error("Error al obtener cliente de prueba:", getErr);
      return;
    }

    console.log(`Cliente seleccionado para prueba: ID=${client.id}, Nombre="${client.nombre}"`);

    // 2. Intentar actualizar una propiedad inofensiva
    console.log("Intentando actualizar 'empresa' a sí misma...");
    const { error: updErr } = await supabase
      .from("clientes")
      .update({ empresa: client.empresa || null })
      .eq("id", client.id);

    if (updErr) {
      console.error("❌ Error devuelto por Supabase al actualizar:");
      console.error(JSON.stringify(updErr, null, 2));
      console.error("Mensaje:", updErr.message);
      console.error("Detalles:", updErr.details);
      console.error("Código:", updErr.code);
    } else {
      console.log("✅ Actualización exitosa! No hay errores de políticas o base de datos.");
    }
  } catch (err) {
    console.error("❌ Excepción en la prueba de actualización:", err);
  }
}

runUpdateTest();
