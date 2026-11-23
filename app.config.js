import fs from 'fs'

const variant = process.env.APP_VARIANT ?? 'production'
const isDev = variant === 'development'

const iosPlist = './GoogleService-Info.plist'
const hasIosPlist = fs.existsSync(iosPlist)

export default ({ config }) => ({
  ...config, // everything from app.json: icon, adaptiveIcon, plugins, permissions, ios, etc.

  name: isDev ? 'Orbit Development' : 'Orbit',
  scheme: isDev ? 'orbitnative-dev' : 'orbitnative',

  android: {
    ...config.android,
    package: isDev ? 'com.orbitdevelopment.app' : 'com.orbit.app',
    googleServicesFile: isDev ? './google-services-dev.json' : './google-services.json',
  },

  ios: {
    ...config.ios,
    ...(hasIosPlist ? { googleServicesFile: iosPlist } : {}),
  },

  extra: {
    ...config.extra,
    appVariant: variant,
  },
})