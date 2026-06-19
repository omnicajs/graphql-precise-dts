import type { CustomScalarMappingRecord } from '../scalars/types'
import type { GenerationModels } from '../models/generation'
import type { ScalarUsage } from '../scalars/types'
import type { TsType } from '../ts-type'

import { createNamingConvention } from '../naming'
import { isSameTsType } from '../ts-type'
import { isTsKeywordTypeName } from '../ts-type'
import { resolveCustomScalarTypeTs } from '../scalars/builder'

import { TS_TYPE_KIND } from '../ts-type'

const GENERATED_DECLARATION_KIND = {
    GRAPHQL_TYPE: 'GraphQL type declaration',
    FIELD_ARGUMENTS_HELPER: 'field arguments helper declaration',
    ENUM: 'enum declaration',
    SCHEMA_HELPER: 'schema helper declaration',
} as const

type GeneratedDeclarationKind = typeof GENERATED_DECLARATION_KIND[keyof typeof GENERATED_DECLARATION_KIND]

const collectNamedTsTypeReferences = (
    type: TsType,
    names: Set<string> = new Set()
): Set<string> => {
    switch (type.kind) {
        case TS_TYPE_KIND.NAMED:
            if (!isTsKeywordTypeName(type.name)) names.add(type.name)
            return names
        case TS_TYPE_KIND.ARRAY:
            return collectNamedTsTypeReferences(type.ofType, names)
        case TS_TYPE_KIND.UNION:
        case TS_TYPE_KIND.INTERSECTION:
            type.types.forEach(current => collectNamedTsTypeReferences(current, names))
            return names
        case TS_TYPE_KIND.GENERIC:
            if (!isTsKeywordTypeName(type.name)) names.add(type.name)
            type.args.forEach(current => collectNamedTsTypeReferences(current, names))
            return names
        case TS_TYPE_KIND.OBJECT:
            type.fields.forEach(field => collectNamedTsTypeReferences(field.type, names))
            return names
        case TS_TYPE_KIND.TUPLE:
            type.items.forEach(item => collectNamedTsTypeReferences(item, names))
            return names
        default:
            return names
    }
}

const addGeneratedName = (
    generatedNames: Map<string, Set<GeneratedDeclarationKind>>,
    name: string,
    kind: GeneratedDeclarationKind
) => {
    const kinds = generatedNames.get(name) ?? new Set<GeneratedDeclarationKind>()

    kinds.add(kind)
    generatedNames.set(name, kinds)
}

const makeGeneratedNameMap = ({ schema, registry }: GenerationModels): Map<string, Set<GeneratedDeclarationKind>> => {
    const generatedNames = new Map<string, Set<GeneratedDeclarationKind>>()
    const naming = createNamingConvention()

    addGeneratedName(generatedNames, 'Exact', GENERATED_DECLARATION_KIND.SCHEMA_HELPER)
    addGeneratedName(generatedNames, 'MaybePromise', GENERATED_DECLARATION_KIND.SCHEMA_HELPER)

    if (schema.scalars.size > 0) {
        addGeneratedName(generatedNames, 'Scalars', GENERATED_DECLARATION_KIND.SCHEMA_HELPER)
    }
    schema.inputTypes.forEach((_, name) => addGeneratedName(generatedNames, name, GENERATED_DECLARATION_KIND.GRAPHQL_TYPE))
    schema.interfaceTypes.forEach((_, name) => addGeneratedName(generatedNames, name, GENERATED_DECLARATION_KIND.GRAPHQL_TYPE))
    schema.objectTypes.forEach((_, name) => addGeneratedName(generatedNames, name, GENERATED_DECLARATION_KIND.GRAPHQL_TYPE))
    schema.unionTypes.forEach((_, name) => addGeneratedName(generatedNames, name, GENERATED_DECLARATION_KIND.GRAPHQL_TYPE))
    schema.fieldArgTypes.forEach(({ parentTypeName, fieldName }) =>
        addGeneratedName(
            generatedNames,
            naming.fieldArgTypeName(parentTypeName, fieldName),
            GENERATED_DECLARATION_KIND.FIELD_ARGUMENTS_HELPER
        )
    )

    registry.enums.forEach((_, name) => addGeneratedName(generatedNames, name, GENERATED_DECLARATION_KIND.ENUM))

    return generatedNames
}

const formatKinds = (kinds: Set<GeneratedDeclarationKind>): string => [ ...kinds ].sort().join(' and ')

const collectNamedReferencesByUsage = (
    inputType: TsType,
    outputType: TsType
): Map<string, Set<ScalarUsage>> => {
    const references = new Map<string, Set<ScalarUsage>>()

    const addReferences = (usage: ScalarUsage, type: TsType) => {
        collectNamedTsTypeReferences(type).forEach(name => {
            const usages = references.get(name) ?? new Set<ScalarUsage>()

            usages.add(usage)
            references.set(name, usages)
        })
    }

    addReferences('input', inputType)
    addReferences('output', outputType)

    return references
}

const formatUsageSubject = (
    scalarName: string,
    usages: Set<ScalarUsage>,
    withUsage: boolean
): string => {
    if (!withUsage) return `Custom scalar "${scalarName}" maps`

    const usageLabel = usages.size === 2 ? 'input and output types' : `${[ ...usages ][0]} type`

    return `Custom scalar "${scalarName}" ${usageLabel} maps`
}

export const emitCustomScalarNamedTypeWarnings = (
    models: GenerationModels,
    customScalars: CustomScalarMappingRecord,
    reportWarning: (message: string) => void = message => console.warn(message)
) => {
    const generatedNames = makeGeneratedNameMap(models)

    Object.entries(customScalars).forEach(([ scalarName, scalar ]) => {
        if (!models.schema.scalars.has(scalarName)) return

        const inputType = resolveCustomScalarTypeTs(scalar, 'input')
        const outputType = resolveCustomScalarTypeTs(scalar, 'output')
        const references = collectNamedReferencesByUsage(inputType, outputType)

        references.forEach((usages, name) => {
            const generatedKinds = generatedNames.get(name)
            if (!generatedKinds) return

            reportWarning(
                `${formatUsageSubject(scalarName, usages, !isSameTsType(inputType, outputType))} to named TypeScript type "${name}", `
                + `which is also generated by the plugin as ${formatKinds(generatedKinds)}. `
                + 'This may make the scalar reference resolve to the generated declaration instead of an external type.'
            )
        })
    })
}
