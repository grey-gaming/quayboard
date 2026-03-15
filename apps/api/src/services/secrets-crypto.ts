import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { HttpError } from "./http-error.js";

const AES_ALGORITHM = "aes-256-gcm";
const MISSING_KEY_MESSAGE =
  "Secrets encryption is unavailable. Set SECRETS_ENCRYPTION_KEY and restart the API.";

const decodeKey = (rawKey: string) => {
  const key = Buffer.from(rawKey, "base64url");

  if (key.length !== 32) {
    throw new Error("SECRETS_ENCRYPTION_KEY must decode to 32 bytes.");
  }

  return key;
};

export const createSecretsCrypto = (rawKey: string) => {
  const key = decodeKey(rawKey);

  return {
    encrypt(value: string) {
      const iv = randomBytes(12);
      const cipher = createCipheriv(AES_ALGORITHM, key, iv);
      const encrypted = Buffer.concat([
        cipher.update(value, "utf8"),
        cipher.final(),
      ]);
      const tag = cipher.getAuthTag();

      return [iv.toString("base64url"), encrypted.toString("base64url"), tag.toString("base64url")].join(".");
    },
    decrypt(value: string) {
      const [ivEncoded, payloadEncoded, tagEncoded] = value.split(".");

      if (!ivEncoded || !payloadEncoded || !tagEncoded) {
        throw new Error("Invalid encrypted secret payload.");
      }

      const decipher = createDecipheriv(
        AES_ALGORITHM,
        key,
        Buffer.from(ivEncoded, "base64url"),
      );
      decipher.setAuthTag(Buffer.from(tagEncoded, "base64url"));

      return Buffer.concat([
        decipher.update(Buffer.from(payloadEncoded, "base64url")),
        decipher.final(),
      ]).toString("utf8");
    },
  };
};

export const createUnavailableSecretsCrypto = () => ({
  encrypt(_value: string) {
    throw new HttpError(503, "secrets_encryption_unavailable", MISSING_KEY_MESSAGE);
  },
  decrypt(_value: string) {
    throw new HttpError(503, "secrets_encryption_unavailable", MISSING_KEY_MESSAGE);
  },
});

export type SecretsCrypto = ReturnType<typeof createSecretsCrypto>;
