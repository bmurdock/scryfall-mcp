import { afterEach, beforeEach, vi } from "vitest";
import { MCPLogger, type LogContext } from "../src/services/logger.js";
import { assertNoUnexpectedLogs, captureDiagnostic } from "./helpers/expected-logs.js";

let restoreDiagnostics: Array<() => void> = [];

beforeEach(() => {
  restoreDiagnostics = [];
  for (const level of ["warn", "error", "fatal"] as const) {
    const spy = vi.spyOn(MCPLogger.prototype, level).mockImplementation((context: LogContext, message: string) => {
      captureDiagnostic(level, context, message);
    });
    restoreDiagnostics.push(() => spy.mockRestore());
  }
});

afterEach(() => {
  try {
    assertNoUnexpectedLogs();
  } finally {
    restoreDiagnostics.forEach(restore => restore());
  }
});
