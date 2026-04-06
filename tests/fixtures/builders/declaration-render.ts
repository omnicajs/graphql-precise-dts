import type {
    DeclarationDefinitions,
    DefinitionNodeModel,
    FieldNodeModel,
    FieldValueModel,
    FragmentModel,
    InputFieldModel,
    InputValueModel,
    OperationModel,
} from '../../../src/types/models'
import type { OperationTypeNode } from 'graphql'

import {
    DefinitionNodeKind,
    FieldValueKind,
    FragmentRootKind,
    TypeRefKind,
} from '../../../src/enums/model-kinds'

const baseNamedType = () => ({
    kind: TypeRefKind.NAMED as const,
    name: 'Ignored',
})

export const namedType = (nullable = true) => nullable
    ? baseNamedType()
    : {
        kind: TypeRefKind.NON_NULL as const,
        ofType: baseNamedType(),
    }

const baseListType = () => ({
    kind: TypeRefKind.LIST as const,
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
    value: FieldValueModel,
    nullable = true,
    isList = false,
    directives: string[] = []
): FieldNodeModel => ({
    kind: DefinitionNodeKind.FIELD,
    name: responseName,
    responseName,
    typeRef: isList ? listType(nullable) : namedType(nullable),
    value,
    directives,
})

export const scalar = (type: string): FieldValueModel => ({
    kind: FieldValueKind.SCALAR,
    typeTs: type,
})

export const typenameValue = (...typeNames: string[]): FieldValueModel => ({
    kind: FieldValueKind.TYPENAME,
    typeNames,
})

export const enumValue = (name: string): FieldValueModel => ({
    kind: FieldValueKind.ENUM,
    name,
})

export const objectValue = (
    fields: DefinitionNodeModel[],
    typeNames?: string[]
): FieldValueModel => ({
    kind: FieldValueKind.OBJECT,
    fields,
    ...(typeNames && { typeNames }),
})

export const inputObjectValue = (fields: InputFieldModel[]): InputValueModel => ({
    kind: FieldValueKind.OBJECT,
    fields,
})

export const unionValue = (
    variants: Array<{ typeName: string; fields: DefinitionNodeModel[] }>
): FieldValueModel => ({
    kind: FieldValueKind.UNION,
    variants,
})

export const fragment = (
    fields: DefinitionNodeModel[],
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
    value: InputValueModel,
    nullable = true,
    isList = false
): InputFieldModel => ({
    name,
    typeRef: isList ? listType(nullable) : namedType(nullable),
    value,
})

export const operation = (
    operationType: OperationTypeNode,
    result: DefinitionNodeModel[],
    variables: InputFieldModel[] = [],
    onType = 'Query'
): OperationModel => ({
    operationType,
    onType,
    result,
    variables,
})

export const declarationDefinitions = (
    fragments: DeclarationDefinitions['fragments'],
    operations: DeclarationDefinitions['operations'] = new Map()
): DeclarationDefinitions => ({
    fragments,
    operations,
})
