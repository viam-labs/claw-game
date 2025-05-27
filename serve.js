#!/usr/bin/env node
const esbuild = require('esbuild')
const envfilePlugin = require('esbuild-envfile-plugin')

const context = esbuild.context({
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

context.then(c => c.serve({
  servedir: 'static',
  port: 8000,
}))
  .then(({ host, port }) => console.log(`Serving application at ${host}:${port}`))
  .catch((error) => {
    console.error(`Error serving application: ${error.message}`)
    process.exit(1)
  })
