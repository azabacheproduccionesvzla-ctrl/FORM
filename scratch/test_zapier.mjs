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

async function testZapier() {
  const zapierUrl = process.env.ZAPIER_WHATSAPP_WEBHOOK_URL;
  console.log("Zapier Webhook URL:", zapierUrl ? "Configured" : "Missing");

  if (!zapierUrl) {
    console.error("Falta ZAPIER_WHATSAPP_WEBHOOK_URL en .env.local");
    return;
  }

  try {
    const payload = {
      titulo: "*NUEVA VENTA REGISTRADA*",
      plataforma: "Workana",
      proyecto: "Proyecto Prueba Zapier",
      cliente: "Cliente Prueba Zapier",
      oferta: "N/A",
      equipo: "Setters: ventas dev | Closers: admin dev",
      monto: "100.00 USD",
      factura: "AZB-TEST-ZAP"
    };

    console.log("\nEnviando webhook a Zapier...");
    const res = await fetch(zapierUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    console.log("Status:", res.status, res.statusText);
    const responseText = await res.text();
    console.log("Response:", responseText);

    if (res.ok) {
      console.log("✅ Webhook de Zapier enviado y recibido exitosamente!");
    } else {
      console.error("❌ El servidor devolvió un error:", responseText);
    }
  } catch (err) {
    console.error("❌ Excepción al verificar Zapier:", err);
  }
}

testZapier();
