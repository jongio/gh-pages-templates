import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const ACTION_SHA = /^[a-f0-9]{40}$/;
const ALLOWED_TRIGGERS = new Set(["push", "workflow_dispatch"]);
const ALLOWED_PERMISSIONS = new Map([
  ["contents", new Set(["read"])],
  ["pages", new Set(["read", "write"])],
  ["id-token", new Set(["write"])],
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

function permissionEntriesAt(lines, index, file) {
  return nestedBlock(lines, index)
    .filter((line) => line.trim() && !line.trimStart().startsWith("#"))
    .map((line) => {
      const match = line.replace(/\s+#.*$/, "").trim().match(/^([a-z-]+):\s*([a-z-]+)$/);
      if (!match) throw new Error(`${file} has unsupported permissions syntax.`);
      return [match[1], match[2]];
    });
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

export function validateWorkflowText(yaml, file = "workflow") {
  const lines = yaml.replace(/\r\n?/g, "\n").split("\n");
  if (lines.some((line) => line.includes("\t"))) {
    throw new Error(`${file} uses tab indentation.`);
  }
  for (const line of lines) {
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
  const onIndex = lines.findIndex((line) => line === "on:");
  if (onIndex < 0) throw new Error(`${file} has no trigger map.`);
  const triggers = nestedBlock(lines, onIndex)
    .filter((line) => indentation(line) === 2)
    .map((line) => line.match(/^  ([a-z_][\w-]*):/)?.[1])
    .filter(Boolean);
  if (triggers.length === 0 || triggers.some((trigger) => !ALLOWED_TRIGGERS.has(trigger))) {
    throw new Error(`${file} has an unsafe trigger.`);
  }
  validatePermissions(lines, file);

  for (let index = 0; index < lines.length; index++) {
    if (/^    runs-on:\s*\S+/.test(lines[index])) {
      let jobStart = index;
      while (jobStart > 0 && !/^  [A-Za-z0-9_-]+:\s*$/.test(lines[jobStart])) jobStart--;
      if (!nestedBlock(lines, jobStart).some((line) => /^    timeout-minutes:\s*[1-9]\d*$/.test(line))) {
        throw new Error(`${file} has a runner job without a timeout.`);
      }
    }
    if (!/^\s*(?:-\s*)?uses\s*:/.test(lines[index])) continue;
    const action = lines[index].match(
      /^\s*(?:-\s*)?uses\s*:\s*([^@\s]+)@([^\s#]+)\s*(?:#.*)?$/,
    );
    if (!action) throw new Error(`${file} uses unsupported action syntax.`);
    if (!ACTION_SHA.test(action[2])) throw new Error(`${file} has an unpinned action.`);
    const actionName = action[1].toLowerCase();
    if (actionName === "actions/configure-pages") {
      let jobStart = index;
      while (jobStart > 0 && !/^  [A-Za-z0-9_-]+:\s*$/.test(lines[jobStart])) jobStart--;
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
      const hasPagesAccess = permissionEntriesAt(
        lines,
        effectivePermissionsIndex,
        file,
      ).some(
        ([scope, access]) =>
          scope.toLowerCase() === "pages" &&
          /^(?:read|write)$/i.test(access),
      );
      if (!hasPagesAccess) {
        throw new Error(`${file} must grant effective Pages access to configure-pages jobs.`);
      }
    }
    if (actionName === "actions/checkout") {
      const step = stepBlock(lines, index);
      const matches = step.filter((line) => /^\s*persist-credentials:\s*false\s*$/.test(line));
      if (matches.length !== 1) throw new Error(`${file} must disable checkout credentials.`);
    }
  }

  for (const script of runBlocks(lines, file)) {
    if (script.includes("${{")) throw new Error(`${file} interpolates workflow context into a run block.`);
    const lines = script.split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"));
    const lifecycleCommand = /\b(?:npm|pnpm|yarn|bun)\b.*\b(?:ci|install|i)\b/i;
    const safeCommands = [
      /^npm(?:\s+--prefix\s+[A-Za-z0-9._/-]+)?\s+(?:ci|install|i)\s+--ignore-scripts(?:=true)?(?:\s+--(?:no-audit|no-fund))*$/i,
      /^pnpm(?:\s+--dir\s+[A-Za-z0-9._/-]+)?\s+(?:install|i)\s+--ignore-scripts(?:=true)?(?:\s+--(?:no-audit|no-fund))*$/i,
      /^yarn\s+install\s+--mode(?:=|\s+)skip-builds$/i,
      /^bun\s+install\s+--ignore-scripts(?:=true)?(?:\s+--no-save)*$/i,
    ];
    for (const line of lines) {
      if (!lifecycleCommand.test(line)) continue;
      if (!safeCommands.some((pattern) => pattern.test(line))) {
        throw new Error(`${file} runs a lifecycle-capable install without a standalone script-suppression command.`);
      }
    }
  }
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
