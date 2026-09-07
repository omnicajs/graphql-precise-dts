import type { Config } from '@/config/types'
import type { GenerateDeclarationsOptions, GenerateDeclarationsResult } from '@/types'

import { validateConfig } from '@/config/validate'
import { publishDeclarationTrees } from '@/filesystem/publish'
import { withProjectLocks } from '@/filesystem/locks'
import { createDeclarationPlan } from '@/plan'

export const generateDeclarations = (
    config: Config,
    options: GenerateDeclarationsOptions = {}
): Promise<GenerateDeclarationsResult> => {
    validateConfig(config)

    return withProjectLocks(
        config.root,
        Object.keys(config.projects),
        async () => {
            const plan = await createDeclarationPlan(config, { writeCache: true })

            if (!plan.result.diagnostics.some(diagnostic => diagnostic.severity === 'error')) {
                publishDeclarationTrees(config.root, plan.trees, options.force === true)
            }

            return plan.result
        }
    )
}
