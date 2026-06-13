function isValidPhone(p?: string): boolean {
  if (!p) return false;
  const clean = p.replace(/\D/g, "");
  return clean.length >= 5;
}

export async function createGhlContact(data: {
  name: string;
  email?: string;
  phone?: string;
  companyName?: string;
  country?: string;
}) {
  const token = process.env.GHL_ACCESS_TOKEN;
  const locationId = process.env.GHL_LOCATION_ID;

  if (!token || !locationId) {
    throw new Error("GHL_ACCESS_TOKEN o GHL_LOCATION_ID no configurados.");
  }

  let existingContact: any = null;

  // 1. Buscar por email si está provisto
  if (data.email && data.email.trim()) {
    const emailClean = data.email.trim().toLowerCase();
    try {
      console.log(`[GHL API] Buscando contacto por email: ${emailClean}`);
      const queryUrl = `https://services.leadconnectorhq.com/contacts/?locationId=${locationId}&query=${encodeURIComponent(emailClean)}`;
      const res = await fetch(queryUrl, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Version": "2021-07-28",
          "Accept": "application/json"
        }
      });
      if (res.ok) {
        const result = await res.json();
        const contacts = result.contacts || [];
        existingContact = contacts.find((c: any) => c.email && c.email.toLowerCase().trim() === emailClean);
        if (existingContact) {
          console.log(`[GHL API] Contacto encontrado por email: ${existingContact.id}`);
        }
      } else {
        console.warn(`[GHL API] Error en búsqueda por email: ${res.statusText}`);
      }
    } catch (err) {
      console.error(`[GHL API] Excepción al buscar por email:`, err);
    }
  }

  const hasValidSupPhone = isValidPhone(data.phone);

  // 2. Si no se encontró por email, buscar por teléfono
  if (!existingContact && data.phone && data.phone.trim() && hasValidSupPhone) {
    const phoneClean = data.phone.trim();
    try {
      console.log(`[GHL API] Buscando contacto por teléfono: ${phoneClean}`);
      const queryUrl = `https://services.leadconnectorhq.com/contacts/?locationId=${locationId}&query=${encodeURIComponent(phoneClean)}`;
      const res = await fetch(queryUrl, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Version": "2021-07-28",
          "Accept": "application/json"
        }
      });
      if (res.ok) {
        const result = await res.json();
        const contacts = result.contacts || [];
        const digitsOnly = (p: string) => p.replace(/\D/g, "");
        const searchDigits = digitsOnly(phoneClean);
        if (searchDigits) {
          existingContact = contacts.find((c: any) => c.phone && digitsOnly(c.phone) === searchDigits);
          if (existingContact) {
            console.log(`[GHL API] Contacto encontrado por teléfono: ${existingContact.id}`);
          }
        }
      } else {
        console.warn(`[GHL API] Error en búsqueda por teléfono: ${res.statusText}`);
      }
    } catch (err) {
      console.error(`[GHL API] Excepción al buscar por teléfono:`, err);
    }
  }

  // Helper para normalizar textos y comparar
  const normalize = (val: any) => (val || "").toString().trim();
  const normalizeLower = (val: any) => normalize(val).toLowerCase();
  const getDigits = (val: any) => normalize(val).replace(/\D/g, "");

  if (existingContact) {
    // Siempre actualizamos para asegurarnos de que la etiqueta 'nueva_venta' esté aplicada
    console.log(`[GHL API] Agregando etiqueta 'nueva_venta' al contacto existente ${existingContact.id} en GHL.`);
    const updatePayload = {
      name: data.name,
      email: data.email || undefined,
      phone: hasValidSupPhone ? data.phone!.trim() : undefined,
      companyName: data.companyName || undefined,
      country: data.country || undefined,
      tags: ["nueva_venta"]
    };

    const updateRes = await fetch(`https://services.leadconnectorhq.com/contacts/${existingContact.id}`, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Version": "2021-07-28",
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(updatePayload)
    });

    if (!updateRes.ok) {
      const errorText = await updateRes.text();
      console.error(`[GHL API] Error al actualizar contacto/etiquetas ${existingContact.id}:`, errorText);
      throw new Error(`GHL API Contact Update Error: ${updateRes.statusText}`);
    }

    const result = await updateRes.json();
    return result.contact?.id || existingContact.id;
  }

  // 3. Si no existe, crear nuevo contacto con la etiqueta 'nueva_venta'
  console.log(`[GHL API] Contacto no encontrado. Creando nuevo contacto con etiqueta 'nueva_venta'.`);
  const payload = {
    locationId: locationId,
    name: data.name,
    email: data.email || undefined,
    phone: hasValidSupPhone ? data.phone!.trim() : undefined,
    companyName: data.companyName || undefined,
    country: data.country || undefined,
    tags: ["nueva_venta"]
  };

  const response = await fetch("https://services.leadconnectorhq.com/contacts/", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Version": "2021-07-28",
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[GHL API] Error creating contact:", errorText);
    throw new Error(`GHL API Contact Error: ${response.statusText}`);
  }

  const result = await response.json();
  return result.contact?.id;
}

export async function createGhlInvoice(contactId: string, data: {
  projectName: string;
  amount: number;
  currency: string;
  description?: string;
}) {
  const token = process.env.GHL_ACCESS_TOKEN;
  const locationId = process.env.GHL_LOCATION_ID;

  const issueDate = new Date().toISOString().split("T")[0];
  const priceInCents = Math.round((data.amount || 0) * 100);

  const payload = {
    altId: locationId,
    altType: "location",
    contactId: contactId,
    title: `Factura - ${data.projectName}`,
    issueDate: issueDate,
    status: "DRAFT",
    currency: (data.currency || "usd").toLowerCase(),
    items: [
      {
        name: data.projectName,
        price: priceInCents,
        quantity: 1,
        description: data.description || "Servicios creativos"
      }
    ]
  };

  const response = await fetch("https://services.leadconnectorhq.com/invoices/", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Version": "2021-07-28",
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[GHL API] Error creating invoice:", errorText);
    throw new Error(`GHL API Invoice Error: ${response.statusText}`);
  }

  const result = await response.json();
  return {
    invoiceId: result._id,
    invoiceNumber: result.invoiceNumber
  };
}

export async function sendGhlMessage(
  contactId: string, 
  type: "Email" | "SMS", 
  message: string, 
  subject?: string
) {
  const token = process.env.GHL_ACCESS_TOKEN;

  const payload: any = {
    contactId: contactId,
    type: type
  };

  if (type === "Email") {
    payload.html = message;
    if (subject) payload.subject = subject;
  } else {
    payload.message = message;
  }

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

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[GHL API] Error sending ${type}:`, errorText);
    throw new Error(`GHL API Message Error: ${response.statusText}`);
  }

  return await response.json();
}
