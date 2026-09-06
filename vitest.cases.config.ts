import { readdirSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

const casesRoot = resolve(__dirname, 'tests/cases')
const projects = (root: string): { root: string; tsconfig: string; name: string }[] => readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    if (entry.isDirectory()) return projects(resolve(root, entry.name))
    return ['tsconfig.json', 'tsconfig.aggregate.json'].includes(entry.name)
        ? [{ root, tsconfig: resolve(root, entry.name), name: relative(casesRoot, root) + (entry.name === 'tsconfig.json' ? '' : '/aggregate') }]
        : []
})

export default defineConfig({
    test: {
        projects: projects(casesRoot).map(({ root, tsconfig, name }) => ({
            test: {
                name,
                root,
                typecheck: {
                    enabled: true,
                    only: true,
                    tsconfig,
                    include: ['*.test-d.ts'],
                },
            },
        })),
    },
})
