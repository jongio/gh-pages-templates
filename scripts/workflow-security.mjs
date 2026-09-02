import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { parseDocument } from "yaml";

const ACTION_SHA = /^[a-f0-9]{40}$/;
const ALLOWED_ACTIONS = new Set([
  "actions/checkout",
  "actions/configure-pages",
  "actions/deploy-pages",
  "actions/jekyll-build-pages",
  "actions/setup-node",
  "actions/upload-pages-artifact",
  "ruby/setup-ruby",
]);
const ALLOWED_TRIGGERS = new Set(["push", "workflow_dispatch"]);
const ALLOWED_PERMISSIONS = new Map([
  ["contents", new Set(["read"])],
  ["pages", new Set(["read", "write"])],
  ["id-token", new Set(["write"])],
]);
const ALLOWED_RUN_COMMANDS = new Set([
  "node scripts/build-site.mjs",
  "npm ci --ignore-scripts --no-audit --no-fund",
  "npm run build",
]);
const ALLOWED_BUILD_SEQUENCES = new Set([
  JSON.stringify([
    "uses:actions/checkout",
    "uses:actions/configure-pages",
    "uses:actions/upload-pages-artifact",
  ]),
  JSON.stringify([
    "uses:actions/checkout",
    "uses:actions/configure-pages",
    "uses:actions/jekyll-build-pages",
    "uses:actions/upload-pages-artifact",
  ]),
  JSON.stringify([
    "uses:actions/checkout",
    "uses:actions/setup-node",
    "run:npm ci --ignore-scripts --no-audit --no-fund",
    "run:npm run build",
    "uses:actions/configure-pages",
    "uses:actions/upload-pages-artifact",
  ]),
  JSON.stringify([
    "uses:actions/checkout",
    "uses:actions/setup-node",
    "run:npm ci --ignore-scripts --no-audit --no-fund",
    "uses:ruby/setup-ruby",
    "uses:actions/configure-pages",
    "run:node scripts/build-site.mjs",
    "uses:actions/upload-pages-artifact",
  ]),
]);

function indentation(line) {
  return line.match(/^\s*/)[0].length;
}

function nestedBlock(lines, start) {
  const base = indentation(lines[start]);
  const block = [];
  for (let index = start + 1; index < lines.length; index++) {
    const line = lines[index];
    if (line.trim() && indentation(line) <= base) break;
    block.push(line);
  }
  return block;
}

function stepBlock(lines, start) {
  const base = indentation(lines[start]);
  const block = [lines[start]];
  for (let index = start + 1; index < lines.length; index++) {
    const line = lines[index];
    if (line.trim() && indentation(line) <= base && /^\s*-\s+/.test(line)) break;
    if (line.trim() && indentation(line) < base) break;
    block.push(line);
  }
  return block;
}

function validatePermissions(lines, file) {
  const indexes = [];
  for (let index = 0; index < lines.length; index++) {
    if (!/^\s*permissions\s*:/.test(lines[index])) continue;
    if (!/^\s*permissions\s*:\s*$/.test(lines[index])) {
      throw new Error(`${file} must express permissions as a block mapping.`);
    }
    indexes.push(index);
  }
  if (!indexes.some((index) => indentation(lines[index]) === 0)) {
    throw new Error(`${file} must declare top-level permissions.`);
  }
  for (const index of indexes) {
    const entries = permissionEntriesAt(lines, index, file);
    if (entries.length === 0) throw new Error(`${file} has an empty permissions map.`);
    for (const [scope, access] of entries) {
      if (!ALLOWED_PERMISSIONS.get(scope)?.has(access)) {
        throw new Error(`${file} has unsafe permission ${scope}: ${access}.`);
      }
    }
    if (
      indentation(lines[index]) === 0 &&
      entries.some(([scope, access]) => scope !== "contents" || access !== "read")
    ) {
      throw new Error(`${file} must limit top-level permissions to contents: read.`);
    }
  }
}

