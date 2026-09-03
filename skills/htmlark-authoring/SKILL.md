---
name: htmlark-authoring
description: Create and update local htmlark HTML/Markdown artifacts with stable keys, vendor pins, and --json.
---

# htmlark authoring

Always:

1. Use `--json`.
2. Use `htmlark put --key <stable-key> --file <path> --json`. Never create a second artifact for the same deliverable.
3. No CDN. Pin scripts as `/vendor/pkg@x.y.z/file.js` (exact semver).
4. On `code=CONFLICT`, get the artifact, re-apply, retry with `--base-version`.
5. Do not use `--force` or `import`. If `errors[]` is present, fix the HTML and put again.
6. Do not tell the user to send a loopback URL to colleagues. Export a file instead.

```
htmlark put --key q3-sales --file ./q3.html --name "Q3 Sales" --json
```
