import type { CompileResult } from './compile'
import type { FragmentIndex } from './plan/fragments'
import type {
    GeneratedBundleResult,
    SchemaInput,
    ModuleRendering,
} from './types'

import { createPlan } from './plan/create'
import { renderDocument } from './render'

export const generateBundle = (
    result: CompileResult,
    fragments: FragmentIndex,
    schema: SchemaInput,
    rendering?: ModuleRendering
): GeneratedBundleResult => {
    if ('diagnostic' in result) {
        return { diagnostics: [ ...result.diagnostics, result.diagnostic ] }
    }

    const plan = createPlan(result.document, fragments, schema)
    if ('diagnostic' in plan) {
        return { diagnostics: [ ...result.diagnostics, plan.diagnostic ] }
    }

    return {
        diagnostics: result.diagnostics,
        output: {
            sourceId: result.document.sourceId,
            content: renderDocument(plan.document, schema, rendering?.paths),
            ...(rendering?.aggregate ? { aggregateContent: renderDocument(plan.document, schema) } : {}),
        },
    }
}
