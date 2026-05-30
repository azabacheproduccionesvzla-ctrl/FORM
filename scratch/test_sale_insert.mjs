import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// 1. Cargar variables de entorno de .env.local de forma manual
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

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Error: Falta configurar las variables en .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkAndTestInsert() {
  console.log("=== DIAGNÓSTICO DE BASE DE DATOS ===");
  
  // 1. Obtener usuarios actuales para verificar IDs
  console.log("\nConsultando usuarios_agencia...");
  const { data: users, error: usersErr } = await supabase
    .from("usuarios_agencia")
    .select("id, username, nombre, rol");
  
  if (usersErr) {
    console.error("❌ Error al obtener usuarios:", usersErr);
    return;
  }
  
  console.log("Usuarios en la base de datos:");
  console.table(users);
  
  // 2. Probar insertar cliente y venta usando IDs reales del primer usuario admin/ventas
  const devAdmin = users.find(u => u.rol === "admin");
  const devVentas = users.find(u => u.rol === "ventas");
  
  if (!devAdmin) {
    console.error("❌ No se encontró ningún usuario administrador en la base de datos.");
    return;
  }

  console.log(`\nUsando ID real del Admin (${devAdmin.nombre}): ${devAdmin.id}`);
  
  // Intentar crear un cliente de prueba
  console.log("\nIntentando crear un cliente nuevo...");
  const { data: clientData, error: clientErr } = await supabase
    .from("clientes")
    .insert({
      nombre: "Cliente Prueba RLS " + Date.now(),
      telefono: "+584265543207",
      email: "alvarezchristopherve@gmail.com",
      pais: "Venezuela",
      empresa: "Prueba",
      link_usuario_plataforma: "https://prueba.com",
      setter_original_id: devVentas?.id || devAdmin.id
    })
    .select()
    .single();

  if (clientErr) {
    console.error("❌ Error al crear cliente:", clientErr);
    console.error(JSON.stringify(clientErr, null, 2));
    return;
  }
  
  console.log("✅ Cliente creado con éxito, ID:", clientData.id);

  // Intentar crear la venta
  console.log("\nIntentando crear la venta...");
  const { data: saleData, error: saleErr } = await supabase
    .from("ventas")
    .insert({
      es_continuacion: false,
      tipo_venta: "Nueva Venta",
      tipo_proyecto: "Precio Fijo",
      status_pago: "Pago Adelantado",
      plataforma: "Workana",
      cliente_id: clientData.id,
      proyecto_nombre: "Prueba de Registro de Venta",
      proyecto_link: "https://prueba.com",
      proyecto_brief: "https://prueba.com",
      descripcion_operativa: "Prueba",
      deadline: "1998-12-20",
      urgente: false,
      moneda: "USD",
      monto_total: 200.00,
      comprobante_no_aplica: true,
      setter_principal_id: devVentas?.id || devAdmin.id,
      setters_adicionales_ids: [],
      closer_principal_id: devVentas?.id || devAdmin.id,
      closers_adicionales_ids: [],
      tipo_cierre: "Cierre por closer",
      notas_internas: "Prueba",
      usuario_registro_id: devAdmin.id,
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
    console.error("❌ Error al crear venta:", saleErr);
    console.error(JSON.stringify(saleErr, null, 2));
  } else {
    console.log("✅ Venta creada con éxito, Código:", saleData.codigo_venta);
  }
}

checkAndTestInsert();
