import type { ExecutionConfig } from '@/config/types'
import type { CompileResult } from './compile'
import type { FragmentIndex } from './plan/fragments'
import type {
    GeneratedBundleResult,
    SchemaInput,
    ModuleRendering,
} from './types'
import type { GenerationWorkerState } from './worker-types'

import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateBundle } from './bundle'
import { scheduleBundles } from '@/execution/schedule'
import { scheduleWorkers } from '@/execution/workers'

const resolveWorkerRuntime = (): string | undefined => {
    /* v8 ignore start -- @preserve CJS and ESM package paths are exercised by package smoke. */
    const currentFile = typeof __filename === 'string'
        ? __filename
        // @ts-expect-error The ESM build provides import.meta while the CJS build uses __filename.
        : fileURLToPath(import.meta.url)
    /* v8 ignore stop */
    const currentDirectory = dirname(currentFile)
    const candidates = [
        resolve(currentDirectory, 'generation-worker.mjs'),
        resolve(currentDirectory, '../generation-worker.mjs'),
    ]

    return candidates.find(existsSync)
}

export const scheduleGenerationBundles = (
    bundles: ReadonlyArray<CompileResult>,
    execution: ExecutionConfig | undefined,
    fragments: FragmentIndex,
    schema: SchemaInput,
    rendering?: ModuleRendering
): Promise<ReadonlyArray<GeneratedBundleResult>> => {
    const runtime = execution?.mode === 'parallel'
        ? resolveWorkerRuntime()
        : undefined

    /* v8 ignore start -- @preserve the built worker runtime is exercised by package smoke. */
    if (runtime && execution?.mode === 'parallel') {
        const state: GenerationWorkerState = {
            fragments: [ ...fragments ],
            schema,
            rendering,
        }

        return scheduleWorkers({
            bundles,
            maxWorkers: execution.maxWorkers,
            runtime,
            state,
        })
    }
    /* v8 ignore stop */

    return scheduleBundles(
        bundles,
        execution,
        bundle => generateBundle(bundle, fragments, schema, rendering)
    )
}
