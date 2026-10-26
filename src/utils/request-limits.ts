/** Bound JSON structure before SDK or application schema validation. */
export function isJsonStructureWithinLimit(input: unknown, maxElements = 10_000): boolean {
  const pending: unknown[] = [input];
  let elements = 0;

  while (pending.length > 0) {
    const value = pending.pop();
    if (value === null || typeof value !== "object") {
      continue;
    }

    const children: unknown[] = Array.isArray(value) ? value : Object.values(value);
    elements += children.length;
    if (elements > maxElements) {
      return false;
    }
    for (const child of children) {
      if (child !== null && typeof child === "object") {
        pending.push(child);
      }
    }
  }

  return true;
}
