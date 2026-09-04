import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { inspectContent, validateContent } from "../scripts/validate-content.mjs";

const temporaryRoots: string[] = [];

function fixture(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "spectator-content-"));
  temporaryRoots.push(root);
  for (const [path, content] of Object.entries(files)) {
    const target = join(root, path);
    mkdirSync(join(target, ".."), { recursive: true });
    writeFileSync(target, content);
  }
  return root;
}

function validFixture(): Record<string, string> {
  return {
    "spectator.config.ts": 'link: "/"\nlink: "/proposal"\n',
    "docs/index.md": "# Home\n\n[Proposal](/proposal#decision)\n",
    "docs/proposal.md": "# Proposal\n\n## Decision\n\n![Diagram](/images/diagram.svg)\n",
    "docs/public/images/diagram.svg": "<svg/>",
    "docs/public/images/IMAGES.md": "# Images\n",
  };
}

afterEach(() => {
  while (temporaryRoots.length) {
    rmSync(temporaryRoots.pop(), { recursive: true, force: true });
  }
});

describe("content validation", () => {
  it("accepts clean routes, anchors, navigation, and images", () => {
    expect(validateContent(fixture(validFixture()))).toMatchObject({
      pages: 2,
      images: 1,
    });
  });

  it("reports broken anchors and missing navigation entries", () => {
    const files = validFixture();
    files["spectator.config.ts"] = 'link: "/"\n';
    files["docs/index.md"] = "# Home\n\n[Proposal](/proposal#missing)\n";
    const result = inspectContent(fixture(files));
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining("missing anchor /proposal#missing"),
        expect.stringContaining("page is absent from configured navigation"),
      ]),
    );
  });

  it("reports unresolved markers and missing image files", () => {
    const files = validFixture();
    const unresolvedMarker = ["__", "UNRESOLVED", "__"].join("");
    files["docs/proposal.md"] =
      `# Proposal\n\n${unresolvedMarker}\n\n![Diagram](/images/missing.svg)\n`;
    const result = inspectContent(fixture(files));
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining(`unresolved marker ${unresolvedMarker}`),
        expect.stringContaining("missing image /images/missing.svg"),
      ]),
    );
  });

  it("accepts VitePress duplicate-heading suffixes", () => {
    const files = validFixture();
    files["docs/index.md"] =
      "# Home\n\n## Repeat\n\nFirst.\n\n## Repeat\n\n[Second](/#repeat-1)\n";
    expect(validateContent(fixture(files))).toMatchObject({ pages: 2 });
  });
});
