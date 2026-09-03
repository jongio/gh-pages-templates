import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

import { parseDocument } from "yaml";

import {
  requireApprovedActionReference,
  requireExactKeys,
  validateWorkflowYamlShape,
} from "./workflow-security.mjs";

const CODEQL_ACTION_SHA = "cdf488f595d80d6e07e03d4674febd5ab45fa938";
const ROOT_CACHE_DEPENDENCY_PATH = "package-lock.json\ntemplates/*/package-lock.json";
const VALIDATION_CONCURRENCY_GROUP = "validate-${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}";
const CODEQL_CONCURRENCY_GROUP = "codeql-${{ github.workflow }}-${{ github.ref }}";
const DEPLOY_MAIN_REF_CONDITION = "github.ref == 'refs/heads/main'";
const ROOT_WORKFLOW_VALIDATORS = {
  "codeql.yml": validateCodeqlWorkflowText,
  "deploy.yml": validateDeployWorkflowText,
  "validate.yml": validateValidationWorkflowText,
};

function requireExactRecord(value, expected, file, label) {
  const record = requireExactKeys(value, Object.keys(expected), file, label);
  const missing = Object.keys(expected).filter((key) => !(key in record));
  if (Object.entries(expected).some(([key, expectedValue]) => record[key] !== expectedValue)) {
    throw new Error(`${file} has invalid ${label}.`);
  }
  if (missing.length > 0) throw new Error(`${file} has invalid ${label} keys.`);
  return record;
}

function parseWorkflow(source, file) {
  validateWorkflowYamlShape(source, file);
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
  if (typeof workflow.name !== "string" || !workflow.name.trim()) {
    throw new Error(`${file} has an invalid workflow name.`);
  }
  return workflow;
}

function requireActionStep(step, {
  expectedName,
  expectedAction,
  expectedId,
  expectedInputs,
  expectedSha,
  file,
}) {
  const allowedKeys = ["name"];
  if (expectedId !== undefined) allowedKeys.push("id");
  allowedKeys.push("uses");
  if (expectedInputs !== undefined) allowedKeys.push("with");
  const value = requireExactKeys(step, allowedKeys, file, `${expectedName} step`);
  if (
    typeof value.name !== "string" ||
    !value.name.trim() ||
    value.id !== expectedId ||
    typeof value.uses !== "string"
  ) {
    throw new Error(`${file} has an invalid ${expectedName} step.`);
  }
  requireApprovedActionReference(value.uses, {
    expectedAction,
    expectedSha,
    file,
    label: expectedName,
  });
  if (expectedInputs !== undefined) {
    requireExactRecord(value.with, expectedInputs, file, `${expectedName} inputs`);
  }
}

function requireRunStep(step, {
  expectedCondition,
  expectedName,
  expectedRun,
  expectedEnvironment,
  file,
}) {
  const allowedKeys = ["name"];
  if (expectedCondition !== undefined) allowedKeys.push("if");
  if (expectedEnvironment !== undefined) allowedKeys.push("env");
  allowedKeys.push("run");
  const value = requireExactKeys(step, allowedKeys, file, `${expectedName} step`);
  if (
    typeof value.name !== "string" ||
    !value.name.trim() ||
    value.if !== expectedCondition ||
    value.run !== expectedRun
  ) {
    throw new Error(`${file} has an invalid ${expectedName} step.`);
  }
  if (expectedEnvironment !== undefined) {
    requireExactRecord(value.env, expectedEnvironment, file, `${expectedName} environment`);
  }
}

function requireJob(job, {
  allowedKeys,
  expectedName,
  expectedPermissions,
  expectedTimeout = 20,
  file,
}) {
  const value = requireExactKeys(job, allowedKeys, file, `${expectedName} job`);
  if (
    value["runs-on"] !== "ubuntu-latest" ||
    value["timeout-minutes"] !== expectedTimeout ||
    !Array.isArray(value.steps)
  ) {
    throw new Error(`${file} has invalid ${expectedName} job settings.`);
  }
  if (expectedPermissions !== undefined) {
    requireExactRecord(value.permissions, expectedPermissions, file, `${expectedName} permissions`);
  }
  return value;
}

