import { describe, it, expect, beforeEach } from "vitest";
import { encrypt, decrypt } from "./crypto.js";

describe("crypto utilities", () => {
  beforeEach(() => {
    process.env.API_KEY_ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  });

  it("should encrypt and decrypt a plaintext string successfully", () => {
    const plaintext = "my-secret-api-key-123";
    const encrypted = encrypt(plaintext);
    expect(encrypted).toBeDefined();
    expect(encrypted).not.toBe(plaintext);
    expect(encrypted.split(":")).toHaveLength(3);

    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it("should throw an error during encryption if the encryption key is missing", () => {
    const originalKey = process.env.API_KEY_ENCRYPTION_KEY;
    delete process.env.API_KEY_ENCRYPTION_KEY;

    expect(() => encrypt("secret")).toThrow("API_KEY_ENCRYPTION_KEY environment variable is required");

    process.env.API_KEY_ENCRYPTION_KEY = originalKey;
  });

  it("should throw an error during decryption if the encrypted format is invalid", () => {
    expect(() => decrypt("invalid-ciphertext")).toThrow("Invalid encrypted format");
    expect(() => decrypt("iv:authTag")).toThrow("Invalid encrypted format");
    expect(() => decrypt("iv:authTag:ciphertext:extra")).toThrow("Invalid encrypted format");
  });

  it("should throw an error during decryption if authentication tag or content is tampered", () => {
    const plaintext = "sensitive-information";
    const encrypted = encrypt(plaintext);
    const parts = encrypted.split(":");

    // Tamper with the ciphertext (parts[2])
    const tamperedCiphertext = parts[2].substring(0, parts[2].length - 2) + "00";
    const tamperedEncrypted = `${parts[0]}:${parts[1]}:${tamperedCiphertext}`;

    expect(() => decrypt(tamperedEncrypted)).toThrow();
  });
});
