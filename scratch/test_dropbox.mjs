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

async function testDropbox() {
  const refreshToken = process.env.DROPBOX_REFRESH_TOKEN;
  const appKey = process.env.DROPBOX_APP_KEY;
  const appSecret = process.env.DROPBOX_APP_SECRET;

  console.log("Dropbox Refresh Token:", refreshToken ? "Configured" : "Missing");
  console.log("Dropbox App Key:", appKey ? "Configured" : "Missing");
  console.log("Dropbox App Secret:", appSecret ? "Configured" : "Missing");

  if (!refreshToken || !appKey || !appSecret) {
    console.error("Faltan credenciales de Dropbox en .env.local");
    return;
  }

  try {
    // 1. Refrescar token
    console.log("\nRefrescando token de Dropbox...");
    const params = new URLSearchParams();
    params.append("grant_type", "refresh_token");
    params.append("refresh_token", refreshToken);
    params.append("client_id", appKey);
    params.append("client_secret", appSecret);

    const tokenRes = await fetch("https://api.dropboxapi.com/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
      console.error("❌ Error al refrescar token de Dropbox:", tokenData);
      return;
    }

    const accessToken = tokenData.access_token;
    console.log("✅ Token refrescado con éxito!");

    // 2. Intentar crear una carpeta de prueba
    const folderPath = `/ENTREGA/TEST_AGENT_${Date.now()}`;
    console.log(`\nIntentando crear carpeta de prueba: ${folderPath}...`);

    const createRes = await fetch("https://api.dropboxapi.com/2/files/create_folder_v2", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        path: folderPath,
        autorename: false,
      }),
    });

    const createData = await createRes.json();
    if (!createRes.ok) {
      console.error("❌ Error al crear la carpeta:", createData);
      return;
    }

    console.log("✅ Carpeta creada con éxito en Dropbox!");
    console.log("Metadata:", createData.metadata);

    // 3. Crear enlace compartido
    console.log("\nCreando enlace compartido...");
    const linkRes = await fetch("https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        path: folderPath,
        settings: {
          requested_visibility: "public"
        }
      }),
    });

    const linkData = await linkRes.json();
    if (!linkRes.ok) {
      console.error("❌ Error al crear enlace compartido:", linkData);
      return;
    }

    console.log("✅ Enlace compartido creado con éxito!");
    console.log("Enlace:", linkData.url);

  } catch (err) {
    console.error("❌ Excepción en la prueba de Dropbox:", err);
  }
}

testDropbox();