export function validateDeployWorkflowText(source, file = "deploy.yml") {
  const workflow = parseWorkflow(source, file);
  const triggers = requireExactKeys(workflow.on, ["push", "workflow_dispatch"], file, "triggers");
  const push = requireExactKeys(triggers.push, ["branches"], file, "push trigger");
  if (
    !Array.isArray(push.branches) ||
    push.branches.length !== 1 ||
    push.branches[0] !== "main" ||
    triggers.workflow_dispatch !== null
  ) {
    throw new Error(`${file} has invalid triggers.`);
  }
  requireExactRecord(workflow.permissions, { contents: "read" }, file, "top-level permissions");
  requireExactRecord(
    workflow.concurrency,
    { group: "pages", "cancel-in-progress": false },
    file,
    "concurrency",
  );

  const jobs = requireExactKeys(workflow.jobs, ["build", "deploy"], file, "jobs");
  const build = requireJob(jobs.build, {
    allowedKeys: ["if", "runs-on", "timeout-minutes", "permissions", "steps"],
    expectedName: "build",
    expectedPermissions: { contents: "read", pages: "read" },
    file,
  });
  if (build.if !== DEPLOY_MAIN_REF_CONDITION) {
    throw new Error(`${file} has an invalid build ref guard.`);
  }
  if (build.steps.length !== 8) throw new Error(`${file} has an invalid build step count.`);
  requireActionStep(build.steps[0], {
    expectedName: "Checkout",
    expectedAction: "actions/checkout",
    expectedInputs: { "persist-credentials": false },
    file,
  });
  requireActionStep(build.steps[1], {
    expectedName: "Setup Node",
    expectedAction: "actions/setup-node",
    expectedInputs: {
      "node-version": 24,
      cache: "npm",
      "cache-dependency-path": ROOT_CACHE_DEPENDENCY_PATH,
    },
    file,
  });
  requireRunStep(build.steps[2], {
    expectedName: "Install validation dependencies",
    expectedRun: "npm ci --ignore-scripts --no-audit --no-fund",
    file,
  });
  requireActionStep(build.steps[3], {
    expectedName: "Setup Ruby (for the Jekyll preview)",
    expectedAction: "ruby/setup-ruby",
    expectedInputs: {
      "ruby-version": "4.0",
      "bundler-cache": false,
    },
    file,
  });
  requireRunStep(build.steps[4], {
    expectedName: "Validate",
    expectedRun: "node scripts/validate.mjs",
    file,
  });
  requireActionStep(build.steps[5], {
    expectedName: "Configure Pages",
    expectedAction: "actions/configure-pages",
    expectedId: "pages",
    file,
  });
  requireRunStep(build.steps[6], {
    expectedName: "Build site (catalog + live previews)",
    expectedRun: "node scripts/build-site.mjs",
    expectedEnvironment: {
      PAGES_BASE: "${{ steps.pages.outputs.base_path }}",
      PAGES_REPO: "${{ github.repository }}",
    },
    file,
  });
  requireActionStep(build.steps[7], {
    expectedName: "Upload artifact",
    expectedAction: "actions/upload-pages-artifact",
    expectedInputs: { path: "site" },
    file,
  });

  const deploy = requireJob(jobs.deploy, {
    allowedKeys: [
      "if",
      "needs",
      "runs-on",
      "timeout-minutes",
      "permissions",
      "environment",
      "steps",
    ],
    expectedName: "deploy",
    expectedPermissions: { pages: "write", "id-token": "write" },
    expectedTimeout: 10,
    file,
  });
  if (deploy.if !== DEPLOY_MAIN_REF_CONDITION) {
    throw new Error(`${file} has an invalid deploy ref guard.`);
  }
  requireExactRecord(
    deploy.environment,
    {
      name: "github-pages",
      url: "${{ steps.deployment.outputs.page_url }}",
    },
    file,
    "deployment environment",
  );
  if (deploy.needs !== "build" || deploy.steps.length !== 1) {
    throw new Error(`${file} has invalid deploy job settings.`);
  }
  requireActionStep(deploy.steps[0], {
    expectedName: "Deploy to GitHub Pages",
    expectedAction: "actions/deploy-pages",
    expectedId: "deployment",
    file,
  });
}

