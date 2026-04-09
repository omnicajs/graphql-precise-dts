import {
    DocumentModels,
    FieldSelectionModel,
    FieldValue,
    FragmentModel,
    InputField,
    InputValue,
    OperationModel,
} from '../../../src/models/types'
import type { OperationTypeNode } from 'graphql'
import type {
    SelectionModel,
    TypeRef,
} from '../../../src/models/types'

import {
    FragmentRootKind,
    SelectionModelKind,
    TypeRefKind,
    ValueModelKind,
} from '../../../src/models/kinds'

const baseNamedType = (): Extract<TypeRef, { kind: TypeRefKind.NAMED }> => ({
    kind: TypeRefKind.NAMED,
    name: 'Ignored',
})

export const namedType = (nullable = true) => nullable
    ? baseNamedType()
    : {
        kind: TypeRefKind.NON_NULL as const,
        ofType: baseNamedType(),
    }

const baseListType = (): Extract<TypeRef, { kind: TypeRefKind.LIST }> => ({
    kind: TypeRefKind.LIST,
    ofType: namedType(false),
})

export const listType = (nullable = true) => nullable
    ? baseListType()
    : {
        kind: TypeRefKind.NON_NULL as const,
        ofType: baseListType(),
    }

export const field = (
    responseName: string,
    value: FieldValue,
    nullable = true,
    isList = false,
    directives: string[] = []
): Extract<FieldSelectionModel, { kind: SelectionModelKind.FIELD }> => ({
    kind: SelectionModelKind.FIELD,
    name: responseName,
    responseName,
    typeRef: isList ? listType(nullable) : namedType(nullable),
    value,
    directives,
})

export const scalar = (type: string): Extract<FieldValue, { kind: ValueModelKind.SCALAR }> => ({
    kind: ValueModelKind.SCALAR,
    typeTs: type,
})

export const typenameValue = (...typeNames: string[]): FieldValue => ({
    kind: ValueModelKind.TYPENAME,
    typeNames,
})

export const enumValue = (name: string): FieldValue => ({
    kind: ValueModelKind.ENUM,
    name,
})

export const objectValue = (
    fields: SelectionModel[],
    typeNames?: string[]
): Extract<FieldValue, { kind: ValueModelKind.OBJECT }> => ({
    kind: ValueModelKind.OBJECT,
    fields,
    ...(typeNames && { typeNames }),
})

export const inputObjectValue = (
    fields: InputField[]
): Extract<InputValue, { kind: ValueModelKind.OBJECT }> => ({
    kind: ValueModelKind.OBJECT,
    fields,
})

export const unionValue = (
    variants: Array<{ typeName: string; fields: SelectionModel[] }>
): FieldValue => ({
    kind: ValueModelKind.UNION,
    variants,
})

export const fragment = (
    fields: SelectionModel[],
    onType: string
): FragmentModel => ({
    onType,
    root: {
        kind: FragmentRootKind.OBJECT,
        fields,
    },
})

export const inputField = (
    name: string,
    value: InputValue,
    nullable = true,
    isList = false,
    optional = nullable
): InputField => ({
    name,
    typeRef: isList ? listType(nullable) : namedType(nullable),
    optional,
    value,
})

export const operation = (
    operationType: OperationTypeNode,
    result: SelectionModel[],
    variables: InputField[] = [],
    onType = 'Query'
): OperationModel => ({
    operationType,
    onType,
    result,
    variables,
})

export const declarationDefinitions = (
    fragments: Map<string, FragmentModel>,
    operations: Map<string, OperationModel> = new Map()
): DocumentModels => ({
    fragments,
    operations,
})
