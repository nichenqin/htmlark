export const SKILL_MD = `---
name: htmlark-authoring
description: Create and update local htmlark HTML/Markdown artifacts with stable keys, vendor pins, and --json.
---

# htmlark authoring

Always:

1. Use \`--json\`.
2. Use \`htmlark put --key <stable-key> --file <path> --json\`. Never create a second artifact for the same deliverable.
3. No CDN. Pin scripts as \`/vendor/pkg@x.y.z/file.js\` (exact semver).
4. On \`code=CONFLICT\`, get the artifact, re-apply, retry with \`--base-version\`.
5. Do not use \`--force\` or \`import\`. If \`errors[]\` is present, fix the HTML and put again.
6. Do not send a loopback \`127.0.0.1\` URL. Share with \`htmlark export\` or \`htmlark publish --id … --json\`.

\`\`\`
htmlark put --key q3-sales --file ./q3.html --name "Q3 Sales" --json
\`\`\`
`;

export const REMOTE_SCHEMA_SQL = `CREATE TABLE IF NOT EXISTS artifacts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  head_version INTEGER NOT NULL,
  follow_latest INTEGER NOT NULL,
  source_public INTEGER NOT NULL,
  password_hash TEXT,
  dirty INTEGER NOT NULL,
  vendor_specs TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS versions (
  artifact_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  dirty INTEGER NOT NULL,
  PRIMARY KEY (artifact_id, version)
);
`;
