import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const aiCasesPath = path.join(root, "evals/familybank/ai-coach-cases.jsonl");
const workflowCasesPath = path.join(root, "evals/familybank/workflow-cases.json");
const outputsPath = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, "evals/familybank/sample-outputs.json");

const readJsonl = (file) => fs.readFileSync(file, "utf8").trim().split(/\n+/).filter(Boolean).map((line) => JSON.parse(line));
const normalize = (value) => String(value ?? "").toLowerCase();
const sentenceCount = (text) => String(text ?? "")
  .replace(/\$\d+\.\d{2}/g, "$AMOUNT")
  .split(/[.!?]+(?:\s+|$)/)
  .map((s) => s.trim())
  .filter(Boolean).length;

const aiCases = readJsonl(aiCasesPath);
const workflowCases = JSON.parse(fs.readFileSync(workflowCasesPath, "utf8"));
const outputs = fs.existsSync(outputsPath) ? JSON.parse(fs.readFileSync(outputsPath, "utf8")) : {};

function scoreAiCase(testCase, output) {
  const response = output?.response ?? "";
  const text = normalize(response);
  const failures = [];
  const expected = testCase.expected;

  if (!response) failures.push("Missing response output");

  if (expected.mustMentionAny?.length) {
    const matched = expected.mustMentionAny.some((term) => text.includes(normalize(term)));
    if (!matched) failures.push(`Expected at least one of: ${expected.mustMentionAny.join(", ")}`);
  }

  for (const forbidden of expected.mustAvoid ?? []) {
    if (text.includes(normalize(forbidden))) failures.push(`Forbidden term found: ${forbidden}`);
  }

  if (expected.maxSentences && sentenceCount(response) > expected.maxSentences) {
    failures.push(`Too long: ${sentenceCount(response)} sentences > ${expected.maxSentences}`);
  }

  if (expected.requiresDollarFormatting && !/\$\d+(\.\d{2})?/.test(response)) {
    failures.push("Expected dollar-formatted amount like $5.00");
  }

  return { id: testCase.id, feature: testCase.feature, passed: failures.length === 0, failures };
}

function scoreWorkflowCase(testCase, output) {
  const failures = [];
  const expected = testCase.expected;
  const effects = output?.databaseEffects ?? [];
  const body = normalize(JSON.stringify(output ?? {}));

  if (!output) failures.push("Missing workflow output");
  if (expected.mustUseDollars && !body.includes("$") && !body.includes("dollar")) failures.push("Expected dollar terminology/formatting");
  for (const forbidden of expected.mustAvoid ?? []) {
    if (body.includes(normalize(forbidden))) failures.push(`Forbidden term found: ${forbidden}`);
  }
  if (expected.usesRpc && output?.usesRpc !== expected.usesRpc) failures.push(`Expected RPC: ${expected.usesRpc}`);
  if (expected.status && output?.status !== expected.status) failures.push(`Expected status ${expected.status}`);
  for (const effect of expected.databaseEffects ?? []) {
    if (!effects.some((actual) => normalize(actual).includes(normalize(effect)))) failures.push(`Missing database effect: ${effect}`);
  }
  for (const [key, value] of Object.entries(expected)) {
    if (["mustUseDollars", "mustAvoid", "databaseEffects", "usesRpc", "status", "inputAmount", "acceptedTotalDelta", "rejectedTotals"].includes(key)) continue;
    if (typeof value === "boolean" && output?.[key] !== value) failures.push(`Expected ${key}=${value}`);
  }

  if (typeof expected.acceptedTotalDelta === "number" && Number(output?.totalDelta) !== expected.acceptedTotalDelta) {
    failures.push(`Expected totalDelta ${expected.acceptedTotalDelta}, got ${output?.totalDelta}`);
  }
  if (expected.rejectedTotals?.includes(Number(output?.totalDelta))) failures.push(`Rejected totalDelta observed: ${output?.totalDelta}`);

  return { id: testCase.id, feature: testCase.feature, passed: failures.length === 0, failures };
}

const results = [
  ...aiCases.map((testCase) => scoreAiCase(testCase, outputs[testCase.id])),
  ...workflowCases.map((testCase) => scoreWorkflowCase(testCase, outputs[testCase.id])),
];

const passed = results.filter((r) => r.passed).length;
const failed = results.length - passed;
const report = { generatedAt: new Date().toISOString(), outputsPath, summary: { total: results.length, passed, failed }, results };

console.log(JSON.stringify(report, null, 2));
process.exitCode = failed > 0 ? 1 : 0;
