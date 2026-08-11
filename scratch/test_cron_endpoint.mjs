import fs from "fs";
import path from "path";

async function testCronEndpoint() {
  try {
    const envPath = path.resolve(process.cwd(), ".env.local");
    const envContent = fs.readFileSync(envPath, "utf-8");
    const getEnvVal = (key) => {
      const match = envContent.match(new RegExp(`^${key}=(.*)$`, "m"));
      return match ? match[1].trim() : null;
    };
    const cronSecret = getEnvVal("CRON_SECRET");

    console.log("Realizando petición GET a http://localhost:3000/api/cron/sync...");
    const headers = {};
    if (cronSecret) {
      headers["Authorization"] = `Bearer ${cronSecret}`;
    }

    const start = Date.now();
    const res = await fetch("http://localhost:3000/api/cron/sync", {
      headers
    });
    const duration = ((Date.now() - start) / 1000).toFixed(2);

    console.log(`Status: ${res.status} ${res.statusText} (Duración: ${duration}s)`);
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error("No se pudo parsear como JSON:", text);
      return;
    }
    console.log("Respuesta del Cron Sync:\n", JSON.stringify(data, null, 2));

    if (data.success) {
      console.log("✅ El endpoint de sincronización programada se ejecutó exitosamente!");
    } else {
      console.error("❌ El endpoint reportó un error:", data.error);
    }
  } catch (err) {
    console.error("❌ Error al conectar con el servidor Next.js local:", err.message);
  }
}

testCronEndpoint();
