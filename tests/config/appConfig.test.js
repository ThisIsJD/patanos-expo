import { afterEach, describe, expect, test } from '@jest/globals'

const configuration = require('../../app.config')
const buildProfiles = require('../../eas.json').build
const originalEnvironment = process.env.EXPO_PUBLIC_APP_ENV
afterEach(() => {
  if (originalEnvironment === undefined) delete process.env.EXPO_PUBLIC_APP_ENV
  else process.env.EXPO_PUBLIC_APP_ENV = originalEnvironment
})

describe('Android environment identities', () => {
  test.each([
    ['development', 'com.patanos.pos.dev', ' [DEV]'],
    ['staging', 'com.patanos.pos.staging', ' [STAGING]'],
    ['production', 'com.patanos.pos', ''],
  ])('%s has a distinct launcher/package identity', (environment, androidPackage, label) => {
    process.env.EXPO_PUBLIC_APP_ENV = environment
    const config = configuration()
    expect(config.android.package).toBe(androidPackage)
    expect(config.name).toBe('patanos-POS' + label)
    expect(config.extra.appEnvironment).toBe(environment)
    expect(JSON.stringify(config)).not.toContain('SENTRY_AUTH_TOKEN')
  })
  test('rejects unknown environment labels', () => {
    process.env.EXPO_PUBLIC_APP_ENV = 'typo'
    expect(configuration).toThrow('EXPO_PUBLIC_APP_ENV')
  })
  test.each(['preview', 'staging'])('%s builds explicitly select the isolated staging identity', profileName => {
    const profile = buildProfiles[profileName]
    expect(profile.environment).toBe('preview')
    expect(profile.distribution).toBe('internal')
    expect(profile.android.buildType).toBe('apk')
    expect(profile.env.EXPO_PUBLIC_APP_ENV).toBe('staging')
    process.env.EXPO_PUBLIC_APP_ENV = profile.env.EXPO_PUBLIC_APP_ENV
    expect(configuration().android.package).toBe('com.patanos.pos.staging')
  })
})
