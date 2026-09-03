# htmlark 技术选型调研

**日期：** 2026-09-03  
**范围：** CLI-first、core 平台不感知、可替换持久层、可选本地/远端 Web、v2 Desktop、Agent 表面  
**方法：** 主源（官方文档、仓库 README、规范）+ 本轮实测星标。X 帖本身抓取失败，改引这些人的一等博客。  
**结论先行（调研）：** 不要按 PRD 把 sqlite 写进 core。Store 端口 + 嵌入静态 Web。DI 容器不要。

星标为本轮 GitHub 页面实测（2026-09-03），不是排行榜。

**已锁定（2026-09-03）：** TypeScript + Bun。分发 `bun compile`（本机 hello 实测 61MB，接受）。Worker `import` 零 I/O 的 runtime/core，**不能** import bun:sqlite / `node:fs`。本地 `bun:sqlite`，云 D1+R2。Desktop v2，MVP `serve` + 浏览器。

---

## 1. PRD 现状 vs 你的约束

仓库现在只有 `README.md` + `PRD.md`，没有代码。PRD 已经把实现语言写死：

| PRD 假设 | 出处 | 与你的约束冲突 |
| --- | --- | --- |
| npm 包 `@htmlark/runtime` `@htmlark/core` `@htmlark/cli` | PRD D16 / D22 / 仓库布局 | 「不一定要 TS」；core 绑 Node |
| `@htmlark/core` = sqlite + flock + `node:fs`，Worker 禁止 import | D16 | 持久层不可替换；平台泄漏进 core |
| `@htmlark/runtime` = 零 I/O、Worker-safe 纯函数 | D16 / D4 | 这条对，但不必是 TS |
| Web = Vite SPA，只在 loopback `/` | D11 | 可保留，应只走 HTTP |
| Desktop = Tauri v2 | D8 / PR-23 | v2 才做；不要为 Tauri 先写 Rust core |
| 唯一 writer = CLI command functions；MCP 调这些函数 | D7 | 对，语言无关 |

PRD 的**产品**约束仍然成立：本地库是 origin、id 客户端生成、CSP wrap 必须跨 host 同一函数、`--json` opt-in、LAN 只放已 share 的 GET。要改的是**实现语言和 seam**，不是产品命题。

产品名 `htmlark`、CLI 名 `htmlark`、家目录 `~/.htmlark` 可以保留。npm scope 不是产品身份。

---

## 2. 你说的 dbx 是什么

本轮检索到三个同名物。你举的「热门新项目」对应 **t8y2/dbx**，不是 Databricks Labs 那个已停更的 CI 工具，也不是 PocketBase 的 Go query builder（虽然后者对「DB 可替换」也有用）。

