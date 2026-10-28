import { describe, expect, it } from "vitest";
import { mcpLogger } from "../src/services/logger.js";
import { assertNoUnexpectedLogs, expectLog } from "./helpers/expected-logs.js";

describe("application diagnostics during tests", () => {
  it("rejects unasserted warnings and errors", () => {
    mcpLogger.warn({ operation: "unexpected_warning" }, "Unexpected warning");
    mcpLogger.error({ operation: "unexpected_error" }, "Unexpected error");

    expect(() => assertNoUnexpectedLogs()).toThrow("Unexpected application diagnostics");
  });

  it("captures an expected failure diagnostic with its context", () => {
    mcpLogger.error({ operation: "expected_failure" }, "Expected failure");
    expectLog("error", "Expected failure", { operation: "expected_failure" });
  });

  it("rejects missing expected diagnostics", () => {
    expectLog("warn", "Missing warning");
    expect(() => assertNoUnexpectedLogs()).toThrow("Expected warn diagnostic");
  });
});