export function validateValidationWorkflowText(source, file = "validate.yml") {
  const workflow = parseWorkflow(source, file);
  const triggers = requireExactKeys(workflow.on, ["push", "pull_request", "workflow_dispatch"], file, "triggers");
  const push = requireExactKeys(triggers.push, ["branches"], file, "push trigger");
  if (
    !Array.isArray(push.branches) ||
    push.branches.length !== 1 ||
    push.branches[0] !== "main"
  ) {
    throw new Error(`${file} has invalid push trigger.`);
  }
  if (triggers.pull_request !== null || triggers.workflow_dispatch !== null) {
    throw new Error(`${file} has invalid pull request or manual triggers.`);
  }
  requireExactRecord(workflow.permissions, { contents: "read" }, file, "top-level permissions");
  requireExactRecord(
    workflow.concurrency,
    { group: VALIDATION_CONCURRENCY_GROUP, "cancel-in-progress": true },
    file,
    "concurrency",
  );
  const jobs = requireExactKeys(workflow.jobs, ["validate"], file, "jobs");
  const job = requireJob(jobs.validate, {
    allowedKeys: ["runs-on", "timeout-minutes", "steps"],
    expectedName: "validate",
    file,
  });
  if (job.steps.length !== 6) throw new Error(`${file} has an invalid validate step count.`);
  requireActionStep(job.steps[0], {
    expectedName: "Checkout",
    expectedAction: "actions/checkout",
    expectedInputs: { "persist-credentials": false },
    file,
  });
  requireActionStep(job.steps[1], {
    expectedName: "Setup Node",
    expectedAction: "actions/setup-node",
    expectedInputs: {
      "node-version": 24,
      cache: "npm",
      "cache-dependency-path": ROOT_CACHE_DEPENDENCY_PATH,
    },
    file,
  });
  requireActionStep(job.steps[2], {
    expectedName: "Setup Ruby",
    expectedAction: "ruby/setup-ruby",
    expectedInputs: {
      "ruby-version": "4.0",
      "bundler-cache": false,
    },
    file,
  });
  requireRunStep(job.steps[3], {
    expectedName: "Install validation dependencies",
    expectedRun: "npm ci --ignore-scripts --no-audit --no-fund",
    file,
  });
  requireRunStep(job.steps[4], {
    expectedName: "Validate",
    expectedRun: "node scripts/validate.mjs",
    file,
  });
  requireRunStep(job.steps[5], {
    expectedCondition: "github.event_name != 'push'",
    expectedName: "Build all template previews",
    expectedRun: "node scripts/build-site.mjs",
    expectedEnvironment: {
      PAGES_BASE: "/gh-pages-templates/",
      PAGES_REPO: "jongio/gh-pages-templates",
    },
    file,
  });
}

export function validateCodeqlWorkflowText(source, file = "codeql.yml") {
  const workflow = parseWorkflow(source, file);
  const triggers = requireExactKeys(workflow.on, ["push", "pull_request", "schedule", "workflow_dispatch"], file, "triggers");
  requireExactKeys(triggers.push, ["branches"], file, "push trigger");
  requireExactKeys(triggers.pull_request, ["branches"], file, "pull request trigger");
  if (
    !Array.isArray(triggers.push.branches) ||
    triggers.push.branches.length !== 1 ||
    triggers.push.branches[0] !== "main" ||
    !Array.isArray(triggers.pull_request.branches) ||
    triggers.pull_request.branches.length !== 1 ||
    triggers.pull_request.branches[0] !== "main" ||
    !Array.isArray(triggers.schedule) ||
    triggers.schedule.length !== 1
  ) {
    throw new Error(`${file} has invalid branch or schedule triggers.`);
  }

  requireExactRecord(triggers.schedule[0], { cron: "17 3 * * 1" }, file, "schedule");
  if (triggers.workflow_dispatch !== null) throw new Error(`${file} has invalid manual trigger.`);
  requireExactRecord(workflow.permissions, { contents: "read" }, file, "top-level permissions");
  requireExactRecord(
    workflow.concurrency,
    { group: CODEQL_CONCURRENCY_GROUP, "cancel-in-progress": true },
    file,
    "concurrency",
  );
  const jobs = requireExactKeys(workflow.jobs, ["analyze"], file, "jobs");
  const job = requireJob(
    jobs.analyze,
    {
      allowedKeys: ["name", "runs-on", "timeout-minutes", "permissions", "steps"],
      expectedName: "analyze",
      expectedPermissions: { contents: "read", "security-events": "write" },
      file,
    },
  );
  if (typeof job.name !== "string" || !job.name.trim() || job.steps.length !== 3) {
    throw new Error(`${file} has invalid analyze job settings.`);
  }
  requireActionStep(job.steps[0], {
    expectedName: "Checkout",
    expectedAction: "actions/checkout",
    expectedInputs: { "persist-credentials": false },
    file,
  });
  requireActionStep(job.steps[1], {
    expectedName: "Initialize CodeQL",
    expectedAction: "github/codeql-action/init",
    expectedInputs: { languages: "javascript-typescript" },
    expectedSha: CODEQL_ACTION_SHA,
    file,
  });
  requireActionStep(job.steps[2], {
    expectedName: "Analyze",
    expectedAction: "github/codeql-action/analyze",
    expectedSha: CODEQL_ACTION_SHA,
    file,
  });
}

export function validateRepositoryWorkflowTree(root) {
  const workflowRoot = join(root, ".github", "workflows");
  const workflowFiles = readdirSync(workflowRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.ya?ml$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  const approvedFiles = Object.keys(ROOT_WORKFLOW_VALIDATORS).sort();
  if (JSON.stringify(workflowFiles) !== JSON.stringify(approvedFiles)) {
    throw new Error(`${relative(root, workflowRoot)} has unsupported workflow files: ${workflowFiles.join(", ")}.`);
  }
  for (const file of approvedFiles) {
    const path = join(workflowRoot, file);
    ROOT_WORKFLOW_VALIDATORS[file](readFileSync(path, "utf8"), relative(root, path).replaceAll("\\", "/"));
  }
}
