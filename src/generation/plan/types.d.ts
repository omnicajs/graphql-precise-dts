import type { OperationTypeNode } from 'graphql'
import type { SchemaTypeRef, TypeId } from '@/schema/types'
import type {
    CompiledEnumValue,
    CompiledScalarValue,
    CompiledVariable,
} from '../model'
import type { ScalarType } from '../scalars'
import type { SourceLocation } from '../types'

export type PlannedCompositeValue = {
    kind: 'composite'
    type: TypeId
    selectionSet: PlannedSelectionSet
}

export type PlannedField = {
    kind: 'field'
    name: string
    type: SchemaTypeRef
    conditional: boolean
    overrideType?: ScalarType
    value: CompiledScalarValue | CompiledEnumValue | PlannedCompositeValue
}

export type PlannedTypename = {
    kind: 'typename'
    name: string
    conditional: boolean
    overrideType?: ScalarType
}

export type PlannedFragmentSpread = {
    kind: 'fragment-spread'
    name: string
    sourceId: string
}

export type PlannedSelection = PlannedField | PlannedTypename | PlannedFragmentSpread

export type PlannedSelectionVariant = {
    types: ReadonlyArray<TypeId>
    selections: ReadonlyArray<PlannedSelection>
}

export type PlannedSelectionSet = {
    variants: ReadonlyArray<PlannedSelectionVariant>
}

export type PlannedOperation = {
    kind: 'operation'
    operation: OperationTypeNode
    name: string
    variables: ReadonlyArray<CompiledVariable>
    selectionSet: PlannedSelectionSet
    location: SourceLocation
}

export type PlannedFragment = {
    kind: 'fragment'
    name: string
    selectionSet: PlannedSelectionSet
    location: SourceLocation
}

export type PlannedDefinition = PlannedOperation | PlannedFragment

export type PlannedTypeImport = {
    source: string
    names: ReadonlyArray<string>
    location: SourceLocation
}

export type PlannedDocument = {
    sourceId: string
    definitions: ReadonlyArray<PlannedDefinition>
    imports: ReadonlyArray<PlannedTypeImport>
}
