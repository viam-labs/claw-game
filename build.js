#!/usr/bin/env node

const esbuild = require('esbuild')

esbuild.build({
  entryPoints: ['src/module-main.ts'],
  bundle: true,
  sourcemap: true,
  sourcesContent: true,
  target: [
    'es2022',
  ],
  outfile: 'static/main.js',
}).then(() => {
  console.log('Successfully built web app source.')
}).catch((error) => {
  console.error(`Failed to build web app source: ${error}`)
})
