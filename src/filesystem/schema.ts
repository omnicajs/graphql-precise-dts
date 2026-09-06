import type { SchemaConfig } from '@/config/types'
import type { LoadedSchemaSource } from './types'

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export const loadSchemaSource = (
    root: string,
    input: SchemaConfig
): LoadedSchemaSource => {
    const contents = readFileSync(resolve(root, input.file), 'utf8')

    return {
        contents,
        fingerprint: `sha256:${createHash('sha256').update(contents).digest('hex')}`,
    }
}