function validatePrivilegedJobs(lines, file) {
  const jobsIndex = lines.findIndex((line) => line === "jobs:");
  if (jobsIndex < 0) throw new Error(`${file} has no jobs map.`);

  for (let index = jobsIndex + 1; index < lines.length; index++) {
    const job = lines[index].match(/^  ([A-Za-z0-9_-]+):\s*$/);
    if (!job) continue;

    const block = [lines[index], ...nestedBlock(lines, index)];
    const permissionsOffset = block.findIndex((line) => /^    permissions\s*:\s*$/.test(line));
    if (permissionsOffset < 0) continue;
    const permissions = Object.fromEntries(permissionEntriesAt(lines, index + permissionsOffset, file));
    const isPrivileged = permissions.pages === "write" || permissions["id-token"] === "write";
    if (!isPrivileged) continue;

    if (
      job[1] !== "deploy" ||
      permissions.contents !== undefined ||
      permissions.pages !== "write" ||
      permissions["id-token"] !== "write"
    ) {
      throw new Error(`${file} has an invalid privileged deployment job.`);
    }
    if (
      !block.some((line) => /^    environment:\s*$/.test(line)) ||
      !block.some((line) => /^      name:\s*github-pages\s*$/.test(line))
    ) {
      throw new Error(`${file} must protect its privileged job with the github-pages environment.`);
    }
    if (block.some((line) => /^\s*(?:-\s*)?(?:run|env|container|services)\s*:/.test(line))) {
      throw new Error(`${file} cannot run commands or declare execution context in a privileged job.`);
    }

    const actions = block
      .map((line) => line.match(/^\s*(?:-\s*)?uses\s*:\s*([^@\s]+)@/i)?.[1]?.toLowerCase())
      .filter(Boolean);
    const steps = block.filter((line) => /^      -\s+\S/.test(line));
    if (
      actions.length !== 1 ||
      actions[0] !== "actions/deploy-pages" ||
      steps.length !== 1
    ) {
      throw new Error(`${file} must limit its privileged job to one deploy-pages step.`);
    }
  }
}

