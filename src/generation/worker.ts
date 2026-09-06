/* v8 ignore file -- @preserve executed only as the built package worker entrypoint. */

import type {
    GenerationWorkerRequest,
    GenerationWorkerResponse,
    GenerationWorkerState,
} from './worker-types'

import { generateBundle } from './bundle'
import {
    parentPort,
    workerData,
} from 'node:worker_threads'

const state = workerData as GenerationWorkerState
const fragments = new Map(state.fragments)
const port = parentPort

if (!port) throw new Error('Generation worker requires a parent port')

port.on('message', (message: GenerationWorkerRequest) => {
    let response: GenerationWorkerResponse
    try {
        response = {
            index: message.index,
            result: generateBundle(message.bundle, fragments, state.schema, state.rendering),
        }
    } catch (error) {
        const cause = error instanceof Error ? error : new Error(String(error))
        response = {
            index: message.index,
            error: {
                name: cause.name,
                message: cause.message,
                stack: cause.stack,
            },
        }
    }
    port.postMessage(response)
})
