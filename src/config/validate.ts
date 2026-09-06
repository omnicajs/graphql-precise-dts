import type {
    Config,
    DirectivePolicy,
    DocumentSelector,
    ExecutionConfig,
    ScalarMapping,
} from './types'
import type { TsType } from './ts-type'

import { isRecord } from '@/predicates'
import { isAbsolute } from 'node:path'
import { z } from 'zod'

const string = z.string({ error: 'expected a string' })
const strings = z.array(string, { error: 'expected an array of strings' })
const namingStyle = z.enum(
    [ 'keep', 'pascalCase', 'camelCase', 'snakeCase' ],
    { error: 'unknown naming style' }
)

const tsType: z.ZodType<TsType> = z.lazy(() => z.discriminatedUnion('kind', [
    z.strictObject({
        kind: z.literal('named'),
        name: string,
    }, { error: 'expected an object' }),
    z.strictObject({
        kind: z.literal('null'),
    }, { error: 'expected an object' }),
    z.strictObject({
        kind: z.literal('unknown'),
    }, { error: 'expected an object' }),
    z.strictObject({
        kind: z.literal('array'),
        ofType: tsType,
    }, { error: 'expected an object' }),
    z.strictObject({
        kind: z.literal('union'),
        types: z.array(tsType).min(1, { error: 'expected at least one type' }),
    }, { error: 'expected an object' }),
    z.strictObject({
        kind: z.literal('intersection'),
        types: z.array(tsType).min(1, { error: 'expected at least one type' }),
    }, { error: 'expected an object' }),
    z.strictObject({
        kind: z.literal('generic'),
        name: string,
        arguments: z.array(tsType).min(1, { error: 'expected at least one type' }),
    }, { error: 'expected an object' }),
    z.strictObject({
        kind: z.literal('object'),
        fields: z.array(z.strictObject({
            name: string,
            type: tsType,
            optional: z.boolean({ error: 'expected boolean' }),
        }, { error: 'expected an object' })),
    }, { error: 'expected an object' }),
    z.strictObject({
        kind: z.literal('tuple'),
        items: z.array(tsType),
    }, { error: 'expected an object' }),
    z.strictObject({
        kind: z.literal('literal'),
        value: z.union([ string, z.number(), z.boolean() ]),
    }, { error: 'expected an object' }),
], { error: 'expected a TypeScript type' }))

const directionalScalarMapping = z.strictObject({
    input: tsType.optional(),
    output: tsType.optional(),
}, { error: 'expected an object' }).refine(mapping => (
    mapping.input !== undefined || mapping.output !== undefined
), {
    message: 'expected an input or output mapping',
})

const scalarMapping: z.ZodType<ScalarMapping> = z.unknown().superRefine((value, context) => {
    const validator = isRecord(value) && Object.prototype.hasOwnProperty.call(value, 'kind')
        ? tsType
        : directionalScalarMapping
    const result = validator.safeParse(value)

    if (!result.success) result.error.issues.forEach(issue => context.addIssue({ ...issue }))
}).transform(value => value as ScalarMapping)

const naming = z.union([
    namingStyle,
    z.strictObject({
        typeNames: namingStyle.optional(),
        operationNames: namingStyle.optional(),
        fragmentNames: namingStyle.optional(),
        enumMembers: namingStyle.optional(),
    }, { error: 'expected an object' }),
], { error: 'unknown naming style' })

const sharedDirectivePolicy = z.discriminatedUnion('effect', [
    z.strictObject({ effect: z.literal('conditional') }),
    z.strictObject({ effect: z.literal('ignore') }),
    z.strictObject({
        effect: z.literal('warn'),
        message: string.optional(),
    }),
], { error: 'unknown directive effect' })

const fieldDirectivePolicy = z.discriminatedUnion('effect', [
    ...sharedDirectivePolicy.options,
    z.strictObject({ effect: z.literal('nonnull') }),
    z.strictObject({
        effect: z.literal('override'),
        type: tsType,
    }),
], { error: 'unknown field directive effect' })

const scopedDirectivePolicy = z.strictObject({
    field: fieldDirectivePolicy.optional(),
    fragmentSpread: sharedDirectivePolicy.optional(),
    inlineFragment: sharedDirectivePolicy.optional(),
}).refine(policy => Object.values(policy).some(value => value !== undefined), {
    message: 'expected at least one selection policy',
})

const directivePolicy: z.ZodType<DirectivePolicy> = z.unknown().superRefine((value, context) => {
    const validator = isRecord(value) && Object.prototype.hasOwnProperty.call(value, 'effect')
        ? fieldDirectivePolicy
        : scopedDirectivePolicy
    const result = validator.safeParse(value)

    if (!result.success) result.error.issues.forEach(issue => context.addIssue({ ...issue }))
}).transform(value => value as DirectivePolicy)

export const scalarMappings = z.record(
    string,
    scalarMapping,
    { error: 'expected an object' }
)

export const directivePolicies = z.record(
    string,
    directivePolicy,
    { error: 'expected an object' }
)

export const namingPolicy = naming

export const typenamePolicy = z.enum(['optional', 'abstract'], { error: 'unknown typename policy' })

