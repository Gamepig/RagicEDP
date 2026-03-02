import "server-only";

import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb);

const KEY_LENGTH = 64;

export function generateStrongPassword(length = 20): string {
  // Avoid ambiguous chars while keeping high entropy
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*()-_=+";
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[bytes[i] % chars.length];
  }
  return out;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  return `scrypt:${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [scheme, salt, hex] = encoded.split(":");
  if (scheme !== "scrypt" || !salt || !hex) return false;
  const actual = Buffer.from(hex, "hex");
  const derived = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  if (actual.length !== derived.length) return false;
  return timingSafeEqual(actual, derived);
}
