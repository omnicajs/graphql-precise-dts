import type { CompileResult } from './compile'
import type { CompiledFragment } from './model'
import type {
    GeneratedBundleResult,
    SchemaInput,
    ModuleRendering,
} from './types'

export type GenerationWorkerState = {
    fragments: ReadonlyArray<readonly [string, CompiledFragment]>
    schema: SchemaInput
    rendering?: ModuleRendering
}

export type GenerationWorkerRequest = {
    index: number
    bundle: CompileResult
}

export type GenerationWorkerResponse = {
    index: number
    result?: GeneratedBundleResult
    error?: {
        name: string
        message: string
        stack?: string
    }
}
