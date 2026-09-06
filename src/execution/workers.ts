/* v8 ignore file -- @preserve exercised through the built package worker smoke scenario. */

import { Worker } from 'node:worker_threads'

type WorkerRequest<TBundle> = {
    index: number
    bundle: TBundle
}

type WorkerResponse<TResult> = {
    index: number
    result?: TResult
    error?: {
        name: string
        message: string
        stack?: string
    }
}

const workerError = (error: NonNullable<WorkerResponse<unknown>['error']>): Error => {
    const created = new Error(error.message)
    created.name = error.name
    created.stack = error.stack

    return created
}

export const scheduleWorkers = <TBundle, TResult, TState>({
    bundles,
    maxWorkers,
    runtime,
    state,
}: {
    bundles: ReadonlyArray<TBundle>
    maxWorkers: number
    runtime: string
    state: TState
}): Promise<ReadonlyArray<TResult>> => new Promise((resolve, reject) => {
        if (!bundles.length) {
            resolve([])
            return
        }

        const results = new Array<TResult>(bundles.length)
        const workers: Worker[] = []
        let completedBundles = 0
        let nextBundle = 0
        let settled = false

        const terminate = (): void => {
            for (const worker of workers) void worker.terminate()
        }
        const fail = (error: unknown): void => {
            if (settled) return
            settled = true
            terminate()
            reject(error)
        }
        const schedule = (worker: Worker): void => {
            if (nextBundle >= bundles.length) return

            const index = nextBundle
            nextBundle += 1
            worker.postMessage({ index, bundle: bundles[index]! } satisfies WorkerRequest<TBundle>)
        }

        for (let index = 0; index < Math.min(maxWorkers, bundles.length); index += 1) {
            const worker = new Worker(runtime, { workerData: state })
            workers.push(worker)
            worker.on('message', (message: WorkerResponse<TResult>) => {
                if (settled) return
                if (message.error) {
                    fail(workerError(message.error))
                    return
                }
                if (message.result === undefined) {
                    fail(new Error('Generation worker returned an empty result'))
                    return
                }

                results[message.index] = message.result
                completedBundles += 1
                if (completedBundles === bundles.length) {
                    settled = true
                    terminate()
                    resolve(results)
                    return
                }
                schedule(worker)
            })
            worker.on('error', fail)
            worker.on('exit', code => {
                if (!settled) {
                    fail(new Error(`Generation worker exited with code ${code}`))
                }
            })
            schedule(worker)
        }
    })
