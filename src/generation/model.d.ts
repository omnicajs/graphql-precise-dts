import type { OperationTypeNode } from 'graphql'
import type {
    SchemaInputValue,
    SchemaTypeRef,
    TypeId,
} from '@/schema/types'
import type { ScalarType } from './scalars'
import type { SourceLocation } from './types'

export type CompiledScalarValue = {
    kind: 'scalar'
    type: ScalarType
}

export type CompiledEnumValue = {
    kind: 'enum'
    type: TypeId
}

export type CompiledInputField = {
    name: string
    type: SchemaTypeRef
    optional: boolean
    value: CompiledInputValue
}

export type CompiledInputObjectValue = {
    kind: 'input-object'
    type: TypeId
    oneOf: boolean
    fields: ReadonlyArray<CompiledInputField>
}

export type CompiledInputReferenceValue = {
    kind: 'input-reference'
    type: TypeId
}

export type CompiledInputValue =
    | CompiledScalarValue
    | CompiledEnumValue
    | CompiledInputObjectValue
    | CompiledInputReferenceValue

export type CompiledCompositeValue = {
    kind: 'composite'
    type: TypeId
    possibleTypes: ReadonlyArray<TypeId>
    selections: ReadonlyArray<CompiledSelection>
}

export type CompiledField = {
    kind: 'field'
    included: boolean
    name: string
    field: string
    argumentsSignature: string
    type: SchemaTypeRef
    conditional: boolean
    forceNonNull: boolean
    overrideType?: ScalarType
    location: SourceLocation
    value: CompiledScalarValue | CompiledEnumValue | CompiledCompositeValue
}

export type CompiledTypename = {
    kind: 'typename'
    implicit?: boolean
    included: boolean
    name: string
    field: '__typename'
    argumentsSignature: ''
    conditional: boolean
    forceNonNull: boolean
    overrideType?: ScalarType
    location: SourceLocation
}

export type CompiledFragmentSpread = {
    kind: 'fragment-spread'
    included: boolean
    name: string
    sourceId: string
    sourcePath: string
    possibleTypes: ReadonlyArray<TypeId>
    conditional: boolean
    location: SourceLocation
}

export type CompiledInlineFragment = {
    kind: 'inline-fragment'
    included: boolean
    type: TypeId
    possibleTypes: ReadonlyArray<TypeId>
    selections: ReadonlyArray<CompiledSelection>
    conditional: boolean
    location: SourceLocation
}

export type CompiledSelection =
    | CompiledField
    | CompiledTypename
    | CompiledFragmentSpread
    | CompiledInlineFragment

export type CompiledVariable = {
    name: string
    type: SchemaTypeRef
    optional: boolean
    hasNonNullDefault: boolean
    value: CompiledInputValue
    location: SourceLocation
}

export type CompiledVariableUsage = {
    name: string
    location: Pick<SchemaInputValue, 'defaultValue' | 'type'>
    argumentName: string
    requiresNonNullType: boolean
    sourceLocation: SourceLocation
}

export type CompiledOperation = {
    kind: 'operation'
    operation: OperationTypeNode
    name: string
    rootType: TypeId
    variables: ReadonlyArray<CompiledVariable>
    variableUsages: ReadonlyArray<CompiledVariableUsage>
    selections: ReadonlyArray<CompiledSelection>
    location: SourceLocation
}

export type CompiledFragment = {
    kind: 'fragment'
    sourceId: string
    sourcePath: string
    name: string
    type: TypeId
    possibleTypes: ReadonlyArray<TypeId>
    variableUsages: ReadonlyArray<CompiledVariableUsage>
    selections: ReadonlyArray<CompiledSelection>
    location: SourceLocation
}

export type CompiledDefinition = CompiledOperation | CompiledFragment

export type CompiledDocument = {
    sourceId: string
    definitions: ReadonlyArray<CompiledDefinition>
}
