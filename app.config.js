const base = require('./app.json').expo

module.exports = () => {
  const environment = process.env.EXPO_PUBLIC_APP_ENV || 'development'
  const variants = {
    development: { suffix: '.dev', label: ' [DEV]' },
    staging: { suffix: '.staging', label: ' [STAGING]' },
    production: { suffix: '', label: '' },
  }
  const variant = variants[environment]
  if (!variant) throw new Error('EXPO_PUBLIC_APP_ENV must be development, staging, or production')
  const monitoringPlugins = process.env.SENTRY_ORG && process.env.SENTRY_PROJECT
    ? [['@sentry/react-native/expo', {
      organization: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      url: 'https://sentry.io/',
    }]] : []
  return {
    ...base,
    name: base.name + variant.label,
    scheme: base.scheme + (environment === 'production' ? '' : '-' + environment),
    android: { ...base.android, package: base.android.package + variant.suffix },
    ios: { ...base.ios, bundleIdentifier: 'com.patanos.pos' + variant.suffix },
    plugins: [...base.plugins, ...monitoringPlugins],
    extra: { ...base.extra, appEnvironment: environment },
  }
}
