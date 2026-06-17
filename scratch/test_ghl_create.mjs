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

async function testGhl() {
  const token = process.env.GHL_ACCESS_TOKEN;
  const locationId = process.env.GHL_LOCATION_ID;

  console.log("GHL Access Token:", token ? "Configured" : "Missing");
  console.log("GHL Location ID:", locationId);

  if (!token || !locationId) {
    console.error("Faltan credenciales de GHL en .env.local");
    return;
  }

  try {
    // 1. Crear/Upsert un contacto de prueba
    console.log("\nCreando/Actualizando contacto en GHL...");
    const contactPayload = {
      locationId: locationId,
      name: "Cliente Prueba Agente",
      email: "alvarezchristopherve@gmail.com",
      phone: "+584120000000",
      companyName: "Empresa Prueba",
      country: "VE"
    };

    const contactRes = await fetch("https://services.leadconnectorhq.com/contacts/upsert", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Version": "2021-07-28",
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(contactPayload)
    });

    const contactData = await contactRes.json();
    if (!contactRes.ok) {
      console.error("❌ Error al crear contacto en GHL:", contactData);
      return;
    }

    const contactId = contactData.contact?.id;
    console.log(`✅ Contacto creado/encontrado en GHL! ID: ${contactId}`);

    // 2. Crear una factura borrador de prueba
    console.log("\nCreando factura borrador en GHL...");
    const issueDate = new Date().toISOString().split("T")[0];
    const invoicePayload = {
      altId: locationId,
      altType: "location",
      name: `Factura Prueba - Proyecto Agente`,
      status: "DRAFT",
      issueDate: issueDate,
      dueDate: issueDate,
      currency: "USD",
      contactId: contactId,
      businessDetails: {
        name: "Azabache Producciones",
        phoneNo: "+584120000000",
        website: "https://azabacheproducciones.com",
        address: {
          addressLine1: "Caracas",
          city: "Caracas",
          state: "DF",
          countryCode: "VE",
          postalCode: "1010"
        }
      },
      contactDetails: {
        id: contactId,
        name: "Cliente Prueba Agente",
        email: "alvarezchristopherve@gmail.com"
      },
      items: [
        {
          productId: "6a144f8ad7158a116689a21a",
          priceId: "6a144f8ad7158a40b889a21f",
          name: "Instagram Growth Specialist",
          qty: 1,
          amount: 15000,
          currency: "USD"
        }
      ]
    };

    const invoiceRes = await fetch("https://services.leadconnectorhq.com/invoices/", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Version": "2021-07-28",
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(invoicePayload)
    });

    const invoiceData = await invoiceRes.json();
    if (!invoiceRes.ok) {
      console.error("❌ Error al crear factura en GHL:", invoiceData);
      return;
    }

    console.log("✅ Factura borrador creada con éxito en GHL!");
    console.log(`ID de Factura: ${invoiceData._id}`);
    console.log(`Número de Factura: ${invoiceData.invoiceNumber}`);

  } catch (err) {
    console.error("❌ Excepción en la prueba de GHL:", err);
  }
}

testGhl();
