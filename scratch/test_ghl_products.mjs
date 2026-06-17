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

async function testProducts() {
  const token = process.env.GHL_ACCESS_TOKEN;
  const locationId = process.env.GHL_LOCATION_ID;

  if (!token || !locationId) {
    console.error("Faltan credenciales de GHL en .env.local");
    return;
  }

  try {
    console.log("Obteniendo productos de GHL...");
    const response = await fetch(`https://services.leadconnectorhq.com/products/?locationId=${locationId}&limit=50`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Version": "2021-07-28",
        "Accept": "application/json"
      }
    });

    const result = await response.json();
    console.log("Status:", response.status, response.statusText);
    console.log("Result:", JSON.stringify(result, null, 2));

  } catch (err) {
    console.error("Error fetching products:", err);
  }
}

testProducts();
