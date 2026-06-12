import fs from "fs";
import path from "path";

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

async function testSheets() {
  const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
  console.log("Sheets Webhook URL:", webhookUrl ? "Configured" : "Missing");

  if (!webhookUrl) {
    console.error("Falta GOOGLE_SHEETS_WEBHOOK_URL en .env.local");
    return;
  }

  try {
    const sheetsPayload = {
      status_pago: "Pago Adelantado",
      plataforma: "Workana",
      codigo_venta: "AZB-TEST-1234",
      fecha_registro_formateada: new Date().toLocaleString(),
      cliente_nombre: "Cliente Prueba Sheets",
      contact_id: "aFQCCsPB2gXCG0CQqsBf",
      proyecto_nombre: "Proyecto Prueba Sheets",
      monto_total: 150.00,
      moneda: "USD",
      setter_principal_nombre: "ventas dev",
      setters_adicionales_nombres: [],
      closer_principal_nombre: "admin dev",
      closers_adicionales_nombres: [],
      comprobante_link: "https://comprobante-test.com",
      fecha_pago: "2026-06-12"
    };

    console.log("\nEnviando datos a Google Sheets...");
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(sheetsPayload),
    });

    console.log("Status:", res.status, res.statusText);
    const responseText = await res.text();
    console.log("Response:", responseText);

    if (res.ok) {
      console.log("✅ Webhook de Google Sheets enviado y recibido exitosamente!");
    } else {
      console.error("❌ El servidor devolvió un error:", responseText);
    }
  } catch (err) {
    console.error("❌ Excepción al verificar Google Sheets:", err);
  }
}

testSheets();
