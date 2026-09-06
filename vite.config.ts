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
            entry: {
                index: resolve(__dirname, './src/index.ts'),
                codegen: resolve(__dirname, './src/integrations/codegen.ts'),
                'generation-worker': resolve(
                    __dirname,
                    './src/generation/worker.ts'
                ),
            },
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
                    chunkFileNames: 'chunks/[name]-[hash].mjs',
                },
                {
                    format: 'cjs',
                    exports: 'named',
                    dir: resolve(__dirname, './dist'),
                    entryFileNames: '[name].cjs',
                    chunkFileNames: 'chunks/[name]-[hash].cjs',
                },
            ],
        },
    },

    plugins: [
        dts({
            include: ['src'],
            copyDtsFiles: true,
            entryRoot: 'src',
            insertTypesEntry: true,
        }),
    ],
}))
