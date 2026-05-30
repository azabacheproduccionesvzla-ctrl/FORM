export async function appendRowToSheet(
  payload: any
): Promise<{ success: boolean; error?: string }> {
  try {
    const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL;

    if (!webhookUrl) {
      console.warn("GOOGLE_SHEETS_WEBHOOK_URL not configured in environment variables.");
      return {
        success: false,
        error: "GOOGLE_SHEETS_WEBHOOK_URL is not configured in environment variables.",
      };
    }

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Google Sheets Webhook returned status ${res.status}: ${text}`);
    }

    return {
      success: true,
    };
  } catch (err: any) {
    console.error("Google Sheets Webhook error:", err);
    return {
      success: false,
      error: err.message || "Unknown error triggering Google Sheets Webhook.",
    };
  }
}
