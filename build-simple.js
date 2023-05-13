#!/usr/bin/env node
const esbuild = require('esbuild')

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
    define: {
        'process.env.VIAM_LOCATION': JSON.stringify(process.env.VIAM_LOCATION),
        'process.env.VIAM_SECRET': JSON.stringify(process.env.VIAM_SECRET)
      }
})