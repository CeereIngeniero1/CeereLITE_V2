import { appendFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';

const LOG_FILE = join(__dirname, '..', '..', 'logs', 'errores-ejecucion.txt');

export type ExecutionErrorEntry = {
  method?: string;
  url?: string;
  status?: number;
  message: string;
  sqlNumber?: number;
  context?: string;
  stack?: string;
};

const STACK_MAX_LINES = 20;

export function errorStack(
  err: unknown,
  maxLines = STACK_MAX_LINES,
): string | undefined {
  if (!(err instanceof Error) || !err.stack) return undefined;
  const lines = err.stack.split('\n').slice(0, maxLines);
  return lines.join('\n');
}

export function sqlErrorNumber(err: unknown): number | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const rec = err as Record<string, unknown>;
  const driver = rec.driverError as Record<string, unknown> | undefined;
  const original = rec.originalError as Record<string, unknown> | undefined;
  const info = original?.info as Record<string, unknown> | undefined;
  const n = rec.number ?? driver?.number ?? original?.number ?? info?.number;
  const num = Number(n);
  return Number.isFinite(num) ? num : undefined;
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return 'Error desconocido';
  }
}

export function isMissingDocumentoCambioCita(err: unknown): boolean {
  if (sqlErrorNumber(err) === 207) {
    return /DocumentoCambioCita/i.test(errorMessage(err));
  }
  return /Invalid column name ['"]DocumentoCambioCita['"]/i.test(
    errorMessage(err),
  );
}

export function logExecutionError(entry: ExecutionErrorEntry): void {
  try {
    mkdirSync(dirname(LOG_FILE), { recursive: true });
    const lines = [
      `==== ${new Date().toISOString()} ====`,
      entry.method || entry.url
        ? `${entry.method ?? ''} ${entry.url ?? ''}`.trim()
        : null,
      entry.status != null ? `status: ${entry.status}` : null,
      `message: ${entry.message}`,
      entry.sqlNumber != null ? `sqlNumber: ${entry.sqlNumber}` : null,
      entry.context ? `context: ${entry.context}` : null,
      entry.stack ? `stack:\n${entry.stack}` : null,
      '',
    ].filter((l) => l != null);
    appendFileSync(LOG_FILE, `${lines.join('\n')}\n`, 'utf8');
  } catch {
    /* el log no debe tumbar la petición */
  }
}
