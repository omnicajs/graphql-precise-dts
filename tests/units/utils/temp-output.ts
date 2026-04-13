import { join } from 'path'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'

export const withTempOutput = async <T>(
    run: (info: { outputFile: string; tempDir: string }) => Promise<T>
): Promise<T> => {
    const tempDir = mkdtempSync(join(tmpdir(), 'graphql-precise-dts-'))
    const info = {
        outputFile: join(tempDir, 'types.d.ts'),
        tempDir,
    }

    try {
        return await run(info)
    } finally {
        rmSync(tempDir, { recursive: true, force: true })
    }
}
