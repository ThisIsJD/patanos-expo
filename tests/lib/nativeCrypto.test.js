import { beforeEach, expect, jest, test } from '@jest/globals'
import { installNativeCrypto } from '@/src/lib/nativeCrypto'
import * as Crypto from 'expo-crypto'
import { createClient } from '@supabase/supabase-js'
const { Buffer } = require('node:buffer')

jest.mock('expo-crypto', () => ({ getRandomValues: jest.fn(array => require('node:crypto').webcrypto.getRandomValues(array)),
  digest: jest.fn((algorithm, bytes) => require('node:crypto').webcrypto.subtle.digest(algorithm, bytes)),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' } }))
beforeEach(() => jest.clearAllMocks())

test('native adapter delegates randomness and SHA-256 to Expo Crypto without a Math.random fallback', async () => {
  const target = {}
  expect(installNativeCrypto(target, 'android')).toBe(true)
  const random = new Uint32Array(56)
  expect(target.crypto.getRandomValues(random)).toBe(random)
  expect(random.some(value => value !== 0)).toBe(true)
  const actual = await target.crypto.subtle.digest('SHA-256', new TextEncoder().encode('abc'))
  expect(Buffer.from(actual).toString('hex')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  expect(Crypto.getRandomValues).toHaveBeenCalledWith(random)
  expect(Crypto.digest).toHaveBeenCalledTimes(1)
  expect(() => target.crypto.subtle.digest('MD5', random)).toThrow('Only SHA-256')
})
test('complete existing crypto implementations are not replaced', () => {
  const crypto = { getRandomValues: jest.fn(), subtle: { digest: jest.fn() } }
  const target = { crypto }
  installNativeCrypto(target, 'android')
  expect(target.crypto).toBe(crypto)
  expect(target.crypto.getRandomValues).toBe(crypto.getRandomValues)
  expect(Crypto.getRandomValues).not.toHaveBeenCalled()
})
test('web globals are not modified', () => {
  const target = {}
  installNativeCrypto(target, 'web')
  expect(target).toEqual({})
})
test('an older APK unable to install the adapter fails closed without throwing at app startup', () => {
  const target = Object.freeze({})
  expect(() => installNativeCrypto(target, 'android')).not.toThrow()
  expect(installNativeCrypto(target, 'android')).toBe(false)
})

test('installed Supabase SDK actually sends S256 and stores a recovery-marked verifier', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'crypto')
  Object.defineProperty(globalThis, 'crypto', { configurable: true, writable: true, value: undefined })
  const records = new Map()
  const fetch = jest.fn(async () => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => ({}) }))
  const client = createClient('http://127.0.0.1:54321', 'synthetic-public-key', {
    global: { fetch }, auth: { autoRefreshToken: false, detectSessionInUrl: false, flowType: 'pkce',
      storage: { getItem: key => records.get(key) || null, setItem: (key, value) => { records.set(key, value) },
        removeItem: key => { records.delete(key) } } },
  })
  try {
    installNativeCrypto()
    const result = await client.auth.resetPasswordForEmail('staff@patanos.test', { redirectTo: 'patanosexpo-development://reset-password' })
    expect(result.error).toBeNull()
    const request = JSON.parse(fetch.mock.calls[0][1].body)
    expect(request.code_challenge_method).toBe('s256')
    const stored = JSON.parse([...records.entries()].find(([key]) => key.endsWith('-code-verifier'))[1])
    expect(stored).toMatch(/\/PASSWORD_RECOVERY$/)
    const verifier = stored.split('/')[0]
    const expected = require('node:crypto').createHash('sha256').update(verifier).digest('base64url')
    expect(request.code_challenge).toBe(expected)
    expect(Crypto.getRandomValues).toHaveBeenCalled()
  } finally {
    await client.auth.stopAutoRefresh()
    if (original) Object.defineProperty(globalThis, 'crypto', original)
    else delete globalThis.crypto
  }
})
