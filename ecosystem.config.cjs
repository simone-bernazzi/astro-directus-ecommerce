// PM2 ecosystem — deploy su VPS con @astrojs/node adapter
// Posiziona nella root del progetto sul server e avvia con: pm2 start ecosystem.config.cjs
const fs = require('fs')
const path = require('path')

function loadDotEnv(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8')
    const env = {}
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const idx = trimmed.indexOf('=')
      if (idx === -1) continue
      const key = trimmed.slice(0, idx).trim()
      let val = trimmed.slice(idx + 1).trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      env[key] = val
    }
    return env
  } catch {
    return {}
  }
}

const envVars = loadDotEnv(path.join(__dirname, '.env'))

module.exports = {
  apps: [
    {
      name: process.env.DEPLOY_PM2_APP || 'frontend',
      script: './dist/server/entry.mjs',
      env: {
        HOST: '127.0.0.1',
        PORT: parseInt(process.env.DEPLOY_PORT) || 4321,
        NODE_ENV: 'production',
        ...envVars,
      },
    },
  ],
}
