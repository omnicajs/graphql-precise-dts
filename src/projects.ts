import type { Config } from '@/config/types'

import { validateConfig } from '@/config/validate'

export const listProjects = (config: Config): ReadonlyArray<string> => {
    validateConfig(config)

    return Object.keys(config.projects).sort()
}
