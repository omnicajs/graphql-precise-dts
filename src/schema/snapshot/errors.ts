export class InvalidSchemaSnapshotError extends Error {
    public constructor(message: string) {
        super(message)
        this.name = 'InvalidSchemaSnapshotError'
    }
}
