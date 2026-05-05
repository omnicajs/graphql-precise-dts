import type { CollectedDocumentModels } from '../../../src/models/types'
import type { ConfigDirectivePolicies } from '../../../src/directives/types'
import type { CustomScalarMappings } from '../../../src/scalars/types'
import type {
    FieldSelectionModel,
    FieldValue,
    FragmentModel,
    OperationModel,
} from '../../../src/models/types'
import type { OperationTypeNode } from 'graphql'
import type { SelectionModel } from '../../../src/models/types'
import type { TsType } from '../../../src'
import type {
    TypeRef,
    VariableField,
    VariableValue,
} from '../../../src/models/types'

import { renderType } from '../../../src'

import {
    FRAGMENT_ROOT_KIND,
    SELECTION_MODEL_KIND,
    TYPE_REF_KIND,
    VALUE_MODEL_KIND,
} from '../../../src/kinds'

const baseNamedType = (): Extract<TypeRef, { kind: typeof TYPE_REF_KIND.NAMED }> => ({
    kind: TYPE_REF_KIND.NAMED,
    name: 'Ignored',
})

type FixtureScalarCollectionState = {
    customScalars: CustomScalarMappings;
    visitedFieldObjects: WeakSet<Extract<FieldValue, { kind: typeof VALUE_MODEL_KIND.OBJECT }>>;
    visitedVariableObjects: WeakSet<Extract<VariableValue, { kind: typeof VALUE_MODEL_KIND.OBJECT }>>;
}

type FixtureScalarCarrier = {
    __fixtureTypeTs?: TsType;
}

type DeclarationDefinitions = CollectedDocumentModels & {
    customScalars: CustomScalarMappings;
    directivePolicies: ConfigDirectivePolicies;
}

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

const makeFixtureScalarName = (typeTs: TsType, usage: 'input' | 'output'): string =>
    `FixtureScalar_${usage}_${renderType(typeTs).replace(/[^a-zA-Z0-9]+/g, '_')}`

export const scalar = (typeTs: TsType): Extract<FieldValue, { kind: typeof VALUE_MODEL_KIND.SCALAR }> => ({
    kind: VALUE_MODEL_KIND.SCALAR,
    name: makeFixtureScalarName(typeTs, 'output'),
    usage: 'output',
    __fixtureTypeTs: typeTs,
} as Extract<FieldValue, { kind: typeof VALUE_MODEL_KIND.SCALAR }> & FixtureScalarCarrier)

export const variableScalar = (typeTs: TsType): Extract<VariableValue, { kind: typeof VALUE_MODEL_KIND.SCALAR }> => ({
    kind: VALUE_MODEL_KIND.SCALAR,
    name: makeFixtureScalarName(typeTs, 'input'),
    usage: 'input',
    __fixtureTypeTs: typeTs,
} as Extract<VariableValue, { kind: typeof VALUE_MODEL_KIND.SCALAR }> & FixtureScalarCarrier)

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

export const variableObjectValue = (
    fields: VariableField[],
    typeName?: string,
    isRecursiveReference = false
): Extract<VariableValue, { kind: typeof VALUE_MODEL_KIND.OBJECT }> => ({
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

export const variableField = (
    name: string,
    value: VariableValue,
    nullable = true,
    isList = false,
    optional = nullable
): VariableField => ({
    name,
    typeRef: isList ? listType(nullable) : namedType(nullable),
    optional,
    value,
})

export const operation = (
    operationType: OperationTypeNode,
    result: SelectionModel[],
    variables: VariableField[] = [],
    onType = 'Query'
): OperationModel => ({
    operationType,
    onType,
    result,
    variables,
})

const collectFixtureScalarsFromFieldValue = (
    value: FieldValue,
    state: FixtureScalarCollectionState
) => {
    if (value.kind === VALUE_MODEL_KIND.SCALAR && '__fixtureTypeTs' in value && value.__fixtureTypeTs) {
        state.customScalars[value.name] = value.__fixtureTypeTs
        return
    }

    if (value.kind === VALUE_MODEL_KIND.OBJECT) {
        if (state.visitedFieldObjects.has(value)) return
        state.visitedFieldObjects.add(value)
        value.fields.forEach(selection => collectFixtureScalarsFromSelection(selection, state))
        return
    }

    if (value.kind === VALUE_MODEL_KIND.UNION) {
        value.variants.forEach(variant =>
            variant.fields.forEach(selection => collectFixtureScalarsFromSelection(selection, state))
        )
    }
}

const collectFixtureScalarsFromVariableValue = (
    value: VariableValue,
    state: FixtureScalarCollectionState
) => {
    if (value.kind === VALUE_MODEL_KIND.SCALAR && '__fixtureTypeTs' in value && value.__fixtureTypeTs) {
        state.customScalars[value.name] = value.__fixtureTypeTs
        return
    }

    if (value.kind === VALUE_MODEL_KIND.OBJECT) {
        if (state.visitedVariableObjects.has(value)) return
        state.visitedVariableObjects.add(value)
        value.fields.forEach(field => collectFixtureScalarsFromVariableValue(field.value, state))
    }
}

const collectFixtureScalarsFromSelection = (
    selection: SelectionModel,
    state: FixtureScalarCollectionState
) => {
    switch (selection.kind) {
        case SELECTION_MODEL_KIND.FIELD:
            collectFixtureScalarsFromFieldValue(selection.value, state)
            return
        case SELECTION_MODEL_KIND.INLINE_FRAGMENT:
            selection.selections.forEach(nested => collectFixtureScalarsFromSelection(nested, state))
    }
}

export const declarationDefinitions = (
    fragments: Map<string, FragmentModel>,
    operations: Map<string, OperationModel> = new Map(),
    directivePolicies: ConfigDirectivePolicies = {}
): DeclarationDefinitions => {
    const state: FixtureScalarCollectionState = {
        customScalars: {},
        visitedFieldObjects: new WeakSet(),
        visitedVariableObjects: new WeakSet(),
    }

    fragments.forEach(fragmentModel => {
        if (fragmentModel.root.kind === FRAGMENT_ROOT_KIND.UNION) {
            fragmentModel.root.variants.forEach(variant =>
                variant.fields.forEach(selection => collectFixtureScalarsFromSelection(selection, state))
            )
            return
        }

        fragmentModel.root.fields.forEach(selection => collectFixtureScalarsFromSelection(selection, state))
    })

    operations.forEach(operationModel => {
        operationModel.result.forEach(selection => collectFixtureScalarsFromSelection(selection, state))
        operationModel.variables.forEach(variable => collectFixtureScalarsFromVariableValue(variable.value, state))
    })

    return {
        fragments,
        operations,
        customScalars: state.customScalars,
        directivePolicies,
    }
}
