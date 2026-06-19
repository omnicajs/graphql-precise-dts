import type { GenerationModels } from '../../../src/models/generation'

import {
    describe,
    expect,
    test,
    vi,
} from 'vitest'

import {
    arrayOf,
    defineGeneric,
    defineNamed,
    defineNull,
    defineObject,
    defineObjectField,
    defineString,
    defineTuple,
    intersectionOf,
    unionOf,
} from '../../../src'

import { emitCustomScalarNamedTypeWarnings } from '../../../src/diagnostics/scalar-name-warnings'

const emptyGenerationModels = (): GenerationModels => ({
    schema: {
        enumReferences: new Set(),
        scalars: new Map(),
        inputTypes: new Map(),
        interfaceTypes: new Map(),
        objectTypes: new Map(),
        unionTypes: new Map(),
        fieldArgTypes: [],
    },
    registry: {
        enums: new Map(),
        fragments: new Map(),
    },
})

const scalarModel = () => ({
    input: 'unknown',
    output: 'unknown',
})

describe('custom scalar name warnings', () => {
    const expectWarningForName = (
        reportWarning: ReturnType<typeof vi.fn>,
        scalarName: string,
        usage: string,
        typeName: string
    ) => {
        expect(reportWarning).toHaveBeenCalledWith(expect.stringContaining(
            `Custom scalar "${scalarName}" ${usage} maps to named TypeScript type "${typeName}"`
        ))
    }

    test('collects named references from array and tuple scalar mappings', () => {
        const models = emptyGenerationModels()
        const reportWarning = vi.fn()

        models.schema.scalars.set('SearchFilter', scalarModel())
        models.schema.inputTypes.set('GeneratedArrayInput', defineString())
        models.schema.inputTypes.set('GeneratedTupleInput', defineString())

        emitCustomScalarNamedTypeWarnings(models, {
            SearchFilter: {
                input: defineTuple(
                    arrayOf(defineNamed('GeneratedArrayInput')),
                    defineNamed('GeneratedTupleInput')
                ),
                output: defineString(),
            },
        }, reportWarning)

        expectWarningForName(reportWarning, 'SearchFilter', 'input type', 'GeneratedArrayInput')
        expectWarningForName(reportWarning, 'SearchFilter', 'input type', 'GeneratedTupleInput')
    })

    test('collects named references from generic scalar mappings', () => {
        const models = emptyGenerationModels()
        const reportWarning = vi.fn()

        models.schema.scalars.set('SearchFilter', scalarModel())
        models.schema.fieldArgTypes.push({
            parentTypeName: 'Generated',
            fieldName: '',
            type: defineString(),
        })
        models.registry.enums.set('GeneratedEnum', {
            entries: [],
        })

        emitCustomScalarNamedTypeWarnings(models, {
            SearchFilter: {
                input: defineGeneric('GeneratedArgs', defineNamed('GeneratedEnum')),
                output: defineString(),
            },
        }, reportWarning)

        expectWarningForName(reportWarning, 'SearchFilter', 'input type', 'GeneratedArgs')
        expectWarningForName(reportWarning, 'SearchFilter', 'input type', 'GeneratedEnum')
    })

    test('ignores TypeScript keyword names used as generic wrappers', () => {
        const models = emptyGenerationModels()
        const reportWarning = vi.fn()

        models.schema.scalars.set('SearchFilter', scalarModel())
        models.schema.inputTypes.set('GeneratedInput', defineString())

        emitCustomScalarNamedTypeWarnings(models, {
            SearchFilter: {
                input: defineGeneric('unknown', defineNamed('GeneratedInput')),
                output: defineString(),
            },
        }, reportWarning)

        expectWarningForName(reportWarning, 'SearchFilter', 'input type', 'GeneratedInput')
        expect(reportWarning).toHaveBeenCalledTimes(1)
    })

    test('collects named references from object, intersection, and union scalar mappings', () => {
        const models = emptyGenerationModels()
        const reportWarning = vi.fn()

        models.schema.scalars.set('SearchFilter', scalarModel())
        models.schema.objectTypes.set('GeneratedObject', {
            fields: defineString(),
            interfaces: [],
        })
        models.schema.unionTypes.set('GeneratedUnion', defineString())

        emitCustomScalarNamedTypeWarnings(models, {
            SearchFilter: {
                input: defineString(),
                output: defineObject({
                    value: defineObjectField(intersectionOf(
                        defineNamed('GeneratedObject'),
                        unionOf(defineNamed('GeneratedUnion'), defineString())
                    )),
                }),
            },
        }, reportWarning)

        expectWarningForName(reportWarning, 'SearchFilter', 'output type', 'GeneratedObject')
        expectWarningForName(reportWarning, 'SearchFilter', 'output type', 'GeneratedUnion')
    })

    test('reports combined input and output usage when both scalar directions reference the same generated name', () => {
        const models = emptyGenerationModels()
        const reportWarning = vi.fn()

        models.schema.scalars.set('SharedScalar', scalarModel())
        models.schema.inputTypes.set('GeneratedInput', defineString())

        emitCustomScalarNamedTypeWarnings(models, {
            SharedScalar: {
                input: defineNamed('GeneratedInput'),
                output: unionOf(defineNamed('GeneratedInput'), defineNull()),
            },
        }, reportWarning)

        expect(reportWarning).toHaveBeenCalledWith(expect.stringContaining(
            'Custom scalar "SharedScalar" input and output types maps to named TypeScript type "GeneratedInput"'
        ))
    })

    test('ignores custom scalar mappings for scalars absent from the schema', () => {
        const models = emptyGenerationModels()
        const reportWarning = vi.fn()

        models.schema.inputTypes.set('GeneratedInput', defineString())

        emitCustomScalarNamedTypeWarnings(models, {
            MissingScalar: defineNamed('GeneratedInput'),
        }, reportWarning)

        expect(reportWarning).not.toHaveBeenCalled()
    })
})
