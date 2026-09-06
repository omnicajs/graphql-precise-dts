import type {
    OperationType,
    SchemaDirective,
    SchemaField,
    SchemaInputType,
    SchemaOutputType,
    SchemaType,
    TypeId,
} from './types'

export interface SchemaView {
    getRootType(operation: OperationType): TypeId | undefined
    hasType(type: TypeId): boolean
    getType(type: TypeId): SchemaType
    getInputType(type: TypeId): SchemaInputType
    getOutputType(type: TypeId): SchemaOutputType
    getField(type: TypeId, field: string): SchemaField | undefined
    getSubtypes(type: TypeId): ReadonlyArray<TypeId>
    getDirectives(): ReadonlyArray<SchemaDirective>
}

export interface SchemaSnapshotSource {
    getRootType(operation: OperationType): TypeId | undefined
    getTypeIds(): ReadonlyArray<TypeId>
    getType(type: TypeId): SchemaType
    getDirectives(): ReadonlyArray<SchemaDirective>
}
