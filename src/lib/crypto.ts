import crypto from "crypto";

export type UserRole = "admin" | "ventas" | "auditor";

export function generateSalt(): string {
  return crypto.randomBytes(16).toString("hex");
}

export function hashPin(pin: string, salt: string): string {
  return crypto.scryptSync(pin, salt, 64).toString("hex");
}

export function verifyPin(pin: string, hash: string, salt: string): boolean {
  try {
    const testHash = hashPin(pin, salt);
    return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(testHash, "hex"));
  } catch (e) {
    return false;
  }
}

