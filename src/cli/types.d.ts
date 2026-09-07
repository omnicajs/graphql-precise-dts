export type CliEnvironment = {
    cwd: string
    stdout: (message: string) => void
    stderr: (message: string) => void
}

export type CliOptions = {
    command: 'generate' | 'check' | 'list'
    configFile?: string
    force?: boolean
}

export type CliHelp = {
    help: string
}
