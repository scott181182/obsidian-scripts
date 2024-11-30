

export class CustomError extends Error {}

export class CommandNotFoundError extends CustomError {
    public constructor(
        public readonly command: string
    ) {
        super(`Command not found: ${command}`)
    }
}