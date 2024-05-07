#!/usr/bin/env node
const esbuild = require('esbuild')
const envfilePlugin = require('esbuild-envfile-plugin')

esbuild.serve({
  servedir: 'static-simple',
  port: 8000,
}, {
  entryPoints: ['src/main-simple.ts'],
  bundle: true,
  sourcemap: true,
  sourcesContent: true,
  target: [
    'es2015',
  ],
  outfile: 'static-simple/main-simple.js',
  plugins: [envfilePlugin],
})
  .then(({ host, port }) => console.log(`Serving application at ${host}:${port}`))
  .catch((error) => {
    console.error(`Error serving application: ${error.message}`)
    process.exit(1)
  })
