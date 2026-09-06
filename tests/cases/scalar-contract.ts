import {
    arrayOf,
    defineBoolean,
    defineGeneric,
    defineLiteral,
    defineNamed,
    defineNumber,
    defineObject,
    defineObjectField,
    defineString,
    defineTuple,
    defineUnknown,
    intersectionOf,
    makeNullable,
    unionOf,
} from '@/index'

export const richScalars = {
    Timestamp: {
        input: defineObject({
            metadata: defineObjectField(defineGeneric(
                'Readonly',
                defineObject({
                    enabled: defineObjectField(defineBoolean()),
                    fallback: defineObjectField(defineNamed('unknown'), true),
                    'source-id': defineObjectField(defineString()),
                    value: defineObjectField(defineUnknown(), true),
                })
            )),
            range: defineObjectField(defineTuple(
                defineNumber(),
                makeNullable(makeNullable(defineNumber()))
            )),
            tags: defineObjectField(arrayOf(makeNullable(defineString())), true),
        }),
        output: intersectionOf(
            defineGeneric(
                'Readonly',
                defineObject({
                    epoch: defineObjectField(defineNumber()),
                    iso: defineObjectField(defineString()),
                })
            ),
            intersectionOf(
                defineObject({
                    kind: defineObjectField(defineLiteral('timestamp')),
                    precision: defineObjectField(defineLiteral(3)),
                    verified: defineObjectField(defineLiteral(true)),
                }),
                defineObject({
                    kind: defineObjectField(defineLiteral('timestamp')),
                    precision: defineObjectField(defineLiteral(3)),
                    verified: defineObjectField(defineLiteral(true)),
                })
            ),
            unionOf(
                defineObject({
                    timezone: defineObjectField(defineLiteral('utc')),
                }),
                defineObject({
                    timezone: defineObjectField(defineLiteral('local')),
                })
            )
        ),
    },
}
