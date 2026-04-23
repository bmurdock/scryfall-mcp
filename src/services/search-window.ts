export function collectRequestedWindow<T>(
  pages: Array<{ data: T[]; has_more?: boolean; warnings?: string[] }>,
  relativeOffset: number,
  requiredCount: number
): { data: T[]; warnings?: string[] } {
  const data: T[] = [];
  const warningSet = new Set<string>();
  let remainingSkip = relativeOffset;
  let remainingTake = requiredCount;

  for (const page of pages) {
    page.warnings?.forEach((warning) => warningSet.add(warning));
    if (remainingTake <= 0) {
      break;
    }

    const start = Math.min(remainingSkip, page.data.length);
    remainingSkip -= start;

    for (let index = start; index < page.data.length && remainingTake > 0; index++) {
      data.push(page.data[index]);
      remainingTake--;
    }
  }

  return {
    data,
    warnings: warningSet.size > 0 ? Array.from(warningSet) : undefined,
  };
}
