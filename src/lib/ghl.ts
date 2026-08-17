function isValidPhone(p?: string): boolean {
  if (!p) return false;
  const clean = p.replace(/\D/g, "");
  return clean.length >= 5;
}

function getCountryCode(countryName?: string): string | undefined {
  if (!countryName) return undefined;
  const clean = countryName.trim().toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // Remove accents

  // If it's already a 2-letter code, return it upper-cased
  if (clean.length === 2) {
    return clean.toUpperCase();
  }

  const map: { [key: string]: string } = {
    "argentina": "AR",
    "bolivia": "BO",
    "brasil": "BR",
    "canada": "CA",
    "chile": "CL",
    "colombia": "CO",
    "costa rica": "CR",
    "cuba": "CU",
    "ecuador": "EC",
    "el salvador": "SV",
    "estados unidos": "US",
    "usa": "US",
    "guatemala": "GT",
    "honduras": "HN",
    "mexico": "MX",
    "nicaragua": "NI",
    "panama": "PA",
    "paraguay": "PY",
    "peru": "PE",
    "puerto rico": "PR",
    "republica dominicana": "DO",
    "uruguay": "UY",
    "venezuela": "VE",
    "espana": "ES",
    "spain": "ES",
    "portugal": "PT",
    "francia": "FR",
    "france": "FR",
    "inglaterra": "GB",
    "england": "GB",
    "reino unido": "GB",
    "uk": "GB",
    "antigua y barbuda": "AG",
    "bahamas": "BS",
    "barbados": "BB",
    "belice": "BZ",
    "dominica": "DM",
    "granada": "GD",
    "guyana": "GY",
    "haiti": "HT",
    "jamaica": "JM",
    "san cristobal y nieves": "KN",
    "san vicente y las granadinas": "VC",
    "santa lucia": "LC",
    "surinam": "SR",
    "trinidad y tobago": "TT"
  };

  return map[clean] || undefined;
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

  // Split name to firstName and lastName to comply with GHL API schema
  const nameTrimmed = (data.name || "").trim();
  const parts = nameTrimmed.split(/\s+/);
  const firstName = parts[0] || "Cliente";
  const lastName = parts.slice(1).join(" ") || undefined;

  if (existingContact) {
    // Siempre actualizamos para asegurarnos de que la etiqueta 'nueva_venta' esté aplicada
    console.log(`[GHL API] Agregando etiqueta 'nueva_venta' al contacto existente ${existingContact.id} en GHL.`);
    const updatePayload = {
      firstName: firstName,
      lastName: lastName,
      email: data.email || undefined,
      phone: hasValidSupPhone ? data.phone!.trim() : undefined,
      companyName: data.companyName || undefined,
      country: getCountryCode(data.country),
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
    firstName: firstName,
    lastName: lastName,
    email: data.email || undefined,
    phone: hasValidSupPhone ? data.phone!.trim() : undefined,
    companyName: data.companyName || undefined,
    country: getCountryCode(data.country),
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
  currency?: string;
  description?: string;
  contactName?: string;
  contactEmail?: string;
}) {
  const token = process.env.GHL_ACCESS_TOKEN;
  const locationId = process.env.GHL_LOCATION_ID;

  const issueDate = new Date().toISOString().split("T")[0];
  const invoiceAmount = Number(data.amount) || 0;

  const payload = {
    altId: locationId,
    altType: "location",
    name: `Factura - ${data.projectName}`,
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
      name: data.contactName || "Cliente",
      email: data.contactEmail || ""
    },
    items: [
      {
        productId: "6a144f8ad7158a116689a21a",
        priceId: "6a144f8ad7158a40b889a21f",
        name: data.projectName,
        qty: 1,
        amount: invoiceAmount,
        currency: "USD",
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
