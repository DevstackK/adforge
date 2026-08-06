import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { AppError } from "@/lib/errors";

function key() {
  const encoded = process.env.ENCRYPTION_KEY;
  if (!encoded)
    throw new AppError(
      "Encryption key is not configured",
      "CONFIGURATION_ERROR",
      500,
    );
  const value = Buffer.from(encoded, "base64");
  if (value.byteLength !== 32)
    throw new AppError(
      "Encryption key must decode to 32 bytes",
      "CONFIGURATION_ERROR",
      500,
    );
  return value;
}

export function encryptSecret(plainText: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final(),
  ]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptSecret(payload: string) {
  const [version, iv, tag, encrypted] = payload.split(".");
  if (version !== "v1" || !iv || !tag || !encrypted)
    throw new AppError("Invalid encrypted secret", "INVALID_SECRET", 500);
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key(),
    Buffer.from(iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex");
