import type {
    DirectivePolicy,
    FieldDirectivePolicy,
    SharedDirectivePolicy,
} from '@/config/types'
import type {
    DirectiveNode,
    SelectionNode,
} from 'graphql'
import type { CompilationContext } from './context'
import type { VariableScope } from './variables'

import { validateInputArguments } from './arguments'
import { getSourceLocation } from './diagnostics/location'
import { invalidDocument } from './errors'
import { Kind } from 'graphql'
import { renderType } from './render/type'

export type SelectionState = {
    included: boolean
    conditional: boolean
    forceNonNull: boolean
    overrideType?: string
}

type SelectionKind = 'field' | 'fragmentSpread' | 'inlineFragment'

const getSelectionKind = (selection: SelectionNode): SelectionKind => {
    switch (selection.kind) {
        case Kind.FIELD:
            return 'field'
        case Kind.FRAGMENT_SPREAD:
            return 'fragmentSpread'
        case Kind.INLINE_FRAGMENT:
            return 'inlineFragment'
    }
}

const getDirectiveLocation = (selection: SelectionNode): string => getSelectionKind(selection)
    .replace(/[A-Z]/g, character => `_${character}`)
    .toUpperCase()

const getPolicy = (
    policy: DirectivePolicy | undefined,
    kind: SelectionKind
): FieldDirectivePolicy | SharedDirectivePolicy | undefined => {
    if (!policy) return
    if ('effect' in policy) return kind === 'field' || [
        'conditional',
        'ignore',
        'warn',
    ].includes(policy.effect) ? policy : undefined

    return policy[kind]
}

const getBooleanIfValue = (directive: DirectiveNode): boolean | undefined => {
    const value = directive.arguments?.find(argument => argument.name.value === 'if')?.value

    return value?.kind === Kind.BOOLEAN ? value.value : undefined
}

export const compileSelectionState = (
    selection: SelectionNode,
    context: CompilationContext,
    variables: VariableScope
): SelectionState => {
    const state: SelectionState = {
        included: true,
        conditional: false,
        forceNonNull: false,
    }
    const appliedDirectives = new Set<string>()

    for (const directive of selection.directives!) {
        const name = directive.name.value
        const schemaDirective = context.schema.getDirectives().find(candidate => candidate.name === name)
        if (!schemaDirective) return invalidDocument(`Directive "@${name}" is not defined`, directive)
        if (!schemaDirective.repeatable && appliedDirectives.has(name)) {
            return invalidDocument(`Directive "@${name}" is used more than once at this location`, directive)
        }
        appliedDirectives.add(name)
        if (!schemaDirective.locations.includes(getDirectiveLocation(selection))) {
            return invalidDocument(
                `Directive "@${name}" cannot be used on ${getDirectiveLocation(selection)}`,
                directive
            )
        }

        validateInputArguments(
            directive.arguments!,
            schemaDirective.arguments,
            variables,
            context,
            `Directive "@${name}"`,
            directive
        )

        const ifValue = getBooleanIfValue(directive)
        if ((name === 'include' && ifValue === false) || (name === 'skip' && ifValue === true)) {
            state.included = false
            continue
        }
        if ((name === 'include' || name === 'skip') && ifValue === undefined) {
            state.conditional = true
            continue
        }

        const policy = getPolicy(context.directives[name], getSelectionKind(selection))
        if (!policy || policy.effect === 'ignore') continue
        if (policy.effect === 'conditional') {
            state.conditional = true
            continue
        }
        if (policy.effect === 'nonnull') {
            state.forceNonNull = true
            continue
        }
        if (policy.effect === 'override') {
            state.overrideType = renderType(policy.type)
            continue
        }

        context.reportDiagnostic({
            severity: 'warning',
            code: 'directive-warning',
            sourceId: context.sourceId,
            location: getSourceLocation(directive),
            message: policy.message ?? `Directive "@${name}" requires manual review`,
        })
    }

    return state
}
