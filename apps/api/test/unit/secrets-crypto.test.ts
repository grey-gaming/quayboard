import { describe, expect, it } from "vitest";

import { createSecretsCrypto } from "../../src/services/secrets-crypto.js";

describe("createSecretsCrypto", () => {
  it("encrypts and decrypts values", () => {
    const crypto = createSecretsCrypto(Buffer.alloc(32, 7).toString("base64url"));
    const encrypted = crypto.encrypt("super-secret-value");

    expect(encrypted).not.toContain("super-secret-value");
    expect(crypto.decrypt(encrypted)).toBe("super-secret-value");
  });
});
