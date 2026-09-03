export type CatalogArg = {
  name: string;
  required?: boolean;
  summary: string;
};

export type CatalogCommand = {
  name: string;
  summary: string;
  args?: CatalogArg[];
};

export const COMMAND_CATALOG: CatalogCommand[] = [
  { name: "put", summary: "Create or update by key. Agent path. Always --json --key.", args: [{ name: "key", summary: "stable key" }, { name: "file", required: true, summary: "html or markdown path" }] },
  { name: "get", summary: "Print metadata. --out writes the authored bytes.", args: [{ name: "id", required: true, summary: "artifact id" }] },
  { name: "list", summary: "Local artifacts. Search and tag filters." },
  { name: "diff", summary: "Unified source diff between two versions.", args: [{ name: "id", required: true, summary: "artifact id" }, { name: "from", required: true, summary: "from version" }, { name: "to", required: true, summary: "to version" }] },
  { name: "restore", summary: "Append an old version as the new head.", args: [{ name: "id", required: true, summary: "artifact id" }, { name: "version", required: true, summary: "version to restore" }] },
  { name: "undelete", summary: "Clear deleted_at.", args: [{ name: "id", required: true, summary: "artifact id" }] },
  { name: "open", summary: "Open the viewer. Starts serve if it is not running.", args: [{ name: "id", required: true, summary: "artifact id" }] },
  { name: "serve", summary: "Loopback HTTP on 127.0.0.1:7420." },
  { name: "export", summary: "Write authored bytes to a file.", args: [{ name: "id", required: true, summary: "artifact id" }, { name: "out", required: true, summary: "output path" }] },
  { name: "import", summary: "Import a file. May be stored dirty." },
  { name: "setup", summary: "Install the skill pack and print the MCP snippet." },
  { name: "check", summary: "Sanity-check HTMLARK_HOME." },
  { name: "recipe validate", summary: "Validate a recipe v0 file or HTML quality gate." },
  { name: "doctor", summary: "Integrity, missing blobs, orphans." },
  { name: "mcp", summary: "stdio MCP. No force." },
  { name: "catalog", summary: "Print the command catalog JSON." },
  { name: "remote init", summary: "Write remotes.json for one-way publish." },
  { name: "publish", summary: "Push a version to a remote. One-way.", args: [{ name: "id", required: true, summary: "artifact id" }] },
  { name: "unpublish", summary: "Remove a published artifact from the remote.", args: [{ name: "id", required: true, summary: "artifact id" }] },
];
