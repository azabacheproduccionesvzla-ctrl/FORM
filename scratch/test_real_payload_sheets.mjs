import fs from "fs";
import path from "path";

// Load .env.local variables
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

function formatExcelDate(dateStr) {
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

async function testRealPayloadSheets() {
  const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
  console.log("Sheets Webhook URL:", webhookUrl ? "Configured" : "Missing");

  if (!webhookUrl) {
    console.error("Missing GOOGLE_SHEETS_WEBHOOK_URL in .env.local");
    return;
  }

  // Exact payload format from src/lib/automations.ts
  const sheetsPayload = {
    etapa: "PAGO ADELANTADO",
    plataforma: "Workana",
    codigo_venta: "AZB-TEST-REAL",
    fecha_inicio: formatExcelDate(new Date()),
    cliente: "Cliente Prueba Real Sheets",
    codigo_cliente: "test-contact-id-123",
    proyecto: "Proyecto de Prueba Sheets Real",
    monto_cc: 150,
    comision: "REVISAR",
    setter_1: "Jorge Blanco ",
    setter_2: "",
    closer_1: "Argenis Fernandez ",
    closer_2: "",
    closer_3: "",
    factura: "https://comprobante-test-real.com",
    fecha_pago: "2026-06-19"
  };

  try {
    console.log("\nSending real payload to Google Sheets...");
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
      console.log("✅ Real webhook payload sent and verified successfully!");
    } else {
      console.error("❌ Google Sheets Webhook returned error:", responseText);
    }
  } catch (err) {
    console.error("❌ Exception during Google Sheets validation:", err);
  }
}

testRealPayloadSheets();
