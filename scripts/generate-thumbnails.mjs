import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, "..");
const PROMPTS_PATH = join(SCRIPT_DIR, "thumbnail-prompts.json");
const OUTPUT_DIR = join(ROOT, "site", "assets", "thumbnails");
const DOC_PATH = join(ROOT, "docs", "thumbnail-prompts.md");
const spec = JSON.parse(readFileSync(PROMPTS_PATH, "utf8"));

function documentation() {
  const entries = spec.images
    .map(
      (image) => `## ${image.title}

Output: \`site/assets/thumbnails/${image.file}\`

> ${spec.style} ${image.prompt}
`,
    )
    .join("\n");
  return `# Template thumbnail prompts

Every gallery thumbnail is generated from the source of truth in
\`scripts/thumbnail-prompts.json\`.

## Generation settings

| Setting | Value |
| --- | --- |
| Provider | ${spec.provider} |
| Model | ${spec.model} |
| Deployment | ${spec.deployment} |
| Endpoint | ${spec.endpoint} |
| API version | ${spec.apiVersion} |
| Size | ${spec.size} |
| Quality | ${spec.quality} |

Generate all thumbnails:

\`\`\`powershell
$env:AOAI_TOKEN = az account get-access-token --resource https://cognitiveservices.azure.com --query accessToken -o tsv
node scripts/generate-thumbnails.mjs
\`\`\`

Pass one or more template IDs to generate only those images. Existing files are
preserved unless \`--force\` is supplied.

${entries}`;
}

function writeDocumentation() {
  mkdirSync(dirname(DOC_PATH), { recursive: true });
  writeFileSync(DOC_PATH, documentation());
  console.log(`wrote ${DOC_PATH}`);
}

function accessToken() {
  const value = process.env.AOAI_TOKEN?.trim();
  if (!value) {
    throw new Error(
      "AOAI_TOKEN is required. Get an Entra token for https://cognitiveservices.azure.com.",
    );
  }
  return value;
}

function endpoint() {
  return (process.env.AOAI_ENDPOINT || spec.endpoint).replace(/\/+$/, "");
}

function selectedImages(args) {
  const ids = new Set(args.filter((argument) => !argument.startsWith("--")));
  return ids.size
    ? spec.images.filter((image) => ids.has(image.id))
    : spec.images;
}

async function generate(image, token, force) {
  const destination = join(OUTPUT_DIR, image.file);
  if (!force && existsSync(destination)) {
    console.log(`skip ${image.file}`);
    return;
  }

  const url =
    `${endpoint()}/openai/deployments/${spec.deployment}/images/generations` +
    `?api-version=${spec.apiVersion}`;
  const prompt = `${spec.style} ${image.prompt}`;
  const body = JSON.stringify({
    prompt,
    size: spec.size,
    n: 1,
    quality: spec.quality,
  });

  for (let attempt = 1; attempt <= 3; attempt++) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body,
    });
    if (response.ok) {
      const payload = await response.json();
      const encoded = payload.data?.[0]?.b64_json;
      if (!encoded) throw new Error(`${image.id}: response contained no image`);
      const bytes = Buffer.from(encoded, "base64");
      writeFileSync(destination, bytes);
      console.log(`wrote ${image.file} (${Math.round(bytes.length / 1024)} KB)`);
      return;
    }

    const message = (await response.text()).slice(0, 300);
    if ((response.status === 429 || response.status >= 500) && attempt < 3) {
      const delay = attempt * 5000;
      console.log(`${image.id}: HTTP ${response.status}, retrying in ${delay} ms`);
      await new Promise((resolveDelay) => setTimeout(resolveDelay, delay));
      continue;
    }
    throw new Error(`${image.id}: HTTP ${response.status}: ${message}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  writeDocumentation();
  if (args.includes("--docs-only")) return;
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const token = accessToken();
  const images = selectedImages(args);
  if (!images.length) {
    throw new Error("No thumbnail IDs matched the prompt catalog.");
  }
  for (const image of images) {
    await generate(image, token, args.includes("--force"));
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 1500));
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
