// Stub — crypto operations moved to saltdig
// These are minimal stubs to keep saltyhall building

export function encrypt(text: string): string {
  // TODO: delegate to saltdig API for real encryption
  return Buffer.from(text).toString("base64");
}

export function decrypt(encrypted: string): string {
  return Buffer.from(encrypted, "base64").toString("utf-8");
}
