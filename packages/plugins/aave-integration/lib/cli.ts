export interface ParsedArgs {
  [key: string]: string | boolean | undefined;
}

export function parseFlags(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      parsed[key] = true;
      continue;
    }
    parsed[key] = next;
    i += 1;
  }
  return parsed;
}

export function getStringArg(parsed: ParsedArgs, key: string, required = true): string {
  const value = parsed[key];
  if (typeof value === 'string') return value;
  if (required) {
    throw new Error(`Missing required argument --${key}`);
  }
  return '';
}

export function getOptionalStringArg(parsed: ParsedArgs, key: string): string | undefined {
  const value = parsed[key];
  return typeof value === 'string' ? value : undefined;
}

export function getOptionalBooleanArg(parsed: ParsedArgs, key: string): boolean {
  return parsed[key] === true;
}
