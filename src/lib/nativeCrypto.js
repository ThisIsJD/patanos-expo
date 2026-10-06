import { Platform } from 'react-native'
let nativeReady = false

// auth-js requires these WebCrypto-shaped methods for cryptographic PKCE/S256 on Hermes.
export function installNativeCrypto(target = globalThis, platform = Platform.OS) {
  if (platform === 'web') return
  try {
    // Older installed APKs may not contain this native module. Keep ordinary POS login usable.
    const Crypto = require('expo-crypto')
    if (!target.crypto) target.crypto = {}
    if (!target.crypto.getRandomValues) target.crypto.getRandomValues = Crypto.getRandomValues
    if (!target.crypto.subtle) {
      target.crypto.subtle = { digest: (algorithm, bytes) => {
        const name = typeof algorithm === 'string' ? algorithm : algorithm?.name
        if (name !== 'SHA-256') throw new Error('Only SHA-256 is supported by the native PKCE adapter')
        return Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes)
      } }
    }
    nativeReady = true
  } catch { nativeReady = false }
  return nativeReady
}

export function hasSecurePKCE() {
  return nativeReady && typeof globalThis.crypto?.getRandomValues === 'function' &&
    typeof globalThis.crypto?.subtle?.digest === 'function' && typeof globalThis.TextEncoder === 'function' &&
    typeof globalThis.btoa === 'function'
}
