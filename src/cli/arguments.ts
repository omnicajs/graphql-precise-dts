import type {
    CliHelp,
    CliOptions,
} from './types'
import type { ArgumentsCamelCase } from 'yargs'

import yargs from 'yargs'

type ParsedArguments = ArgumentsCamelCase<{
    config?: string
    help?: boolean
    force?: boolean
}>

const createParser = () => yargs()
    .scriptName('graphql-precise-dts')
    .usage('$0 <command> [options]')
    .command('generate', 'Generate and publish declaration files', parser => parser.option('force', {
        description: 'Overwrite planned outputs, remove stale owned files, and warn about undeclared files',
        type: 'boolean',
        default: false,
    }))
    .command('check', 'Check declaration files without writing')
    .command('list', 'List configured project IDs')
    .option('config', {
        description: 'Use an explicit configuration file',
        requiresArg: true,
        type: 'string',
    })
    .check(arguments_ => (
        Array.isArray(arguments_.config)
            ? 'Option --config may only be used once'
            : true
    ))
    .strictCommands()
    .strictOptions()
    .demandCommand(1)
    .help()
    .version(false)
    .exitProcess(false)
    .showHelpOnFail(false)

export const parseArguments = (
    arguments_: ReadonlyArray<string>
): Promise<CliHelp | CliOptions> => new Promise((resolve, reject) => {
    const parserArguments = arguments_.length ? [...arguments_] : ['--help']

    createParser().parse(parserArguments, {}, (error, parsedArguments, output) => {
        if (error) {
            reject(error)
            return
        }

        const options = parsedArguments as ParsedArguments
        if (options.help) {
            resolve({ help: `${output}\n` })
            return
        }

        resolve({
            command: options._[0] as CliOptions['command'],
            configFile: options.config,
            force: options.force,
        })
    })
})