function permissionEntriesAt(lines, index, file) {
  const entries = nestedBlock(lines, index)
    .filter((line) => line.trim() && !line.trimStart().startsWith("#"))
    .map((line) => {
      const match = line.replace(/\s+#.*$/, "").trim().match(/^([a-z-]+):\s*([a-z-]+)$/);
      if (!match) throw new Error(`${file} has unsupported permissions syntax.`);
      return [match[1], match[2]];
    });
  const seen = new Set();
  for (const [scope] of entries) {
    if (seen.has(scope)) throw new Error(`${file} has duplicate permission ${scope}.`);
    seen.add(scope);
  }
  return entries;
}

function runBlocks(lines, file) {
  const blocks = [];
  for (let index = 0; index < lines.length; index++) {
    if (!/^\s*(?:-\s*)?run\s*:/.test(lines[index])) continue;
    const match = lines[index].match(/^\s*(?:-\s*)?run\s*:\s*(.*)$/);
    if (!match) throw new Error(`${file} uses unsupported run syntax.`);
    const rawHeader = match[1].trim();
    if (rawHeader.includes("${{")) {
      throw new Error(`${file} interpolates workflow context into a run block.`);
    }
    if (/^['"{[]/.test(rawHeader)) {
      throw new Error(`${file} uses a quoted or flow-style run value.`);
    }
    const header = rawHeader.replace(/\s+#.*$/, "").trim();
    if (header.startsWith(">")) throw new Error(`${file} uses a folded run block.`);
    blocks.push(
      header === "" || header.startsWith("|")
        ? nestedBlock(lines, index).join("\n")
        : header,
    );
  }
  return blocks;
}

function validateYamlShape(lines, file) {
  if (lines.some((line) => line.includes("\t"))) {
    throw new Error(`${file} uses tab indentation.`);
  }
  for (const line of lines) {
    if (/^\s*shell\s*:/.test(line)) {
      throw new Error(`${file} overrides the workflow shell.`);
    }
    if (
      /^\s*(?:-\s*)?['"][^'"]+['"]\s*:/.test(line) ||
      /^\s*(?:-\s*)?(?:[^#\s][^:]*:\s*)?\{/.test(line)
    ) {
      throw new Error(`${file} uses a quoted key or flow-style mapping.`);
    }
    if (
      /^\s*(?:-\s*)?(?:[^#\s][^:]*:\s*)?[&*!]/.test(line) ||
      /^\s*<<\s*:/.test(line)
    ) {
      throw new Error(`${file} uses a YAML anchor, alias, tag, or merge key.`);
    }
  }
}

function validateTriggers(lines, file) {
  const onIndex = lines.findIndex((line) => line === "on:");
  if (onIndex < 0) throw new Error(`${file} has no trigger map.`);
  const triggers = nestedBlock(lines, onIndex)
    .filter((line) => indentation(line) === 2)
    .map((line) => line.match(/^  ([a-z_][\w-]*):/)?.[1])
    .filter(Boolean);
  if (triggers.length === 0 || triggers.some((trigger) => !ALLOWED_TRIGGERS.has(trigger))) {
    throw new Error(`${file} has an unsafe trigger.`);
  }
}

function jobStartFor(lines, index) {
  let jobStart = index;
  while (jobStart > 0 && !/^  [A-Za-z0-9_-]+:\s*$/.test(lines[jobStart])) jobStart--;
  return jobStart;
}

function validateRunnerTimeouts(lines, file) {
  for (let index = 0; index < lines.length; index++) {
    if (!/^    runs-on:\s*\S+/.test(lines[index])) continue;
    const jobStart = jobStartFor(lines, index);
    if (!nestedBlock(lines, jobStart).some((line) => /^    timeout-minutes:\s*[1-9]\d*$/.test(line))) {
      throw new Error(`${file} has a runner job without a timeout.`);
    }
  }
}

function validateConfigurePagesAccess(lines, index, file) {
  const jobStart = jobStartFor(lines, index);
  const jobEnd = jobStart + nestedBlock(lines, jobStart).length + 1;
  const jobPermissionsIndex = lines.findIndex(
    (line, lineIndex) =>
      lineIndex > jobStart &&
      lineIndex < jobEnd &&
      /^    permissions\s*:/.test(line),
  );
  const workflowPermissionsIndex = lines.findIndex(
    (line) => indentation(line) === 0 && /^permissions\s*:/.test(line),
  );
  const effectivePermissionsIndex = jobPermissionsIndex >= 0
    ? jobPermissionsIndex
    : workflowPermissionsIndex;
  const hasPagesAccess = permissionEntriesAt(lines, effectivePermissionsIndex, file).some(
    ([scope, access]) =>
      scope.toLowerCase() === "pages" &&
      /^(?:read|write)$/i.test(access),
  );
  if (!hasPagesAccess) {
    throw new Error(`${file} must grant effective Pages access to configure-pages jobs.`);
  }
}

function validateActionReferences(lines, file) {
  for (let index = 0; index < lines.length; index++) {
    if (!/^\s*(?:-\s*)?uses\s*:/.test(lines[index])) continue;
    const action = lines[index].match(
      /^\s*(?:-\s*)?uses\s*:\s*([^@\s]+)@([^\s#]+)\s*(?:#.*)?$/,
    );
    if (!action) throw new Error(`${file} uses unsupported action syntax.`);
    if (!ACTION_SHA.test(action[2])) throw new Error(`${file} has an unpinned action.`);
    const actionName = action[1].toLowerCase();
    if (!ALLOWED_ACTIONS.has(actionName)) {
      throw new Error(`${file} uses unapproved action ${action[1]}.`);
    }
    if (actionName === "actions/configure-pages") {
      validateConfigurePagesAccess(lines, index, file);
    }
    if (actionName === "actions/checkout") {
      const step = stepBlock(lines, index);
      const withIndexes = step
        .map((line, lineIndex) => (/^\s*with:\s*$/.test(line) ? lineIndex : -1))
        .filter((lineIndex) => lineIndex >= 0);
      if (withIndexes.length !== 1) throw new Error(`${file} must disable checkout credentials.`);
      const inputs = nestedBlock(step, withIndexes[0])
        .filter((line) => line.trim() && !line.trimStart().startsWith("#"));
      const credentials = inputs.filter((line) => /^\s*persist-credentials\s*:/.test(line));
      if (
        credentials.length !== 1 ||
        !/^\s*persist-credentials:\s*false\s*$/.test(credentials[0])
      ) {
        throw new Error(`${file} must disable checkout credentials.`);
      }
    }
  }
}

function validateRunCommands(lines, file) {
  for (const script of runBlocks(lines, file)) {
    if (script.includes("${{")) throw new Error(`${file} interpolates workflow context into a run block.`);
    const commands = script.split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"));
    if (commands.length !== 1 || !ALLOWED_RUN_COMMANDS.has(commands[0])) {
      throw new Error(`${file} uses an unsupported run command.`);
    }
  }
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireRecord(value, file, label) {
  if (!isRecord(value)) throw new Error(`${file} must express ${label} as a mapping.`);
  return value;
}

function requireExactKeys(value, allowed, file, label) {
  const record = requireRecord(value, file, label);
  const unexpected = Object.keys(record).filter((key) => !allowed.includes(key));
  if (unexpected.length > 0) {
    throw new Error(`${file} has unsupported ${label} key ${unexpected[0]}.`);
  }
  return record;
}

function requirePermissions(actual, expected, file, label) {
  const permissions = requireExactKeys(actual, Object.keys(expected), file, `${label} permissions`);
  const matches = Object.entries(expected).every(([scope, access]) => permissions[scope] === access);
  if (!matches || Object.keys(permissions).length !== Object.keys(expected).length) {
    throw new Error(`${file} has invalid ${label} permissions.`);
  }
}

function parseActionReference(reference, file) {
  if (typeof reference !== "string") throw new Error(`${file} has a non-string action reference.`);
  const match = reference.match(/^([^@\s]+)@([a-f0-9]{40})$/);
  if (!match || !ALLOWED_ACTIONS.has(match[1].toLowerCase())) {
    throw new Error(`${file} has an invalid parsed action reference.`);
  }
  return match[1].toLowerCase();
}

function validateActionInputs(action, inputs, file) {
  const value = inputs === undefined ? {} : requireRecord(inputs, file, `${action} inputs`);
  if (action === "actions/checkout") {
    const checkout = requireExactKeys(value, ["persist-credentials"], file, `${action} inputs`);
    if (checkout["persist-credentials"] !== false) throw new Error(`${file} must disable checkout credentials.`);
  } else if (action === "actions/setup-node") {
    const node = requireExactKeys(value, ["node-version", "cache", "cache-dependency-path"], file, `${action} inputs`);
    if (String(node["node-version"]) !== "24" || node.cache !== "npm" || node["cache-dependency-path"] !== "package-lock.json") {
      throw new Error(`${file} has invalid setup-node inputs.`);
    }
  } else if (action === "ruby/setup-ruby") {
    const ruby = requireExactKeys(value, ["ruby-version", "bundler-cache"], file, `${action} inputs`);
    if (String(ruby["ruby-version"]) !== "4.0" || ruby["bundler-cache"] !== false) {
      throw new Error(`${file} has invalid setup-ruby inputs.`);
    }
  } else if (action === "actions/upload-pages-artifact") {
    const upload = requireExactKeys(value, ["path"], file, `${action} inputs`);
    if (Object.keys(upload).length === 0) return;
    if (typeof upload.path !== "string" || upload.path.startsWith("/") || upload.path.includes("..")) {
      throw new Error(`${file} has an unsafe upload path.`);
    }
  } else if (action === "actions/jekyll-build-pages") {
    const jekyll = requireExactKeys(value, ["source", "destination"], file, `${action} inputs`);
    if (jekyll.source !== "./" || jekyll.destination !== "./_site") {
      throw new Error(`${file} has invalid Jekyll inputs.`);
    }
  } else if (Object.keys(value).length > 0) {
    throw new Error(`${file} has unexpected inputs for ${action}.`);
  }
}

function validateStepEnvironment(environment, file) {
  if (environment === undefined) return;
  const env = requireExactKeys(environment, ["PATH_PREFIX", "PAGES_BASE", "PAGES_REPO"], file, "step environment");
  for (const [name, value] of Object.entries(env)) {
    const valid = name === "PATH_PREFIX"
      ? typeof value === "string" && (/^\/(?:[A-Za-z0-9._-]+\/)*$/.test(value) || value === "__BASE_PATH__")
      : name === "PAGES_BASE"
        ? value === "${{ steps.pages.outputs.base_path }}"
        : value === "${{ github.repository }}";
    if (!valid) throw new Error(`${file} has unsafe environment value ${name}.`);
  }
}

function validateParsedStep(step, file) {
  const value = requireExactKeys(step, ["name", "id", "uses", "with", "run", "env"], file, "step");
  if (typeof value.name !== "string" || !value.name.trim()) throw new Error(`${file} has an unnamed step.`);
  const hasAction = value.uses !== undefined;
  const hasRun = value.run !== undefined;
  if (hasAction === hasRun) throw new Error(`${file} has an invalid step execution shape.`);

  if (hasAction) {
    if (value.env !== undefined) throw new Error(`${file} passes environment variables to an action.`);
    const action = parseActionReference(value.uses, file);
    validateActionInputs(action, value.with, file);
    return `uses:${action}`;
  }

  if (value.id !== undefined || value.with !== undefined || !ALLOWED_RUN_COMMANDS.has(value.run)) {
    throw new Error(`${file} uses an unsupported parsed run command.`);
  }
  validateStepEnvironment(value.env, file);
  return `run:${value.run}`;
}

function validateParsedJob(job, expectedPermissions, file, label) {
  const allowed = label === "deploy"
    ? ["needs", "runs-on", "timeout-minutes", "permissions", "environment", "steps"]
    : ["runs-on", "timeout-minutes", "permissions", "steps"];
  const value = requireExactKeys(job, allowed, file, `${label} job`);
  if (value["runs-on"] !== "ubuntu-latest" || !Number.isInteger(value["timeout-minutes"]) || value["timeout-minutes"] < 1) {
    throw new Error(`${file} has invalid ${label} runner settings.`);
  }
  requirePermissions(value.permissions, expectedPermissions, file, label);
  if (!Array.isArray(value.steps) || value.steps.length === 0) {
    throw new Error(`${file} has invalid ${label} steps.`);
  }
  return value;
}

function validateParsedWorkflow(source, file) {
  const document = parseDocument(source, {
    logLevel: "silent",
    schema: "core",
    strict: true,
    stringKeys: true,
    uniqueKeys: true,
    version: "1.2",
  });
  if (document.errors.length > 0 || document.warnings.length > 0) {
    throw new Error(`${file} is not canonical YAML: ${document.errors[0]?.message ?? document.warnings[0].message}`);
  }
  const workflow = requireExactKeys(
    document.toJS({ maxAliasCount: 0 }),
    ["name", "on", "permissions", "concurrency", "jobs"],
    file,
    "workflow",
  );
  if (typeof workflow.name !== "string" || !workflow.name.trim()) throw new Error(`${file} has no workflow name.`);

  const triggers = requireExactKeys(workflow.on, ["push", "workflow_dispatch"], file, "trigger");
  const push = requireExactKeys(triggers.push, ["branches"], file, "push trigger");
  if (!Array.isArray(push.branches) || push.branches.length !== 1 || !/^(?:__[A-Z_]+__|[A-Za-z0-9._/-]+)$/.test(push.branches[0])) {
    throw new Error(`${file} has invalid push branches.`);
  }
  if (triggers.workflow_dispatch !== null && !isRecord(triggers.workflow_dispatch)) {
    throw new Error(`${file} has invalid workflow_dispatch settings.`);
  }
  requirePermissions(workflow.permissions, { contents: "read" }, file, "top-level");

  const concurrency = requireExactKeys(workflow.concurrency, ["group", "cancel-in-progress"], file, "concurrency");
  if (concurrency.group !== "pages" || concurrency["cancel-in-progress"] !== false) {
    throw new Error(`${file} has invalid concurrency settings.`);
  }

  const jobs = requireExactKeys(workflow.jobs, ["build", "deploy"], file, "jobs");
  const build = validateParsedJob(jobs.build, { contents: "read", pages: "read" }, file, "build");
  const buildSequence = build.steps.map((step) => validateParsedStep(step, file));
  if (!ALLOWED_BUILD_SEQUENCES.has(JSON.stringify(buildSequence))) {
    throw new Error(`${file} has an unsupported build step sequence.`);
  }

  const deploy = validateParsedJob(jobs.deploy, { pages: "write", "id-token": "write" }, file, "deploy");
  const environment = requireExactKeys(deploy.environment, ["name", "url"], file, "deployment environment");
  if (
    deploy.needs !== "build" ||
    environment.name !== "github-pages" ||
    environment.url !== "${{ steps.deployment.outputs.page_url }}"
  ) {
    throw new Error(`${file} has invalid deployment settings.`);
  }
  const deploySequence = deploy.steps.map((step) => validateParsedStep(step, file));
  if (JSON.stringify(deploySequence) !== JSON.stringify(["uses:actions/deploy-pages"])) {
    throw new Error(`${file} has an unsupported deploy step sequence.`);
  }
}

export function validateWorkflowText(yaml, file = "workflow") {
  const lines = yaml.replace(/\r\n?/g, "\n").split("\n");
  validateYamlShape(lines, file);
  validateTriggers(lines, file);
  validatePermissions(lines, file);
  validatePrivilegedJobs(lines, file);
  validateRunnerTimeouts(lines, file);
  validateActionReferences(lines, file);
  validateRunCommands(lines, file);
  validateParsedWorkflow(yaml, file);
}

export function validateWorkflowTree(root) {
  const workflowRoot = join(root, ".github", "workflows");
  if (!existsSync(workflowRoot)) {
    throw new Error(`${relative(process.cwd(), root) || root} has no GitHub Actions workflow directory.`);
  }
  for (const entry of readdirSync(workflowRoot, { withFileTypes: true })) {
    if (!entry.isFile() || !/\.ya?ml$/i.test(entry.name)) continue;
    const file = join(workflowRoot, entry.name);
    validateWorkflowText(readFileSync(file, "utf8"), relative(root, file));
  }
}
