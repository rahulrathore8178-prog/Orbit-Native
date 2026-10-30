// app.config.js
const variant = process.env.APP_VARIANT ?? 'production'
const isDev = variant === 'development'

export default ({ config }) => ({
  ...config, // everything from app.json: icon, adaptiveIcon, plugins, permissions, ios, etc.

  name: isDev ? 'Orbit Development' : 'Orbit',
  scheme: isDev ? 'orbitnative-dev' : 'orbitnative',

  android: {
    ...config.android,
    package: isDev ? 'com.orbitdevelopment.app' : 'com.orbit.app',
    googleServicesFile: isDev ? './google-services-dev.json' : './google-services.json',
  },

  extra: {
    ...config.extra,
    appVariant: variant,
  },
})