**t8y2/dbx**（[github.com/t8y2/dbx](https://github.com/t8y2/dbx)，本轮 17.9k star）

- Rust + Tauri。桌面 / Docker Web / CLI / MCP / Skill 同一产品。
- README 自称 ~20 MB、无 JRE/Python/捆绑 Chromium。
- CLI：`dbx connections list --json`、`dbx query … --json`（[README](https://raw.githubusercontent.com/t8y2/dbx/main/README.md)）。
- MCP 是**独立** Rust 二进制，npm 只是启动器：`npx @dbx-app/mcp-server`。桌面安装**不**自动带 MCP。Web/Docker 时 MCP 指 `DBX_WEB_URL`。
- 仓库有 `crates/`、`apps/`、`packages/`、`src-tauri/`、`skills/dbx/`。Driver 是插件，不是 core 里写死一种库。
- 仓内 skill 目录：把 agent 用法当一等公民，不是事后 README。

**htmlark 该偷：**

1. CLI `--json` 是 agent 主路径，TUI/GUI 是人路径。
2. MCP 调同一后端（本地库或 Web API），不要第二条 SQL 路径。
3. 桌面 = 薄壳。core 不进 webview。
4. 发独立 CLI 包（Homebrew / 原生二进制），不要强迫人装桌面才能给 agent 用。
5. `skills/` 跟代码一起版本化。

**不要偷：** 90+ driver、内置 AI SQL、为 GUI 先选 Rust。htmlark MVP 没有桌面。

PocketBase 的 `DBConnect` 钩子（[pocketbase.io/docs/go-overview](https://pocketbase.io/docs/go-overview/)）才是「sqlite 可换驱动」的最小实现：默认 `modernc.org/sqlite`（无 CGO），需要时换 mattn/ncruces。这是**驱动**可换，不是**存储端口**可换。htmlark 需要后者。

---

## 3. 三十个项目（不是竞品清单）

按 htmlark 能偷的模式分组。星标仅列本轮读到的。

### A. CLI + 可选 Web/桌面（形状最近）

| # | 项目 | 语言 | 本轮 star | 偷什么 |
| --- | --- | --- | --- | --- |
| 1 | [t8y2/dbx](https://github.com/t8y2/dbx) | Rust + Tauri | 17.9k | CLI/Web/Desktop/MCP 分发面；`--json`；MCP 独立二进制 |
| 2 | [pocketbase/pocketbase](https://github.com/pocketbase/pocketbase) | Go | 60.9k | **一个二进制** `serve`；当库 embed；`CGO_ENABLED=0`；`DBConnect` |
| 3 | [anomalyco/opencode](https://github.com/anomalyco/opencode) | TypeScript / Bun | 203.4k | CLI 优先、后来加 Desktop；curl 安装脚本；agent 产品可以是 TS |
| 4 | [charmbracelet/crush](https://github.com/charmbracelet/crush) | Go | 27.9k | 单二进制 + goreleaser；SQLite 会话；MCP stdio/http/sse；`crushrc` |
| 5 | [aaif-goose/goose](https://github.com/aaif-goose/goose) | Rust | 53.9k | `crates/` + `ui/`；CLI 与 GUI 分 crate；MCP 扩展 |
| 6 | [caddyserver/caddy](https://github.com/caddyserver/caddy) | Go | — | CLI 即服务器；模块是接口不是框架 |
| 7 | [svenstaro/miniserve](https://github.com/svenstaro/miniserve) | Rust | — | `htmlark serve` 的最小形状：一个 flag 起 HTTP |

### B. 可替换存储 / local-first DB

| # | 项目 | 语言 | 本轮 star | 偷什么 |
| --- | --- | --- | --- | --- |
| 8 | [jj-vcs/jj](https://github.com/jj-vcs/jj) | Rust | 31.4k | **存储 backend 抽象**：UI/算法 vs Git 物理层分开（[README](https://raw.githubusercontent.com/jj-vcs/jj/main/README.md)）。htmlark 的 sqlite/D1/R2 同一招 |
| 9 | [tursodatabase/libsql](https://github.com/tursodatabase/libsql) | Rust (SQLite fork) | 17.2k | 本地文件与远程 replica 同一 SQL；**不要** MVP 就上，当 v1 remote 选项 |
| 10 | [duckdb/duckdb](https://github.com/duckdb/duckdb) | C++ | — | 嵌入式、单文件。htmlark 不需要分析引擎 |
| 11 | [electric-sql/pglite](https://github.com/electric-sql/pglite) | WASM Postgres | — | 「浏览器里的库」。htmlark 的库在磁盘，不在 WASM |
| 12 | [benbjohnson/litestream](https://github.com/benbjohnson/litestream) | Go | — | sqlite 旁路复制；应用仍用标准 sqlite（[Fly 文](https://fly.io/blog/all-in-on-sqlite-litestream/)） |
| 13 | [pocketbase/dbx](https://github.com/pocketbase/dbx) | Go | 0.17k | `database/sql` 上的 DB-agnostic builder。换驱动 ≠ 换领域 Store |
| 14 | [sqlc-dev/sqlc](https://github.com/sqlc-dev/sqlc) | Go | — | SQL 进、类型出。Store 适配器内部用，不要泄漏到 domain |
| 15 | [drizzle-team/drizzle-orm](https://github.com/drizzle-team/drizzle-orm) | TS | — | 若走 TS 才用。不要当架构 |

### C. Agent CLI / 协议

| # | 项目 | 语言 | 本轮 star | 偷什么 |
| --- | --- | --- | --- | --- |
| 16 | [modelcontextprotocol/modelcontextprotocol](https://github.com/modelcontextprotocol/modelcontextprotocol) | 规范 | 9.1k | stdio 本地、HTTP 远端。PRD D7/D9 已对齐 |
| 17 | [agentskills.io spec](https://agentskills.io/specification) | 规范 | — | `SKILL.md` frontmatter + progressive disclosure；`<500 行`；`scripts/` `references/` |
| 18 | [github/cli](https://github.com/cli/cli) | Go | — | `--json` + JMESPath；TTY 人话。PRD D20 已抄这个 |
| 19 | [openai/codex](https://github.com/openai/codex) | Rust CLI | — | 一等公民 agent；skill 必须强制 `--json` |
| 20 | [anthropics/claude-code](https://github.com/anthropics/claude-code) | — | — | skill 触发 + CLI 工具。htmlark 的主路径 |

### D. 运行时 / 桌面 / 边缘

| # | 项目 | 语言 | 本轮 star | 偷什么 |
| --- | --- | --- | --- | --- |
| 21 | [tauri-apps/tauri](https://github.com/tauri-apps/tauri) | Rust | 111k | v2 webview + 自定义协议。Desktop = 沙箱 HTML runtime |
| 22 | [wailsapp/wails](https://github.com/wailsapp/wails) | Go + webview | — | 若 core 是 Go，桌面不必换 Rust |
| 23 | [DioxusLabs/dioxus](https://github.com/DioxusLabs/dioxus) | Rust | — | 不要。htmlark 桌面不是 Rust GUI 应用 |
| 24 | [zed-industries/zed](https://github.com/zed-industries/zed) | Rust / GPUI | — | 自绘 GPU。htmlark 渲染的是 HTML，用系统 webview |
| 25 | [honojs/hono](https://github.com/honojs/hono) | TS | 32.1k | Web Standards；同一 router 跑 Node/Bun/Workers（[文档](https://hono.dev/docs/)）。**仅当 runtime/HTTP 留在 JS** |
| 26 | [oven-sh/bun](https://github.com/oven-sh/bun) | Zig runtime | — | 内置 sqlite、快启动。TS CLI 的唯一正经运行时 |
| 27 | [cloudflare/workers-sdk](https://github.com/cloudflare/workers-sdk) + D1 + R2 | — | — | v1 remote 参考。不要 import 本地 core |
| 28 | [bytecodealliance/wasmtime](https://github.com/bytecodealliance/wasmtime) | Rust | — | 若坚持「一份 runtime 二进制」跨 CLI/Worker，走 WASM。MVP 不做 |
| 29 | [astral-sh/uv](https://github.com/astral-sh/uv) | Rust | — | 单二进制分发教材。htmlark 不要 Python |
| 30 | [biomejs/biome](https://github.com/biomejs/biome) | Rust | — | 工具链单二进制。证明「TS 生态工具正在逃出 Node」 |

**额外（桌面 viewer 先验，已在 PRD）：** [HTML Browser](https://github.com/maail/htmlbrowser.dev) Tauri viewer + 自定义协议；[Imbas](https://github.com/ObiJuanDeanobi/imbas-os) 本地 vault。不重复算进 30。

**30 之外、本轮主源扫到、值得记一笔的：**

- Turso CLI `--mcp`：数据库产品把 MCP 当一等入口，不是事后插件。
- [openai/codex](https://github.com/openai/codex)：Rust CLI；JSONL `--format json` 给长任务；stderr 人话、stdout 机器。
- Ghostty：`libghostty` vs app 分库。htmlark 同形——runtime 是库，CLI/桌面是壳。
- sqlite-vec / Litestream / LiteFS：搜索与复制都是 sqlite **旁路**，不换领域模型。
- PGlite：constructor URI 换后端。htmlark 的 Store 构造同招，但默认不要 Postgres。
- Spin / Extism / Wasmtime：能力绑定跑 Wasm guest。只在以后真要跨 CLI/Worker 同一份 wrap 二进制时再碰。
- Electric / Zero：sync 引擎。htmlark v1 remote 是 git-like pull，不是 CRDT。

---

## 4. 语言：CLI-first 下怎么选

约束：1–2 人、6–8 人周 MVP、core 无 Node/无浏览器/无「必须 sqlite」、同一 command 供 CLI/MCP/HTTP、v1 Worker、v2 Desktop。

### 对照

| | Go | Rust | TS/Bun | Python / Zig |
| --- | --- | --- | --- | --- |
| 单静态二进制 | `CGO_ENABLED=0 go build`（PocketBase README） | musl ~4MB 常见 | `bun build --compile` **仍嵌入 Bun runtime**（[Bun executables](https://bun.com/docs/bundler/executables)）；`deno compile` 嵌入 denort | Py 否；Zig 9.8KiB hello 但生态不够 |
| Agent 冷启动 | 毫秒级原生 | 毫秒级原生 | 编译后快于 `bun run`，仍是 JS VM | 差 |
| 纯 runtime（wrap/CSP/scan） | 普通 string 包 | 普通；Workers 文档支持整份 Rust Wasm | **Hono 在 Workers 最顺**，那是 JS 不是「无 JS core」 | — |
| SQLite（适配器） | **默认 `modernc.org/sqlite` 无 CGO**（PocketBase go.mod）；Crush 同时用 modernc + ncruces wasm。**拒绝 `mattn/go-sqlite3` 作默认**（要 gcc + `CGO_ENABLED=1`） | rusqlite `bundled` 用 cc 编进 C SQLite | bun:sqlite 绑 Bun，**不是** Workers；better-sqlite3 是 native addon | — |
| HTTP | stdlib `net/http`；chi ~1000 LOC 无依赖 | axum | Hono（跨 Workers/Bun/Deno/Node） | — |
| MCP stdio | 官方 [`go-sdk`](https://github.com/modelcontextprotocol/go-sdk)（Crush 已用 v1.7.0） | 社区 crate | 官方 TS SDK | — |
| Desktop | Wails **v2 稳定 / v3 beta**；或 Tauri sidecar。MVP 用 `serve` + 系统浏览器 | Tauri 2 原生 webview | OpenCode desktop = **Electron 包 SolidJS**（[CONTRIBUTING](https://github.com/anomalyco/opencode/blob/dev/CONTRIBUTING.md)） | — |
| Worker 共享 core | Go 1.24 `go:wasmexport` 单线程、指针宽度坑、Workers 启动 1s / gzip 3–10MB。**不要把 Go runtime 当 Worker guest** | workers-rs 是 CF 文档里除 JS 外的整份 Worker 路径 | 直接跑 Hono。**`node:sqlite` 在 Workers 是 stub** | — |
| 1 人 + agent 写代码速度 | 高 | 中（所有权/生命周期税） | 最高（若你已是 TS） | — |

OpenCode 以 TS/Bun 拿到 20 万 star，说明「agent CLI 必须 Go/Rust」是假的。但它的安装故事仍是 curl 脚本 + brew，不是 `npx` 唯一入口。htmlark 的用户是每天跑 Claude Code 的人：二进制或 brew 比 npm 全局包更稳。

### 已锁定（覆盖调研初稿）

**实现：TypeScript + Bun。** Go 是 **rejected alternative**：单二进制更小，但 Worker 无法 `import` 同一份 wrap/CSP/qualityScan，会破坏 D4。本机 `bun compile` hello = 61MB，接受。

- `@htmlark/runtime`：wrap / CSP / scan / tokens / `buildViewerShell`。零 I/O。Worker 与 CLI 同一模块。
- `@htmlark/core`：application commands + `ArtifactRepository` 端口。**禁止** `bun:sqlite` / `node:fs` / Hono。
- `apps/cli`：local-repository（bun:sqlite + CAS）、vendor-cache、cli/http/mcp transports。
- `apps/remote`：D1+R2 适配器 + Hono。v1。
- `apps/web`：Vite + Svelte，静态产物嵌入 CLI。
- 无 DI。Repository 仅本地；v1 云是 ArtifactPublisher。
- 契约：Zod 4；`createLocalApp` / `createPublishApp` 分开；Web 只用 `hc<LocalAppType>`。
- CLI citty + safeParse。MCP `@modelcontextprotocol/server` v2。
- 类型检查 TypeScript 7 `tsc --noEmit` + svelte-check。Playwright MVP。
- Desktop v2；MVP `serve` + 浏览器。

### 多语言？

**已拒绝。** Worker 必须 `import` 同一份 runtime+core。Go 单二进制更小，但破坏该约束。

**契约语言无关、必须冻结的：** id 算法、JSON `--json` 形状、本地 `/v1` 与 v1 publish HTTP、sqlite schema（`user_version`）、CAS 路径 `blobs/sha256/xx/hex`。

---

## 5. 架构：端口，不是 DI 框架

### 主源

Alistair Cockburn, *Hexagonal Architecture* (2005)：应用在内，端口是有目的的对话，适配器把外部技术转成 API。同一端口多个适配器（人、测试、HTTP、mock DB）。[原文](https://alistair.cockburn.us/hexagonal-architecture)

Robert C. Martin, [The Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html) (2012)：依赖规则向内；SQL 留在 interface adapters；跨边界只传简单数据，不是 row 类型。

Martin Fowler, [Hexagonal Architecture](https://martinfowler.com/bliki/HexagonalArchitecture.html)；Dave Cheney, [Solid Go design](https://dave.cheney.net/2016/08/20/solid-go-design)：小接口，`main` 组装。Peter Bourgon / Dave Cheney 的 Go 服务惯例：不要 DI 容器。Google Wire 已 archived。

本仓库 `codebase-design` skill：

- **一个适配器 = 假想 seam。两个适配器 = 真 seam。**
- 接受依赖，不要在模块里 `new`。
- 接口是测试面。

htmlark 已经有两个真变化：本地 sqlite vs 测试 memory；v1 还有 D1+R2。所以 Store/Blob 端口是真的。CLI vs MCP vs HTTP 是**驱动端口**（同一 command 函数），不是三个 domain。

### 推荐 seam（语言中性）

```
                    ┌─────────────┐
  SKILL.md          │  Commands   │  create/update/list/diff/share
  CLI flags    ──►  │  (domain)   │  唯一 writer
  MCP tools         └──────┬──────┘
  HTTP /v1                 │ 用端口，不用 sqlite
            ┌──────────────┼──────────────┐
            ▼              ▼              ▼
        Store          BlobStore        Runtime
     (索引+版本)      (CAS bytes)     (wrap/CSP/scan)
            │              │              │
     sqlite │ memory    fs │ r2      纯函数，无 I/O
     d1     │           s3 │
```

**注入什么：** `Store`, `BlobStore`, `Clock`, `IdGen`, `VendorCache`。  
**不要注入：** `Locker`（flock 是 sqlite 适配器内部；领域并发是 `baseVersion` / `CONFLICT`）；Logger 全局可；JSON 编码器；CSP 字符串构造器（那是 Runtime）。

**Command 签名（示意）：**

```text
Create(ctx, deps, CreateOpts) -> (CreateResult, error)
```

`deps` 是结构体，不是容器。测试里塞 `MemoryStore`。生产 `main` 里组装一次。

### DI 容器？否

1–2 人 CLI 用 fx / wire / tsyringe / inversify 是浅模块：接口几乎等于实现。

Go 惯例：小接口，结构体返回，`main` 组装。PocketBase 用 `pocketbase.NewWithConfig` + 钩子，不是容器。Crush 是普通 Go 二进制。

**两个适配器出现之前不要提抽象。** MVP 就可以有 `MemoryStore`（测试）+ `SqliteStore`（默认）——这正好两个，端口成立。不要为「将来 Postgres」先写 repository 层次。PRD 的库是 CAS+索引，不是通用 ORM。

### Worker 怎么共享

Worker **import runtime + core**（零 I/O）。**禁止** import 本地 bun:sqlite / `node:fs` 适配器。

v1 云不是第三个 `ArtifactRepository`，是 `ArtifactPublisher` + `createPublishApp`（与 `createLocalApp` 分 router）。

Workers 不能跑文件 SQLite；`node:sqlite` 是 stub。D1+R2 只服务 publish/view。

### 迁移

- 本地 schema 权威只有 `PRAGMA user_version`。无 `schema_migrations` 表。
- Blob：CAS；换对象存储只换路径。
- v1 不把 sqlite DDL 复制进 D1 当同一 repository。

---

## 6. 各层框架（少即是多）

| 层 | Go 主推荐 | TS 备选 | 不要 |
| --- | --- | --- | --- |
| CLI | `flag` 起步；子命令多了 [cobra](https://github.com/spf13/cobra)（gh/PocketBase/Crush）。[fang](https://github.com/charmbracelet/fang) 给 cobra 加 styled help/`--version`/completions，**README 标明 experimental** | citty（零依赖，`util.parseArgs`） | 为 TUI 上 bubbletea（MVP 无 TUI） |
| HTTP | `net/http` ServeMux 或 [chi](https://github.com/go-chi/chi)（<1000 LOC、无依赖、Cloudflare/Heroku 在用） | Hono | Gin/Echo/Fastify 无收益。Echo v5 当前，v4 只修到 2026-12-31 |
| MCP | 官方 go-sdk；stdio **禁止**往 stdout 写非 JSON-RPC（[MCP 2025-06-18 transports](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports)）。MCP 与 TUI 不要共进程抢 stdout | `@modelcontextprotocol/sdk` | 第二套 CRUD |
| SQL | `database/sql` + **`modernc.org/sqlite`**；sqlc 可。ncruces = 进程内 Wasm sqlite（Crush 兼用，内存更高） | bun:sqlite 或 drizzle **仅适配器内** | 领域层 ORM；`mattn/go-sqlite3` 作默认（CGO 毁交叉编译） |
| 迁移 | 嵌入 SQL + `user_version` | 同 | Atlas/goose 直到第二份 schema |
| Web gallery | Vite + 轻 UI，只 fetch `/v1`；`go:embed` | 同 | Next.js（这不是站点） |
| 测试 | 标准 `testing` + MemoryStore | node:test / bun:test | 为 I/O 上大测试框架 |
| 发布 | goreleaser（Crush 就是） | bun compile 实验（仍带 JS runtime） | 只发 npm |
| Desktop v2 | Wails **v2**；或 Tauri + sidecar。**不要开 Wails v3 beta 做新产品** | Tauri sidecar | Electron、GPUI（pre-1.0）、Dioxus、Fyne（要 C compiler） |

「框架」在 htmlark 里应该几乎看不见。Cockburn 的点：应用能在没有 UI、没有真数据库时跑回归。

## 7. Desktop（v2）偷什么

PRD：Desktop 是 HTML runtime，不是聊天 IDE。模式名 `sandboxed` / `network-allowlist`。

| 栈 | 何时 |
| --- | --- |
| **Tauri v2 + 自定义协议 + sidecar `htmlark`** | 默认。对齐 HTML Browser、dbx。webview 只渲染；协议 handler 调 Runtime wrap + vendor 缓存。`externalBin` + 锁死 arg allowlist |
| **Wails v2** | core 已是 Go，想少一个 Rust 工具链。v3 仍 beta |
| Neutralino / Lorca | 太瘦，协议/CSP 控制不够 |
| Electron | 体积与 Node 泄漏。dbx README 以「无捆绑 Chromium」为卖点。OpenCode 走这条是因为 UI 已经是 SolidJS |
| GPUI / Dioxus / iced / Fyne | 错问题。产物是 HTML；Fyne 还要 C 编译器 |

隔离边界（DesktopAgentsX）：

1. **Sidecar**：同一 `htmlark` 二进制，不要在 webview 里重写 store。
2. **自定义协议**（`htmlark://` / `artifact://`）从库里出 HTML/MD。禁止 `file://`，禁止给不可信内容开宽 localhost。
3. Preview webview：**零** FS/shell/网络，只走协议 handler。

偷 HTML Browser：`htmlartifact://`、live reload、按工作区网络。**不要**偷 Safe=禁 JS 的词（PRD D8）。

偷 dbx：桌面与 CLI 分发通道分开；MCP 不塞进 .app。

MVP/v1 不要写 `desktop/`。`htmlark serve` + 系统浏览器就是预览。

---

## 8. Agent 表面

规范：

- Skills：[agentskills.io/specification](https://agentskills.io/specification) — `name`/`description` 必填；主体建议 &lt;5000 token；references 按需加载。
- MCP：stdio 本地（客户端 spawn 子进程；stdout **只能** JSON-RPC）；远端是 Streamable HTTP。PRD remote MCP 无 list。

偷 gh/dbx/jj/Codex：

- `--json` opt-in（PRD D20）。Skill **强制**带。gh 还有 `--json fields` / JMESPath。
- 稳定字段，不把 TTY 装饰塞进 JSON。长任务用 JSONL（Codex/OpenCode）。
- 冲突：`code=CONFLICT` + `--base-version`（PRD D17），不要交互 prompt（agent 过不了）。
- dbx：MCP 可指向 Web URL。htmlark v1 SaaS 就是这个（连用户 remote）。
- Codex：人话走 stderr，机器走 stdout。MCP 同纪律。

产品要 **ship** 的 skill：`htmlark-authoring`（PRD M7）。教：先 list，再 create/update 同一 id，禁 CDN，必须 `--json`。

---

## 9. X / 独立开发者话语（能引用的）

`site:x.com` 本轮无结果。能钉到一等来源的：

| 声音 | 出处 | 对 htmlark |
| --- | --- | --- |
| Ben Johnson「all-in on sqlite」 | [fly.io/blog/all-in-on-sqlite-litestream](https://fly.io/blog/all-in-on-sqlite-litestream/)（@benbjohnson） | 默认 sqlite。复制是旁路（Litestream），不是换 Postgres。应用仍用标准 sqlite |
| Cockburn 端口 | [hexagonal-architecture](https://alistair.cockburn.us/hexagonal-architecture) | UI 与 DB 对称：都在外面 |
| Charm Crush | [charm.land/blog/crush-comes-home](https://charm.land/blog/crush-comes-home/) | Go TUI agent 单二进制 |
| OpenCode | [opencode.ai](https://opencode.ai) / [x.com/opencode](https://x.com/opencode) | TS 也能做头牌 agent CLI；仍发原生安装 |
| PocketBase | 官方 README | 「后端一个文件」= CLI+HTTP+sqlite |
| dbx | README | 20 MB、CLI+Desktop+Web+MCP |

 indie 共识（从这些来源归纳，不是某条推）：单二进制、sqlite、CLI `--json`、MCP、桌面用 Tauri 而非 Electron。**没有**「必须 DI 容器」或「必须 TS monorepo」。

---

## 10. 开发 htmlark 用哪些 skill

分三类。

### A. 现在就该装（写这个仓库）

来自 [skills.sh](https://www.skills.sh/) 排行榜与本会话已有 skill：

| skill | 用途 |
| --- | --- |
| `codebase-design` / `improve-codebase-architecture`（mattpocock/skills） | seam、深度模块、两个适配器才抽象 |
| `domain-modeling` | artifact/version/share/dirty 的语言 |
| `tdd` | command 函数 + MemoryStore |
| `writing-for-agents` / `writing-great-skills` / anthropics `skill-creator` | 产品 skill 本身 |
| `frontend-design` / `design-taste-frontend` | gallery，反模板 |
| `diagnosing-bugs` / `code-review` | 合并前 |
| `grill-me` / `grilling` | 开写前压测本推荐 |

语言向（按所选栈装，不要全装）：

| 若 Bun（已锁） | citty / Hono / `bun:test`；[mcp-builder](https://www.skills.sh/anthropics/skills/mcp-builder) |
| --- | --- |
| 若仍翻 Go（已拒绝） | 不要装。Worker 同实现优先于体积 |
| 若 Rust+Tauri v2 | [tauri-v2](https://www.skills.sh/nodnarbnitram/claude-code-extensions/tauri-v2)（安装量低，先核源码再装）；[tauri-app-sql](https://www.skills.sh/full-stack-skills/tauri-skills/tauri-app-sql) 仅 Desktop |
| MCP | [anthropics mcp-builder](https://www.skills.sh/anthropics/skills/mcp-builder) |
| 通用 | `npx skills add <owner/repo>`（[find-skills](https://www.skills.sh/vercel-labs/skills/find-skills)） |

装之前核：安装量、官方源、星标。排行榜上很多 Lark/Azure/视频 skill 与 htmlark 无关。

### B. 产品要 ship

- `skills/htmlark-authoring/SKILL.md`（agentskills.io 形状）
- `references/`：质量门、vendor pin、CONFLICT 协议、JSON schema
- 可选 `scripts/`：无。agent 调 `htmlark` CLI，不要再包一层 Python

### C. 不要当框架用的 skill

`supabase-postgres-best-practices`：htmlark 不是 Postgres 应用。本地 sqlite，远端 D1。Postgres 指南会把 schema 带偏。

---

## 11. 决策（已锁定，改 PRD 后写代码）

1. **TypeScript + Bun。** Go 因「同一 runtime 跨 CLI/Worker import」拒绝。
2. **无 DI。** `main` 组装 `ArtifactRepository`。适配器：`SqliteCasRepository`、`MemoryRepository`；v1 `D1R2Repository`。
3. **runtime 零 I/O。** Worker import `runtime` + `core`，不 import 本地适配器。
4. **唯一 writer = core command functions。** CLI / HTTP / MCP 是 driving adapters。
5. **sqlite 是本地适配器。** 并发用 `BEGIN IMMEDIATE` + `busy_timeout`，不是 POSIX flock。FTS/flock 不进 domain。
6. **分发：** GH `bun compile` → Homebrew。npm 只做可选 launcher，或要求已装 Bun。禁止把 `npx` 写成唯一入口。
7. **MVP 不做 Desktop、LAN、FTS、remote。** 不能砍：viewer escaping、loopback Host/Origin/token、CAS 崩溃顺序、runtime 契约测试。

### 对 PRD 的补丁（本轮落地）

- D6：可复现收窄为 authored 不变 + **同一 runtime release** 下 render deterministic。
- D7：writer 是 core commands，不是 CLI。
- D16：core 零平台 I/O；Worker 可 import core+runtime。
- D26+：loopback 鉴权、CAS 顺序、JSON 无 CAS path、D1 只做索引、version 元数据快照、vendor GET 不回源。
- PR-01：`bun` workspace，不是 pnpm/Node≥22 / `go mod`。
