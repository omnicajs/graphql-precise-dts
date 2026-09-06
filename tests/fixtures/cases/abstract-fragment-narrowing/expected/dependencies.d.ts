declare module '@graphql-typed-document-node/core' {
    export interface TypedDocumentNode<
        TResult = Record<string, unknown>,
        TVariables = Record<string, unknown>,
    > {
        readonly __resultType?: TResult
        readonly __variablesType?: TVariables
    }
}
