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

async function checkTrelloDetails() {
  const key = process.env.TRELLO_API_KEY;
  const token = process.env.TRELLO_TOKEN;
  const boardId = process.env.TRELLO_ID_BOARD;

  if (!key || !token || !boardId) {
    console.error("Faltan credenciales de Trello en .env.local");
    return;
  }

  try {
    // 1. Consultar etiquetas del tablero
    console.log(`\nConsultando etiquetas del tablero ${boardId}...`);
    const labelsUrl = `https://api.trello.com/1/boards/${boardId}/labels?key=${key}&token=${token}`;
    const labelsRes = await fetch(labelsUrl);
    if (!labelsRes.ok) {
      console.error("❌ Error al obtener etiquetas de Trello:", labelsRes.statusText);
    } else {
      const labels = await labelsRes.json();
      console.log(`Etiquetas disponibles (${labels.length}):`);
      labels.forEach(l => {
        console.log(` - ID: ${l.id} | Nombre: "${l.name || ''}" | Color: ${l.color}`);
      });
      
      // Verificar IDs específicos del código
      const urgentLabelId = "68ac8a1c6b2b8bdfa33fce90";
      const normalLabelId = "67c5eddd229eaba704057ca0";
      console.log(`\nVerificando si los IDs del código existen:`);
      console.log(` - Urgente (${urgentLabelId}):`, labels.some(l => l.id === urgentLabelId) ? "✅ EXISTE" : "❌ NO EXISTE");
      console.log(` - Normal (${normalLabelId}):`, labels.some(l => l.id === normalLabelId) ? "✅ EXISTE" : "❌ NO EXISTE");
    }

    // 2. Consultar miembros del tablero
    console.log(`\nConsultando miembros del tablero ${boardId}...`);
    const membersUrl = `https://api.trello.com/1/boards/${boardId}/members?key=${key}&token=${token}`;
    const membersRes = await fetch(membersUrl);
    if (!membersRes.ok) {
      console.error("❌ Error al obtener miembros de Trello:", membersRes.statusText);
    } else {
      const members = await membersRes.json();
      console.log(`Miembros disponibles (${members.length}):`);
      members.forEach(m => {
        console.log(` - ID: ${m.id} | Username: "${m.username}" | Nombre completo: "${m.fullName}"`);
      });

      // Verificar IDs específicos del código
      const hardcodedMemberIds = ["6234bce84174cf4ea0ee02fb", "5728ceaca2d6d5913b8cb5cd", "5ff29a0bd4a465505546a8b3", "58e43e1d3360cf5e81ee5e0a"];
      console.log(`\nVerificando miembros hardcodeados en el código:`);
      hardcodedMemberIds.forEach(id => {
        const found = members.find(m => m.id === id);
        console.log(` - ID ${id}:`, found ? `✅ EXISTE (${found.fullName})` : "❌ NO EXISTE");
      });
    }

  } catch (err) {
    console.error("❌ Excepción al verificar detalles de Trello:", err);
  }
}

checkTrelloDetails();
