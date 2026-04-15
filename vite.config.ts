import { defineConfig } from 'vite'
import { builtinModules } from 'node:module'
import { mergeConfig } from 'vite'
import { resolve } from 'node:path'

import basic from './vite.config.basic'
import dts from 'vite-plugin-dts'
import packageJson from './package.json'

const dependencies = packageJson.dependencies ?? {}
const peerDependencies = packageJson.peerDependencies ?? {}
const nodeBuiltins = builtinModules.flatMap(moduleName => [
    moduleName,
    `node:${moduleName}`,
])

export default mergeConfig(basic, defineConfig({
    build: {
        lib: {
            entry: resolve(__dirname, './src/index.ts'),
            name: '@omnicajs/graphql-precise-dts',
        },
        minify: false,
        rollupOptions: {
            external: [
                ...nodeBuiltins,
                ...Object.keys(dependencies),
                ...Object.keys(peerDependencies),
            ],
            output: [
                {
                    format: 'es',
                    exports: 'named',
                    dir: resolve(__dirname, './dist'),
                    entryFileNames: '[name].mjs',
                    chunkFileNames: 'common.mjs',
                },
                {
                    format: 'cjs',
                    exports: 'named',
                    dir: resolve(__dirname, './dist'),
                    entryFileNames: '[name].cjs',
                    chunkFileNames: 'common.cjs',
                },
            ],
        },
    },

    plugins: [
        dts({
            include: ['src'],
        }),
    ],
}))
