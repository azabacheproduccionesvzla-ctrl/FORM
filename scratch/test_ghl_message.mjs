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

async function testGhlMessage() {
  const token = process.env.GHL_ACCESS_TOKEN;
  const contactId = "gyfFHe4nYJTyWW3DjD41"; // ID creado en la prueba anterior

  if (!token) {
    console.error("Falta GHL_ACCESS_TOKEN en .env.local");
    return;
  }

  try {
    console.log(`\nIntentando enviar mensaje de prueba (Email) al contacto ${contactId}...`);
    const payload = {
      contactId: contactId,
      type: "Email",
      message: "<p>Prueba de notificaciones de email via GHL.</p>",
      subject: "Test Notificaciones Azabache"
    };

    const response = await fetch("https://services.leadconnectorhq.com/conversations/messages", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Version": "2021-07-28",
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    if (!response.ok) {
      console.error("❌ Error al enviar mensaje via GHL:", result);
    } else {
      console.log("✅ Mensaje via GHL enviado con éxito!", result);
    }

  } catch (err) {
    console.error("❌ Excepción en la prueba de mensajes de GHL:", err);
  }
}

testGhlMessage();
