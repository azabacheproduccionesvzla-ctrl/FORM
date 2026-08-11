import { supabase } from "./supabase";

export type IntegrationType =
  | "GHL Contacto"
  | "GHL Factura"
  | "Trello"
  | "Dropbox"
  | "WhatsApp"
  | "Email"
  | "Cuadro Maestro";

export type LogSeverity = "INFO" | "SUCCESS" | "ERROR";

export async function addSaleLog(
  saleId: string,
  integration: IntegrationType,
  severity: LogSeverity,
  message: string
) {
  try {
    const time = new Date().toLocaleTimeString();
    console.log(`[Log - ${integration}] [${severity}] ${message}`);
    
    const { error } = await supabase.from("ventas_logs").insert({
      venta_id: saleId,
      integracion: integration,
      tipo: severity,
      mensaje: message
    });

    if (error) {
      console.error("[logs.ts] Error saving log in database:", error.message);
    }
  } catch (err) {
    console.error("[logs.ts] Exception while logging:", err);
  }
}
