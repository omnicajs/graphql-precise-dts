import type {
    OperationType,
    SchemaDirective,
    SchemaField,
    SchemaInputType,
    SchemaOutputType,
    SchemaType,
    TypeId,
} from '@/schema/types'
import type { SchemaSnapshot } from './types'
import type { SchemaView } from '@/schema/view'

export class SnapshotSchemaView implements SchemaView {
    private readonly types: ReadonlyMap<TypeId, SchemaType>

    public constructor(private readonly snapshot: SchemaSnapshot) {
        this.types = new Map(snapshot.types.map(type => [ type.id, type ]))
    }

    public getRootType(operation: OperationType): TypeId | undefined {
        return this.snapshot.rootTypes[operation]
    }

    public hasType(type: TypeId): boolean {
        return this.types.has(type)
    }

    public getType(type: TypeId): SchemaType {
        return this.types.get(type)!
    }

    public getInputType(type: TypeId): SchemaInputType {
        return this.getType(type) as SchemaInputType
    }

    public getOutputType(type: TypeId): SchemaOutputType {
        return this.getType(type) as SchemaOutputType
    }

    public getField(type: TypeId, field: string): SchemaField | undefined {
        const schemaType = this.getType(type)
        if (schemaType.kind !== 'object' && schemaType.kind !== 'interface') return

        return schemaType.fields.find(schemaField => schemaField.name === field)
    }

    public getSubtypes(type: TypeId): ReadonlyArray<TypeId> {
        const schemaType = this.getType(type) as Extract<SchemaType, { kind: 'interface' | 'union' }>

        return schemaType.subtypes
    }

    public getDirectives(): ReadonlyArray<SchemaDirective> {
        return this.snapshot.directives
    }
}
