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

  const payload = {
    locationId: locationId,
    name: data.name,
    email: data.email || undefined,
    phone: data.phone || undefined,
    companyName: data.companyName || undefined,
    country: data.country || undefined,
  };

  const response = await fetch("https://services.leadconnectorhq.com/contacts/upsert", {
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
    type: type,
    message: message
  };

  if (type === "Email" && subject) {
    payload.subject = subject;
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
