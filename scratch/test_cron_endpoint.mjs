async function testCronEndpoint() {
  console.log("Realizando petición GET a http://localhost:3000/api/cron/sync...");
  try {
    const start = Date.now();
    const res = await fetch("http://localhost:3000/api/cron/sync");
    const duration = ((Date.now() - start) / 1000).toFixed(2);

    console.log(`Status: ${res.status} ${res.statusText} (Duración: ${duration}s)`);
    const data = await res.json();
    console.log("Respuesta del Cron Sync:\n", JSON.stringify(data, null, 2));

    if (data.success) {
      console.log("✅ El endpoint de sincronización programada se ejecutó exitosamente!");
    } else {
      console.error("❌ El endpoint reportó un error:", data.error);
    }
  } catch (err) {
    console.error("❌ Error al conectar con el servidor Next.js local:", err.message);
    console.log("Nota: Asegúrate de que el servidor local de Next.js esté corriendo en http://localhost:3000");
  }
}

testCronEndpoint();
