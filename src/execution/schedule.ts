import type { ExecutionConfig } from '@/config/types'

const workerCount = (bundleCount: number, execution?: ExecutionConfig): number => (
    execution?.mode === 'parallel'
        ? Math.min(bundleCount, execution.maxWorkers)
        : Math.min(bundleCount, 1)
)

export const scheduleBundles = async <TBundle, TResult>(
    bundles: ReadonlyArray<TBundle>,
    execution: ExecutionConfig | undefined,
    execute: (bundle: TBundle) => TResult | Promise<TResult>
): Promise<ReadonlyArray<TResult>> => {
    const results = new Array<TResult>(bundles.length)
    let nextBundle = 0

    const run = async (): Promise<void> => {
        while (nextBundle < bundles.length) {
            const bundleIndex = nextBundle
            nextBundle += 1
            results[bundleIndex] = await execute(bundles[bundleIndex]!)
        }
    }

    await Promise.all(Array.from(
        { length: workerCount(bundles.length, execution) },
        run
    ))

    return results
}
