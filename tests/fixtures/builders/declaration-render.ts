import type { TsType } from '../../../src'
import {
    CollectedDocumentModels,
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
    FRAGMENT_ROOT_KIND,
    SELECTION_MODEL_KIND,
    TYPE_REF_KIND,
    VALUE_MODEL_KIND,
} from '../../../src/models/kinds'

const baseNamedType = (): Extract<TypeRef, { kind: typeof TYPE_REF_KIND.NAMED }> => ({
    kind: TYPE_REF_KIND.NAMED,
    name: 'Ignored',
})

export const namedType = (nullable = true) => nullable
    ? baseNamedType()
    : {
        kind: TYPE_REF_KIND.NON_NULL,
        ofType: baseNamedType(),
    }

const baseListType = (): Extract<TypeRef, { kind: typeof TYPE_REF_KIND.LIST }> => ({
    kind: TYPE_REF_KIND.LIST,
    ofType: namedType(false),
})

export const listType = (nullable = true) => nullable
    ? baseListType()
    : {
        kind: TYPE_REF_KIND.NON_NULL,
        ofType: baseListType(),
    }

export const field = (
    responseName: string,
    value: FieldValue,
    nullable = true,
    isList = false,
    directives: string[] = []
): FieldSelectionModel => ({
    kind: SELECTION_MODEL_KIND.FIELD,
    name: responseName,
    responseName,
    argumentsSignature: '',
    conditional: false,
    typeRef: isList ? listType(nullable) : namedType(nullable),
    value,
    directives,
})

export const scalar = (typeTs: TsType): Extract<FieldValue, { kind: typeof VALUE_MODEL_KIND.SCALAR }> => ({
    kind: VALUE_MODEL_KIND.SCALAR,
    typeTs,
})

export const typenameValue = (...typeNames: string[]): FieldValue => ({
    kind: VALUE_MODEL_KIND.TYPENAME,
    typeNames,
})

export const enumValue = (name: string): FieldValue => ({
    kind: VALUE_MODEL_KIND.ENUM,
    name,
})

export const objectValue = (
    fields: SelectionModel[],
    typeNames?: string[]
): Extract<FieldValue, { kind: typeof VALUE_MODEL_KIND.OBJECT }> => ({
    kind: VALUE_MODEL_KIND.OBJECT,
    fields,
    ...(typeNames && { typeNames }),
})

export const inputObjectValue = (
    fields: InputField[],
    typeName?: string,
    isRecursiveReference = false
): Extract<InputValue, { kind: typeof VALUE_MODEL_KIND.OBJECT }> => ({
    kind: VALUE_MODEL_KIND.OBJECT,
    fields,
    ...(typeName && { typeName }),
    ...(isRecursiveReference ? { isRecursiveReference } : {}),
})

export const unionValue = (
    variants: Array<{ typeName: string; fields: SelectionModel[] }>
): FieldValue => ({
    kind: VALUE_MODEL_KIND.UNION,
    variants,
})

export const fragment = (
    fields: SelectionModel[],
    onType: string
): FragmentModel => ({
    onType,
    root: {
        kind: FRAGMENT_ROOT_KIND.OBJECT,
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
): CollectedDocumentModels => ({
    fragments,
    operations,
})
