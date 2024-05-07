#!/usr/bin/env node
const esbuild = require('esbuild')
const envfilePlugin = require('esbuild-envfile-plugin')

esbuild.serve({
  servedir: 'static',
  port: 8000,
}, {
  entryPoints: ['src/main.ts'],
  bundle: true,
  sourcemap: true,
  sourcesContent: true,
  target: [
    'es2015',
  ],
  outfile: 'static/main.js',
  plugins: [envfilePlugin],
})
  .then(({ host, port }) => console.log(`Serving application at ${host}:${port}`))
  .catch((error) => {
    console.error(`Error serving application: ${error.message}`)
    process.exit(1)
  })