export const resolveConfig = z.strictObject({
    alias: z.record(string, string, { error: 'expected an object' }).optional(),
}, { error: 'expected an object' })

const schemaOutputs = z.strictObject({
    root: string,
    types: string,
    enums: string.optional(),
}, { error: 'expected an object' })

const schema = z.strictObject({
    file: string,
    typesModule: string,
    enumsModule: string.optional(),
    scalars: scalarMappings.optional(),
    directives: directivePolicies.optional(),
    naming: namingPolicy.optional(),
    typename: typenamePolicy.optional(),
    outputs: schemaOutputs.optional(),
}, { error: 'expected an object' }).superRefine((value, context) => {
    if (value.outputs?.enums !== undefined && value.enumsModule === undefined) {
        context.addIssue({
            code: 'custom',
            path: [ 'outputs', 'enums' ],
            message: 'requires enumsModule',
        })
    }
    if (value.outputs !== undefined
        && value.outputs.enums === undefined
        && value.enumsModule !== undefined) {
        context.addIssue({
            code: 'custom',
            path: [ 'outputs', 'enums' ],
            message: 'is required when enumsModule is configured',
        })
    }
})

const globSelector = z.strictObject({
    include: strings,
    exclude: strings.optional(),
}, { error: 'expected an object' })

const documents = z.strictObject({
    files: strings.optional(),
    glob: globSelector.optional(),
    regexp: z.instanceof(RegExp, { error: 'expected a RegExp' }).optional(),
}, { error: 'expected an object' }).superRefine((value, context) => {
    const selectors = [ value.files, value.glob, value.regexp ]
        .filter(selector => selector !== undefined)
    if (selectors.length !== 1) {
        context.addIssue({
            code: 'custom',
            message: 'expected exactly one document selector',
        })
    }
    if (value.regexp?.global || value.regexp?.sticky) {
        context.addIssue({
            code: 'custom',
            path: [ 'regexp' ],
            message: 'must not use the g or y flag',
        })
    }
}).transform(value => value as DocumentSelector)

const target = z.strictObject({
    schema: string,
    documents,
    outputs: z.strictObject({
        tree: z.strictObject({ root: string }, { error: 'expected an object' }),
        aggregate: z.strictObject({ file: string }, { error: 'expected an object' }).optional(),
    }, { error: 'expected an object' }),
}, { error: 'expected an object' })

const project = z.strictObject({
    root: string,
    targets: z.record(string, target, { error: 'expected an object' }),
}, { error: 'expected an object' })

const execution = z.strictObject({
    mode: z.enum([ 'sequential', 'parallel' ], { error: 'expected sequential or parallel' })
        .optional(),
    maxWorkers: z.int({ error: 'expected a positive integer' })
        .positive({ error: 'expected a positive integer' })
        .optional(),
}, { error: 'expected an object' }).superRefine((value, context) => {
    if (value.mode === 'parallel' && value.maxWorkers === undefined) {
        context.addIssue({
            code: 'custom',
            path: [ 'maxWorkers' ],
            message: 'is required for parallel execution',
        })
    }
    if (value.mode !== 'parallel' && value.maxWorkers !== undefined) {
        context.addIssue({
            code: 'custom',
            path: [ 'maxWorkers' ],
            message: 'is only allowed for parallel execution',
        })
    }
}).transform(value => value as ExecutionConfig)

const config: z.ZodType<Config> = z.strictObject({
    root: string.refine(isAbsolute, { message: 'expected an absolute path' }),
    schemas: z.record(string, schema, { error: 'expected an object' }),
    projects: z.record(string, project, { error: 'expected an object' }),
    cache: z.strictObject({
        directory: string.optional(),
        enabled: z.boolean({ error: 'expected a boolean' }).optional(),
    }, { error: 'expected an object' }).optional(),
    execution: execution.optional(),
    resolve: resolveConfig.optional(),
}, { error: 'expected an object' }).superRefine((value, context) => {
    for (const [ projectId, projectConfig ] of Object.entries(value.projects)) {
        for (const [ targetId, targetConfig ] of Object.entries(projectConfig.targets)) {
            if (Object.prototype.hasOwnProperty.call(value.schemas, targetConfig.schema)) continue

            context.addIssue({
                code: 'custom',
                path: [ 'projects', projectId, 'targets', targetId, 'schema' ],
                message: `unknown schema "${targetConfig.schema}"`,
            })
        }
    }
})

type ValidationIssue = z.ZodError['issues'][number]

const issuePath = (issue: ValidationIssue): string => {
    const path = issue.path.map(segment => String(segment)).join('.')

    if (issue.code === 'unrecognized_keys') {
        return [ path || 'config', String(issue.keys[0]) ].join('.')
    }

    return path || 'config'
}

const issueMessage = (issue: ValidationIssue): string => {
    if (issue.code === 'unrecognized_keys') return 'unknown property'
    return issue.message
}

export const makeValidationError = (
    subject: string,
    error: z.ZodError
): Error => {
    const issue = error.issues[0]!

    return new Error(
        `Invalid ${subject} at "${issuePath(issue)}": ${issueMessage(issue)}`
    )
}

export function validateConfig(value: unknown): asserts value is Config {
    const result = config.safeParse(value)
    if (result.success) return

    throw makeValidationError('configuration', result.error)
}
