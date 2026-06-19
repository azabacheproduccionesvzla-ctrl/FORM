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
  console.log("Starting deletion integration test...");

  // 1. Get a valid user ID for required fields in ventas
  const { data: users } = await supabase.from("usuarios_agencia").select("id").limit(1);
  const userId = users && users[0] ? users[0].id : null;
  if (!userId) {
    console.error("No users found in usuarios_agencia. Cannot run test.");
    return;
  }

  // 2. Insert test client
  const testContactId = "ghl-test-delete-contact-999";
  const { data: client, error: clientErr } = await supabase
    .from("clientes")
    .insert({
      nombre: "Juan Perez Test Deletion",
      email: "juan_perez_test@example.com",
      telefono: "+123456789",
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
      proyecto_nombre: "Proyecto Test Deletion",
      proyecto_link: "https://example.com",
      proyecto_brief: "Brief notes",
      descripcion_operativa: "Desc",
      deadline: "2026-12-31",
      urgente: false,
      moneda: "USD",
      monto_total: 150.00,
      comprobante_no_aplica: true,
      setter_principal_id: userId,
      closer_principal_id: userId,
      tipo_cierre: "Cierre por closer",
      notas_internas: "This is the original sale notes.",
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
    // Cleanup client
    await supabase.from("clientes").delete().eq("id", client.id);
    return;
  }
  console.log("Created test sale ID:", sale.id);

  // 4. Run database-side deletion/reassignment logic for this specific client
  // (We emulate the deletion processing of GHL ID: testContactId)
  console.log(`Running reassignment/deletion logic for ghl_contact_id: ${testContactId}`);
  
  // Find client
  const { data: matchedClient } = await supabase
    .from("clientes")
    .select("*")
    .eq("ghl_contact_id", testContactId)
    .maybeSingle();

  if (!matchedClient) {
    console.error("Could not find client by GHL ID");
    return;
  }

  // Handle fallback client
  let fallbackClientId = null;
  const fallbackClientName = "Cliente Eliminado (Historial)";
  const { data: existingFallback } = await supabase
    .from("clientes")
    .select("id")
    .eq("nombre", fallbackClientName)
    .maybeSingle();

  if (existingFallback) {
    fallbackClientId = existingFallback.id;
  } else {
    const { data: newFallback, error: fallbackErr } = await supabase
      .from("clientes")
      .insert([{ nombre: fallbackClientName }])
      .select()
      .single();
    if (fallbackErr) {
      console.error("Error creating fallback client:", fallbackErr);
      return;
    }
    fallbackClientId = newFallback.id;
  }
  console.log("Using fallback client ID:", fallbackClientId);

  // Reassign sales
  const { data: salesForDeleted } = await supabase
    .from("ventas")
    .select("id, cliente_id, notas_internas")
    .eq("cliente_id", matchedClient.id);

  if (salesForDeleted && salesForDeleted.length > 0) {
    for (const s of salesForDeleted) {
      const clientInfoStr = `${matchedClient.nombre || "Sin Nombre"}${matchedClient.email ? ` (Email: ${matchedClient.email})` : ""}${matchedClient.telefono ? ` (Tel: ${matchedClient.telefono})` : ""}`;
      const oldNotes = s.notas_internas || "";
      const newNotes = `[Cliente original: ${clientInfoStr}]\n${oldNotes}`.trim();

      const { error: updErr } = await supabase
        .from("ventas")
        .update({
          cliente_id: fallbackClientId,
          notas_internas: newNotes
        })
        .eq("id", s.id);

      if (updErr) {
        console.error("Error updating sale:", updErr);
      } else {
        console.log(`Reassigned sale ${s.id} to fallback client and updated notes.`);
      }
    }
  }

  // Delete client
  const { error: delErr } = await supabase
    .from("clientes")
    .delete()
    .eq("id", matchedClient.id);

  if (delErr) {
    console.error("Error deleting client:", delErr);
  } else {
    console.log("Deleted original client record successfully!");
  }

  // 5. Verify the updates
  const { data: updatedSale } = await supabase
    .from("ventas")
    .select("id, cliente_id, notas_internas")
    .eq("id", sale.id)
    .single();

  console.log("\n--- VERIFICATION RESULTS ---");
  console.log("Updated sale's cliente_id (should equal fallback ID):", updatedSale.cliente_id === fallbackClientId ? "✅ Yes" : `❌ No (${updatedSale.cliente_id})`);
  console.log("Updated sale's notas_internas:", updatedSale.notas_internas);

  const { data: deletedClientRecord } = await supabase
    .from("clientes")
    .select("id")
    .eq("id", client.id)
    .maybeSingle();
  console.log("Original client record deleted from db:", !deletedClientRecord ? "✅ Yes" : "❌ No");

  // Cleanup test sale
  await supabase.from("ventas").delete().eq("id", sale.id);
  console.log("Cleaned up test sale.");
}

run();
