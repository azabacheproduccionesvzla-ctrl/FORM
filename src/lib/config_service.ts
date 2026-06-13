import fs from "fs";
import path from "path";
import { supabase } from "@/lib/supabase";

const LOCAL_CONFIG_PATH = path.resolve(process.cwd(), "src/lib/config.json");

export interface IntegrationConfig {
  dropbox: boolean;
  trello: boolean;
  ghl_email: boolean;
  ghl_factura: boolean;
  zapier_whatsapp: boolean;
  google_sheets: boolean;
  email_destinatarios?: string;
}

const DEFAULT_CONFIG: IntegrationConfig = {
  dropbox: true,
  trello: true,
  ghl_email: true,
  ghl_factura: true,
  zapier_whatsapp: true,
  google_sheets: true,
  email_destinatarios: "alvarezchristopherve@gmail.com"
};

export async function getIntegrationConfig(): Promise<IntegrationConfig> {
  try {
    const { data, error } = await supabase
      .from("configuraciones")
      .select("valor")
      .eq("clave", "integraciones")
      .maybeSingle();

    if (!error && data && data.valor) {
      return { ...DEFAULT_CONFIG, ...data.valor };
    }
  } catch (e) {
  }

  try {
    if (fs.existsSync(LOCAL_CONFIG_PATH)) {
      const content = fs.readFileSync(LOCAL_CONFIG_PATH, "utf8");
      return { ...DEFAULT_CONFIG, ...JSON.parse(content) };
    }
  } catch (e) {
    console.error("Error reading local config:", e);
  }

  return DEFAULT_CONFIG;
}

export async function updateIntegrationConfig(config: IntegrationConfig): Promise<boolean> {
  let dbSuccess = false;
  try {
    const { error } = await supabase
      .from("configuraciones")
      .upsert({ clave: "integraciones", valor: config });

    if (!error) {
      dbSuccess = true;
    }
  } catch (e) {
  }

  try {
    fs.writeFileSync(LOCAL_CONFIG_PATH, JSON.stringify(config, null, 2), "utf8");
    return true;
  } catch (e) {
    console.error("Error writing local config:", e);
    return dbSuccess;
  }
}
