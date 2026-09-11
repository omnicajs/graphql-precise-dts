import {
    GraphQLSchema,
    SchemaMetaFieldDef,
    TypeMetaFieldDef,
    introspectionTypes,
} from 'graphql'
import { GraphQLSchemaView, toSchemaField } from './graphql'

// These definitions are supplied by GraphQL even when they are absent from SDL.
// Keep them outside user snapshots and generated schema support declarations.
const schema = new GraphQLSchemaView(new GraphQLSchema({}))

export const introspectionTypeMap = new Map(introspectionTypes.map(type => [
    type.name,
    schema.getType(type.name),
]))

export const introspectionFields = new Map([SchemaMetaFieldDef, TypeMetaFieldDef].map(field => [
    field.name,
    toSchemaField(field),
]))
