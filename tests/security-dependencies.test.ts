import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type Lockfile = {
  packages: Record<string, { version?: string }>;
};

const lockfile: Lockfile = JSON.parse(
  readFileSync(new URL("../package-lock.json", import.meta.url), "utf8")
);

// Fixed versions in the currently selected major branches. Revisit the upstream
// advisories when changing major branches; a higher major alone is not proof.
// https://github.com/ljharb/qs/security/advisories/GHSA-6pq8-jhm2-2vcw
// https://github.com/fastify/fast-uri/security/advisories/GHSA-w74x-v6f9-j3xg
// https://github.com/fastify/fast-uri/security/advisories/GHSA-xhq7-xmqj-769h
// https://github.com/fastify/fast-uri/security/advisories/GHSA-wjr9-j795-jxcr
// https://github.com/fastify/fast-uri/security/advisories/GHSA-333x-w4r6-6crp
// https://github.com/expressjs/body-parser/security/advisories/GHSA-27r3-jxmh-p828
// https://github.com/beaugunderson/ip-address/security/advisories/GHSA-rxp7-6hxx-x8q5
const fixes = [
  { name: "qs", minimum: [6, 16, 1] },
  { name: "fast-uri", minimum: [3, 1, 9] },
  { name: "body-parser", minimum: [2, 4, 0] },
  { name: "ip-address", minimum: [10, 7, 4] },
];

describe("October 28 runtime dependency remediation", () => {
  it.each(fixes)("keeps every locked and installed $name copy patched", ({ name, minimum }) => {
    const copies = Object.entries(lockfile.packages).filter(([path]) =>
      path.endsWith(`node_modules/${name}`)
    );
    expect(copies.length).toBeGreaterThan(0);

    for (const [path, entry] of copies) {
      const version = entry.version ?? "";
      expect(version, path).toMatch(/^\d+\.\d+\.\d+$/);
      const [major, minor, patch] = version.split(".").map(Number);
      expect(major, path).toBe(minimum[0]);
      expect(
        minor > minimum[1] || (minor === minimum[1] && patch >= minimum[2]),
        `${path}@${version} must be at least ${minimum.join(".")} in this major branch`
      ).toBe(true);

      const installed = JSON.parse(
        readFileSync(new URL(`../${path}/package.json`, import.meta.url), "utf8")
      );
      expect(installed.version, `${path} installed version`).toBe(version);
    }
  });
});
