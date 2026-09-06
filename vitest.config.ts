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
            // The executable wrapper is exercised by test:package, outside Vitest instrumentation.
            exclude: ['src/cli.ts'],
            reporter: [
                'text',
                'html',
                'json',
                'lcovonly',
            ],
            thresholds: {
                'src/**': {
                    100: true,
                },
            },
        },
    },
}))
