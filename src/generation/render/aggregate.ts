import type { GeneratedDeclarationOutput } from '@/generation/types'

export const renderAggregate = (
    outputs: ReadonlyArray<GeneratedDeclarationOutput>
): string => `${outputs.map(output => (output.aggregateContent ?? output.content).trimEnd()).join('\n\n')}\n`
