import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import { requireEnvVar } from "@personal-running-coach/integrations";

const ENCRYPTION_PREFIX = "enc:v1";

export function encryptString(plaintext: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    ENCRYPTION_PREFIX,
    iv.toString("base64url"),
    authTag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(":");
}

export function decryptString(ciphertext: string) {
  const [prefix, iv, authTag, encryptedPayload] = ciphertext.split(":");
  if (prefix !== ENCRYPTION_PREFIX || !iv || !authTag || !encryptedPayload) {
    throw new Error("Unsupported ciphertext format.");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(authTag, "base64url"));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(encryptedPayload, "base64url")),
    decipher.final(),
  ]);

  return plaintext.toString("utf8");
}

export function sha256Hex(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function getEncryptionKey() {
  return createHash("sha256").update(requireEnvVar("APP_ENCRYPTION_KEY"), "utf8").digest();
}
