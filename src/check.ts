import type { Config } from '@/config/types'
import type { CheckDeclarationsResult } from '@/types'

import { checkDeclarationTrees } from '@/filesystem/check'
import { createDeclarationPlan } from '@/plan'

export const checkDeclarations = async (config: Config): Promise<CheckDeclarationsResult> => {
    const plan = await createDeclarationPlan(config, { writeCache: false })
    const differences = plan.result.diagnostics.some(diagnostic => diagnostic.severity === 'error')
        ? []
        : checkDeclarationTrees(config.root, plan.trees)

    return { ...plan.result, differences }
}
