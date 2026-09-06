import type { PlannedTypeImport } from '../plan/types'

import { escapeModuleSpecifier } from './syntax'

export const renderImports = (
    imports: ReadonlyArray<PlannedTypeImport>
): ReadonlyArray<string> => imports.map(
    plannedImport => `import type { ${plannedImport.names.join(', ')} } from '${
        escapeModuleSpecifier(plannedImport.source)
    }'`
)
