import { execFileSync } from "node:child_process";

import { demoDeferredFeatures } from "@coachinclaw/coach-core";

const repo = process.argv[2];

if (!repo) {
  console.error("Usage: npm run issues:deferred -- <owner/repo>");
  process.exit(1);
}

const existingIssues = JSON.parse(
  execFileSync(
    "gh",
    ["issue", "list", "--repo", repo, "--state", "all", "--limit", "200", "--json", "title"],
    {
      encoding: "utf8",
    },
  ),
) as Array<{ title: string }>;

const existingTitles = new Set(existingIssues.map((issue) => issue.title));

for (const feature of demoDeferredFeatures) {
  if (existingTitles.has(feature.title)) {
    console.log(`Skipping existing issue: ${feature.title}`);
    continue;
  }

  const body = [
    "## Problem",
    feature.title,
    "",
    "## Why this was deferred from the MVP",
    feature.whyDeferred,
    "",
    "## Proposed future approach",
    feature.futureApproach,
    "",
    "## Security and privacy considerations",
    ...feature.securityNotes.map((note) => `- ${note}`),
    "",
    "## Acceptance criteria",
    ...feature.acceptanceCriteria.map((criterion) => `- [ ] ${criterion}`),
    "",
    "## Open questions",
    ...feature.openQuestions.map((question) => `- ${question}`),
    "",
    "_Created automatically from the MVP deferred-feature spec dataset._",
  ].join("\n");

  execFileSync("gh", ["issue", "create", "--repo", repo, "--title", feature.title, "--body", body], {
    stdio: "inherit",
  });
}
