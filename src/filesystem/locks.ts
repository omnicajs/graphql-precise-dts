import { isRecord } from '@/predicates'
import { randomUUID } from 'node:crypto'
import {
    closeSync,
    mkdirSync,
    openSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs'
import { dirname } from 'node:path'
import { resolve } from 'node:path'

type ProjectLock = {
    file: string
    token: string
}

const lockFile = (directory: string, projectId: string): string => {
    const safeProjectId = /^[A-Za-z0-9._-]+$/.test(projectId)
        && projectId !== '.'
        && projectId !== '..'
        ? projectId
        : Buffer.from(projectId).toString('base64url')

    return resolve(directory, `${safeProjectId}.lock`)
}

const readLockPid = (file: string): number | undefined => {
    try {
        const value: unknown = JSON.parse(readFileSync(file, 'utf8'))
        return isRecord(value) && Number.isInteger(value.pid) && Number(value.pid) > 0
            ? Number(value.pid)
            : undefined
    } catch {
        return
    }
}

const isProcessAlive = (pid: number | undefined): boolean => {
    if (pid === undefined) return false

    try {
        process.kill(pid, 0)
        return true
    } catch (error) {
        return isRecord(error) && error.code !== 'ESRCH'
    }
}

const createLock = (directory: string, projectId: string): ProjectLock => {
    const file = lockFile(directory, projectId)
    const token = randomUUID()
    mkdirSync(dirname(file), { recursive: true })

    for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
            const descriptor = openSync(file, 'wx')
            try {
                writeFileSync(descriptor, `${JSON.stringify({ pid: process.pid, token })}\n`)
            } finally {
                closeSync(descriptor)
            }

            return { file, token }
        } catch (error) {
            if (!isRecord(error) || error.code !== 'EEXIST') throw error
            if (isProcessAlive(readLockPid(file))) {
                Object.assign(error, {
                    message: `Project "${projectId}" is locked by another generator`,
                })
                throw error
            }
            rmSync(file, { force: true })
        }
    }

    /* v8 ignore next -- @preserve requires another process to win the stale-lock recovery race twice. */
    throw new Error(`Project "${projectId}" lock could not be acquired`)
}

const releaseLock = (lock: ProjectLock): void => {
    try {
        const value: unknown = JSON.parse(readFileSync(lock.file, 'utf8'))
        if (isRecord(value) && value.token === lock.token) rmSync(lock.file, { force: true })
    } catch {
        // A replaced or already removed lock does not belong to this generator.
    }
}

export const withProjectLocks = async <T>(
    directory: string,
    projectIds: ReadonlyArray<string>,
    action: () => Promise<T>
): Promise<T> => {
    const locks: ProjectLock[] = []

    try {
        for (const projectId of [ ...new Set(projectIds) ].sort()) {
            locks.push(createLock(directory, projectId))
        }

        return await action()
    } finally {
        locks.reverse().forEach(releaseLock)
    }
}
