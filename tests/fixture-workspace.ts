import {
    cpSync,
    mkdtempSync,
    readFileSync,
    rmSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import {
    join,
    resolve,
} from 'node:path'

const fixturesRoot = resolve(__dirname, 'fixtures/cases')

export const createFixtureWorkspace = () => {
    const temporaryRoot = mkdtempSync(join(tmpdir(), 'graphql-precise-dts-fixtures-'))
    const root = resolve(temporaryRoot, 'cases')
    cpSync(fixturesRoot, root, { recursive: true })

    return {
        root,
        readFixture: (path: string): string => readFileSync(resolve(fixturesRoot, path), 'utf8'),
        dispose: (): void => rmSync(temporaryRoot, { force: true, recursive: true }),
    }
}
