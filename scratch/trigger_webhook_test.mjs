import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// Load .env.local
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
  console.error("Error reading .env.local:", e);
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log("Starting Webhook Deletion Test...");

  // 1. Get a valid user ID for required fields in ventas
  const { data: users } = await supabase.from("usuarios_agencia").select("id").limit(1);
  const userId = users && users[0] ? users[0].id : null;
  if (!userId) {
    console.error("No users found in usuarios_agencia. Cannot run test.");
    return;
  }

  // 2. Insert test client
  const testContactId = "webhook-test-delete-999";
  const { data: client, error: clientErr } = await supabase
    .from("clientes")
    .insert({
      nombre: "Webhook Perez Test",
      email: "webhook_test@example.com",
      telefono: "+1999999999",
      ghl_contact_id: testContactId
    })
    .select()
    .single();

  if (clientErr) {
    console.error("Error creating test client:", clientErr);
    return;
  }
  console.log("Created test client ID:", client.id);

  // 3. Insert test sale referencing this client
  const { data: sale, error: saleErr } = await supabase
    .from("ventas")
    .insert({
      es_continuacion: false,
      tipo_venta: "Nueva Venta",
      tipo_proyecto: "Precio Fijo",
      status_pago: "Pago Adelantado",
      plataforma: "Workana",
      cliente_id: client.id,
      proyecto_nombre: "Proyecto Webhook Test",
      proyecto_link: "https://example.com",
      proyecto_brief: "Brief notes",
      descripcion_operativa: "Desc",
      deadline: "2026-12-31",
      urgente: false,
      moneda: "USD",
      monto_total: 300.00,
      comprobante_no_aplica: true,
      setter_principal_id: userId,
      closer_principal_id: userId,
      tipo_cierre: "Cierre por closer",
      notas_internas: "Original notes of webhook test.",
      usuario_registro_id: userId,
      estado_interno: "Registrada",
      status_trello: "PENDIENTE",
      status_ghl: "PENDIENTE",
      status_dropbox: "PENDIENTE",
      status_whatsapp: "PENDIENTE",
      status_email: "PENDIENTE"
    })
    .select()
    .single();

  if (saleErr) {
    console.error("Error creating test sale:", saleErr);
    await supabase.from("clientes").delete().eq("id", client.id);
    return;
  }
  console.log("Created test sale ID:", sale.id);

  // 4. Send POST request to Local Next.js server webhook
  console.log("Triggering POST to webhook...");
  try {
    const response = await fetch("http://localhost:3000/api/webhooks/ghl", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        type: "ContactDelete",
        id: testContactId
      })
    });

    const resData = await response.json();
    console.log("Webhook Response Status:", response.status);
    console.log("Webhook Response Body:", resData);

    // 5. Verify the updates
    const { data: updatedSale } = await supabase
      .from("ventas")
      .select("id, cliente_id, notas_internas")
      .eq("id", sale.id)
      .single();

    const { data: fallbackClient } = await supabase
      .from("clientes")
      .select("id")
      .eq("nombre", "Cliente Eliminado (Historial)")
      .maybeSingle();

    console.log("\n--- WEBHOOK VERIFICATION RESULTS ---");
    console.log("Updated sale's cliente_id equals fallback ID:", updatedSale.cliente_id === fallbackClient.id ? "✅ Yes" : `❌ No (${updatedSale.cliente_id})`);
    console.log("Updated sale's notas_internas:", updatedSale.notas_internas);

    const { data: deletedClientRecord } = await supabase
      .from("clientes")
      .select("id")
      .eq("id", client.id)
      .maybeSingle();
    console.log("Original client record deleted from db:", !deletedClientRecord ? "✅ Yes" : "❌ No");

  } catch (err) {
    console.error("Failed to request local webhook. Is the dev server running on port 3000?", err);
  } finally {
    // Cleanup test sale
    await supabase.from("ventas").delete().eq("id", sale.id);
    console.log("Cleaned up test sale.");
  }
}

run();
