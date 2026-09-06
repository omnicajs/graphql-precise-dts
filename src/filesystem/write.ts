import { randomUUID } from 'node:crypto'
import {
    existsSync,
    mkdirSync,
    readFileSync,
    renameSync,
    rmSync,
    writeFileSync,
} from 'node:fs'
import { dirname } from 'node:path'

export const writeAtomically = (file: string, content: string): void => {
    if (existsSync(file) && readFileSync(file, 'utf8') === content) return

    mkdirSync(dirname(file), { recursive: true })
    const temporaryFile = `${file}.${process.pid}.${randomUUID()}.tmp`

    try {
        writeFileSync(temporaryFile, content)
        renameSync(temporaryFile, file)
    } finally {
        rmSync(temporaryFile, { force: true })
    }
}
