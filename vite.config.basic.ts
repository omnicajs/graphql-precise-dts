import { defineConfig } from 'vite'
import { resolve } from 'node:path'

export default defineConfig({
    plugins: [],

    resolve: {
        alias: {
            '@': resolve(__dirname, './src'),
            '~types': resolve(__dirname, './types/'),
        },
    },
})
