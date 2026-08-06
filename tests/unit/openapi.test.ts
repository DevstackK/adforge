import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

type Operation = "delete" | "get" | "patch" | "post" | "put";

const operations = new Set<Operation>([
  "delete",
  "get",
  "patch",
  "post",
  "put",
]);

function routeFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return routeFiles(path);
    return entry.name === "route.ts" ? [path] : [];
  });
}

function implementedOperations(apiRoot: string) {
  return routeFiles(apiRoot).flatMap((file) => {
    const source = readFileSync(file, "utf8");
    const routeDirectory = relative(apiRoot, dirname(file));
    const path =
      routeDirectory === ""
        ? "/"
        : `/${routeDirectory
            .split(sep)
            .map((segment) => segment.replace(/^\[(.+)]$/, "{$1}"))
            .join("/")}`;
    return [
      ...source.matchAll(
        /export\s+(?:async\s+)?function\s+(GET|POST|PATCH|PUT|DELETE)\b/g,
      ),
    ].map((match) => `${match[1]!.toLowerCase()} ${path}`);
  });
}

function documentedOperations(spec: Record<string, unknown>) {
  const paths = spec.paths as Record<string, Record<string, unknown>>;
  return Object.entries(paths).flatMap(([path, pathItem]) =>
    Object.keys(pathItem)
      .filter((method): method is Operation =>
        operations.has(method as Operation),
      )
      .map((method) => `${method} ${path}`),
  );
}

function localReferences(spec: Record<string, unknown>) {
  const references: string[] = [];
  JSON.stringify(spec, (key, value: unknown) => {
    if (key === "$ref" && typeof value === "string" && value.startsWith("#/"))
      references.push(value);
    return value;
  });
  return references;
}

function resolveReference(spec: Record<string, unknown>, reference: string) {
  let current: unknown = spec;
  for (const encodedPart of reference.slice(2).split("/")) {
    const part = encodedPart.replaceAll("~1", "/").replaceAll("~0", "~");
    current = (current as Record<string, unknown> | undefined)?.[part];
  }
  return current;
}

describe("OpenAPI contract", () => {
  const root = process.cwd();
  const apiRoot = join(root, "src/app/api/v1");
  const spec = JSON.parse(
    readFileSync(join(root, "docs/openapi.json"), "utf8"),
  ) as Record<string, unknown>;

  it("documents every implemented API operation and no stale operations", () => {
    expect(documentedOperations(spec).sort()).toEqual(
      implementedOperations(apiRoot).sort(),
    );
  });

  it("resolves every local schema reference", () => {
    const unresolved = localReferences(spec).filter(
      (reference) => resolveReference(spec, reference) === undefined,
    );
    expect(unresolved).toEqual([]);
  });
});
