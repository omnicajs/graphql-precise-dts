import type { DirectiveOverrideType } from './policy'

import { SELECTION_STATE } from './kinds'

export type ConditionalSelectionState = typeof SELECTION_STATE[keyof typeof SELECTION_STATE]

export type ResolvedStructuralDirectives = {
    directives: string[];
    forceNonNull: boolean;
    state: ConditionalSelectionState;
}

export type ResolvedGenerationDirectives = {
    directives: string[];
    overrideType?: DirectiveOverrideType;
    warnings: string[];
}
