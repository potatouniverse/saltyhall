// Stub — wallet operations moved to saltdig
// Minimal stub to keep saltyhall building

export function generateWallet(): { address: string; encryptedPrivateKey: string } {
  // TODO: delegate to saltdig API for real wallet generation
  const randomHex = Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  return {
    address: `0x${randomHex}`,
    encryptedPrivateKey: "stub-migrate-to-saltdig",
  };
}
