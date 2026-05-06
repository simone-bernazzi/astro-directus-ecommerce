// PM2 ecosystem — deploy su VPS con @astrojs/node adapter
// Posiziona nella root del progetto sul server e avvia con: pm2 start ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: process.env.DEPLOY_PM2_APP || 'frontend',
      script: './dist/server/entry.mjs',
      env: {
        HOST: '127.0.0.1',
        PORT: parseInt(process.env.DEPLOY_PORT) || 4321,
        NODE_ENV: 'production',
      },
    },
  ],
}
