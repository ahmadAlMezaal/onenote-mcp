# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- `--help`, `--version` and the version reported to MCP clients now come from `package.json`. Releases 0.2.1 and 0.2.2 reported themselves as 0.2.0.

## [0.2.2] - 2026-10-01

### Fixed

- `read_page` no longer returns the page title, inline CSS or scripts from the HTML `<head>` as part of the page's markdown.
- Updating a page title with multi-paragraph markdown no longer sends unbalanced HTML to Graph.

### Changed

- Validation errors use Zod 4's `error` option instead of the deprecated `message`. No change in behaviour.
- Dependencies updated, and the release and Docker image now build on Node 24 LTS.

## [0.2.1] - 2026-09-30

### Changed

- **The package has moved to the `@onelastcommit` organisation.** It is now published as `@onelastcommit/onenote-mcp`, and the repository lives at `onelastcommit/onenote-mcp`. `@1percentlabs/onenote-mcp` is deprecated and frozen at `0.2.0`. Docker images are now published to `ghcr.io/onelastcommit/onenote-mcp`. No code changes.

## [0.2.0] - 2026-07-21

### Changed

- **The package has moved to the `@1percentlabs` organisation.** It is now published as `@1percentlabs/onenote-mcp`; the old `@atomiclabs97/onenote-mcp` is deprecated and will receive no further releases. Update any `npx`, `args`, or dependency reference to the new name. Versioning continues unbroken from `0.1.1` — nothing was reset. npm cannot rename a published package, so this is a republish under a new name rather than a transfer; the old package remains installable but frozen at `0.1.1`.

### Added

- **HTTP (Streamable HTTP) transport** with bearer-token auth, gated by the new `ONENOTE_MCP_HTTP_TOKEN` env var. Boot with `npx @1percentlabs/onenote-mcp --transport http --port 3000`. Mounts the existing tool surface on `POST/GET/DELETE /mcp` so [claude.ai](https://claude.ai) Connectors and other remote MCP clients can reach a self-hosted instance. Constant-time bearer comparison; missing or wrong token → `401`. Server refuses to start in HTTP mode without a token configured.
- `GET /healthz` unauthenticated endpoint for platform health checks.
- `--host` / `--port` CLI flags (with matching `ONENOTE_MCP_HTTP_HOST` / `ONENOTE_MCP_HTTP_PORT` env vars). Defaults to `127.0.0.1:3000` — set `--host 0.0.0.0` for container / PaaS deployments.
- **Self-hosted deployment support.** Multi-stage `Dockerfile` and `fly.toml` template; release workflow now publishes a Docker image to the GitHub Container Registry (`ghcr.io/ahmadalmezaal/onenote-mcp`) on every version tag. Copy-paste deployment guides for [Fly.io](docs/deployment/fly.md) and [Docker / VPS](docs/deployment/docker.md), plus a [claude.ai Connector walkthrough](docs/deployment/claude-ai-connector.md).
- `ONENOTE_MCP_TOKEN_CACHE` env var — seeds the token cache from a `tokens.json` produced by `onenote-mcp login` elsewhere, so headless hosts with no TTY can run the HTTP transport. Applied only in `--transport http` mode when no cached token exists yet.

### Unchanged

- Stdio remains the default transport. Existing Claude Desktop / Cursor / Claude Code configs continue to work with no changes.

## [0.1.1] - 2026-05-16

### Fixed

- Publish under the correct npm scope `@atomiclabs97`. The `0.1.0` tag was prepared under `@atomiclabs` but that org doesn't exist on npm; nothing reached the registry under that name. `0.1.1` is the first version actually available via `npx`.

## [0.1.0] - 2026-05-15

Initial public release.

### Tools

11 tools, all input-validated with zod and routed through a shared Microsoft Graph client (single retry / auth / error-shaping path):

- `list_notebooks` — list all OneNote notebooks for the signed-in user
- `list_sections` — list sections, optionally scoped to a notebook
- `list_section_groups` — list section groups (folders), optionally scoped to a notebook
- `search_pages` — full-text search across page titles and content
- `read_page` — fetch page metadata + content as raw HTML or converted Markdown
- `create_notebook` — create a top-level notebook
- `create_section` — create a section inside a notebook or section group
- `create_section_group` — create a section group inside a notebook or another section group
- `create_page` — create a page from Markdown (default) or HTML, with optional binary attachments uploaded via multipart
- `update_page` — apply append / prepend / insert / replace / delete operations to elements on an existing page
- `delete_page` — permanently delete a page

### Authentication

- Device-code OAuth flow against a user-owned Microsoft Entra app registration via `@azure/msal-node`
- Persistent refresh-token cache at `~/.config/onenote-mcp/tokens.json` (mode `0600`), respecting `XDG_CONFIG_HOME`
- `login` and `logout` CLI subcommands

### Server

- Stdio MCP transport via `@modelcontextprotocol/sdk`
- Markdown ↔ OneNote-HTML conversion (marked + turndown)
- Exponential backoff on Graph `429`s
- Typed wrappers for every Graph resource the tools touch

### Developer experience

- TypeScript strict mode, `@/*` import alias rewritten to relative paths at build time via `tsc-alias`
- ESLint flat config + Vitest
- End-to-end smoke script (`yarn smoke`) that exercises every tool against a real OneNote account
- GitHub Actions: CI (typecheck / lint / test / build on every push and PR) + Release (npm publish with provenance on `v*.*.*` tag)

[Unreleased]: https://github.com/onelastcommit/onenote-mcp/compare/v0.2.2...HEAD
[0.2.2]: https://github.com/onelastcommit/onenote-mcp/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/onelastcommit/onenote-mcp/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/onelastcommit/onenote-mcp/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/onelastcommit/onenote-mcp/releases/tag/v0.1.1
[0.1.0]: https://github.com/onelastcommit/onenote-mcp/releases/tag/v0.1.0
