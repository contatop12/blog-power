const ALGORITHM = 'AES-GCM'
const IV_LENGTH = 12

function getKeyMaterial(keyBase64: string): ArrayBuffer {
  const raw = Uint8Array.from(atob(keyBase64), (c) => c.charCodeAt(0))
  if (raw.length !== 32) {
    throw new Error('ENCRYPTION_KEY deve ter 32 bytes em base64')
  }
  return raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength)
}

export async function encryptSecret(plaintext: string, keyBase64: string): Promise<string> {
  const keyData = getKeyMaterial(keyBase64)
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const key = await crypto.subtle.importKey('raw', keyData, { name: ALGORITHM }, false, ['encrypt'])
  const encoded = new TextEncoder().encode(plaintext)
  const cipher = await crypto.subtle.encrypt({ name: ALGORITHM, iv }, key, encoded)
  const combined = new Uint8Array(iv.length + cipher.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(cipher), iv.length)
  return btoa(String.fromCharCode(...combined))
}

export async function decryptSecret(ciphertext: string, keyBase64: string): Promise<string> {
  const keyData = getKeyMaterial(keyBase64)
  const combined = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0))
  const iv = combined.slice(0, IV_LENGTH)
  const data = combined.slice(IV_LENGTH)
  const key = await crypto.subtle.importKey('raw', keyData, { name: ALGORITHM }, false, ['decrypt'])
  const plain = await crypto.subtle.decrypt({ name: ALGORITHM, iv }, key, data)
  return new TextDecoder().decode(plain)
}
