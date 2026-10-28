import { expect } from "vitest";
import type { LogContext } from "../../src/services/logger.js";

export type DiagnosticLevel = "warn" | "error" | "fatal";

type Diagnostic = {
  level: DiagnosticLevel;
  context: LogContext;
  message: string;
};

const diagnostics: Diagnostic[] = [];
const expectedDiagnostics: Diagnostic[] = [];

export function captureDiagnostic(level: DiagnosticLevel, context: LogContext, message: string): void {
  diagnostics.push({ level, context, message });
}

export function expectLog(level: DiagnosticLevel, message: string, context: LogContext = {}): void {
  expectedDiagnostics.push({ level, message, context });
}

export function assertNoUnexpectedLogs(): void {
  const actual = diagnostics.splice(0);
  const expected = expectedDiagnostics.splice(0);
  for (const log of expected) {
    const index = actual.findIndex(item => item.level === log.level && item.message === log.message);
    expect(index, `Expected ${log.level} diagnostic: ${log.message}`).toBeGreaterThanOrEqual(0);
    const [matched] = actual.splice(index, 1);
    expect(matched.context).toMatchObject(log.context);
  }
  const unexpected = actual.map(({ level, context, message }) => ({
    level,
    operation: context.operation,
    message,
  }));
  expect(unexpected, "Unexpected application diagnostics; assert expected failure-path logs explicitly")
    .toEqual([]);
}
