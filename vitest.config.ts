import {
    configDefaults,
    defineConfig,
    mergeConfig,
} from 'vitest/config'

import basic from './vite.config.basic'

export default mergeConfig(basic, defineConfig({
    test: {
        include: [
            '**/*.test.?(c|m)[jt]s?(x)',
        ],
        exclude: [
            ...configDefaults.exclude,
            'drafts/**',
        ],
        typecheck: {
            include: [
                '**/*.test-d.?(c|m)[jt]s?(x)',
            ],
        },
        coverage: {
            provider: 'v8',
            reportsDirectory: './coverage',
            include: ['src/**'],
            reporter: [
                'text',
                'html',
                'json',
                'lcovonly',
            ],
        },
    },
}))
