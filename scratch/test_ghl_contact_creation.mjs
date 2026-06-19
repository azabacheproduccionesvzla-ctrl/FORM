import fs from "fs";
import path from "path";

async function testGhlContactCreation() {
  try {
    const envPath = path.resolve(process.cwd(), ".env.local");
    const envContent = fs.readFileSync(envPath, "utf-8");
    const getEnvVal = (key) => {
      const match = envContent.match(new RegExp(`^${key}=(.*)$`, "m"));
      return match ? match[1].trim() : null;
    };

    const token = getEnvVal("GHL_ACCESS_TOKEN");
    const locationId = getEnvVal("GHL_LOCATION_ID");

    if (!token || !locationId) {
      console.error("GHL credentials missing in .env.local");
      return;
    }

    const payload = {
      locationId: locationId,
      firstName: "OmarA.",
      lastName: "M. R.",
      email: "sabiduriahamster@gmail.com",
      country: "MX",
      tags: ["nueva_venta"]
    };

    console.log("Sending payload to GoHighLevel contacts endpoint:\n", JSON.stringify(payload, null, 2));

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

    console.log("Response Status:", response.status);
    console.log("Response StatusText:", response.statusText);
    
    const text = await response.text();
    console.log("Response Body:\n", text);

  } catch (err) {
    console.error("Crash:", err);
  }
}

testGhlContactCreation();
