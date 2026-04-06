import globals from 'globals'

import pluginJs from '@eslint/js'
import pluginTs from 'typescript-eslint'
import pluginVitest from '@vitest/eslint-plugin'

export default [
    { files: [ '**/*.{js,mjs,cjs,ts,mts,cts}' ] },
    {
        languageOptions: {
            globals: {
                ...globals.node,
            },
        },
    },
    pluginJs.configs.recommended,
    ...pluginTs.configs.recommended,
    {
        files: [ '**/*.{ts,mts,cts}' ],
        rules: {
            '@typescript-eslint/ban-ts-comment': 'off',
            '@typescript-eslint/no-empty-function': 'off',
            'brace-style': ['error', '1tbs', { allowSingleLine: false }],
            'comma-dangle': ['error', {
                arrays: 'always-multiline',
                exports: 'always-multiline',
                functions: 'never',
                imports: 'always-multiline',
                objects: 'always-multiline',
            }],
            'indent': ['error', 4, {
                'ignoreComments': true,
                'SwitchCase': 1,
            }],
            'no-debugger': 'error',
            'no-empty': 'off',
            'no-trailing-spaces': ['error'],
            'no-unsafe-optional-chaining': 'off',
            'no-useless-escape': 'off',
            'object-curly-spacing': ['error', 'always'],
            'quotes': ['error', 'single', {
                allowTemplateLiterals: true,
            }],
            'space-infix-ops': ['error', { 'int32Hint': false }],
        },
    },
    {
        files: [ 'tests/**/*.{test,test-d}.ts' ],
        plugins: {
            vitest: pluginVitest,
        },
        rules: {
            'vitest/no-conditional-expect': 'error',
            'vitest/no-conditional-in-test': 'error',
            'vitest/no-conditional-tests': 'error',
            'vitest/no-identical-title': 'error',
            'vitest/prefer-hooks-in-order': 'error',
            'vitest/prefer-hooks-on-top': 'error',
            'vitest/prefer-importing-vitest-globals': 'error',
            'vitest/prefer-vi-mocked': 'error',
        },
    },
    {
        files: [ '**/*.d.ts' ],
        rules: {
            '@typescript-eslint/array-type': [ 'error', {
                default: 'generic',
                readonly: 'generic',
            } ],
            '@typescript-eslint/consistent-type-imports': [ 'error', {
                prefer: 'type-imports',
                fixStyle: 'separate-type-imports',
            } ],
            '@typescript-eslint/no-empty-object-type': 'error',
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-unused-vars': 'off',
        },

    },
    { ignores: [ '**/dist' ] },
    { ignores: [ '**/node_modules' ] },
    { ignores: [ 'src/generated/**' ] },
]
