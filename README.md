# onenote-mcp

[![npm version](https://img.shields.io/npm/v/onenote-mcp.svg)](https://www.npmjs.com/package/onenote-mcp)
[![CI](https://github.com/ahmadAlMezaal/onenote-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/ahmadAlMezaal/onenote-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

An [MCP](https://modelcontextprotocol.io) server for **Microsoft OneNote**. Bring your notebooks into Claude, Cursor, and any MCP-compatible client — list notebooks and sections, full-text search across pages, read individual pages, and create or delete pages from natural language. Authentication uses Microsoft's device-code flow against your own Entra ID app registration, so your data and credentials never leave your machine.

> _Screenshot/demo coming soon — drop a GIF in `docs/images/demo.gif` and reference it here._

---

## Quick start

### 1. Register a Microsoft Entra app

The server talks to Microsoft Graph using a Microsoft Entra (Azure AD) **app registration** that you own. This takes about 2 minutes.

> Screenshots referenced below live in [`docs/images/`](docs/images/). They are placeholders today — contributions welcome.

#### a. Create the registration

1. Go to the [Microsoft Entra admin center → App registrations](https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade) and click **+ New registration**.
2. **Name**: anything (e.g. `onenote-mcp`).
3. **Supported account types**: choose **"Accounts in any organizational directory and personal Microsoft accounts"** if you want both work and personal OneNote to work; otherwise pick what matches your tenant.
4. **Redirect URI**: leave blank — the device-code flow doesn't need one.
5. Click **Register**.

   ![Register an application](docs/images/01-register.png)

#### b. Add the API permissions

1. In the new app's left nav, click **API permissions** → **+ Add a permission** → **Microsoft Graph** → **Delegated permissions**.
2. Search for and check both:
   - `Notes.ReadWrite`
   - `offline_access`
3. Click **Add permissions**. (No admin consent is required for personal Microsoft accounts. Work/school tenants may need an admin to grant consent for the directory.)

   ![Add Notes.ReadWrite + offline_access](docs/images/02-permissions.png)

#### c. Allow the public client flow

The device-code flow is a "public client" flow — it doesn't use a client secret.

1. Go to **Authentication** in the left nav.
2. Scroll to **Advanced settings** → **Allow public client flows** and toggle it **Yes**.
3. Click **Save**.

   ![Allow public client flows](docs/images/03-public-client.png)

#### d. Grab the client ID

Back on the app's **Overview** page, copy the **Application (client) ID**. You'll pass it to the server via the `ONENOTE_MCP_CLIENT_ID` environment variable.

  ![Application (client) ID on the Overview page](docs/images/04-client-id.png)

### 2. Sign in

```sh
ONENOTE_MCP_CLIENT_ID=<your-app-client-id> npx onenote-mcp login
```

This prints a code and a URL like:

```
To sign in, use a web browser to open https://microsoft.com/devicelogin
and enter the code ABCD-1234 to authenticate.
```

Open the URL, paste the code, sign in with the Microsoft account whose OneNote you want to access, and approve the requested permissions. The refresh token is then cached at `~/.config/onenote-mcp/tokens.json` (mode `600`) so the MCP server can run silently.

To sign out:

```sh
npx onenote-mcp logout
```

### 3. Wire it into your MCP client

#### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```jsonc
{
  "mcpServers": {
    "onenote": {
      "command": "npx",
      "args": ["-y", "onenote-mcp"],
      "env": {
        "ONENOTE_MCP_CLIENT_ID": "your-app-client-id"
      }
    }
  }
}
```

Restart Claude Desktop. The OneNote tools should appear in the tool picker.

#### Cursor

Add to `~/.cursor/mcp.json`:

```jsonc
{
  "mcpServers": {
    "onenote": {
      "command": "npx",
      "args": ["-y", "onenote-mcp"],
      "env": {
        "ONENOTE_MCP_CLIENT_ID": "your-app-client-id"
      }
    }
  }
}
```

#### Anything else

Any MCP-compatible client that supports stdio servers will work. Run `onenote-mcp` with `ONENOTE_MCP_CLIENT_ID` set in the environment.

---

## Tools

| Tool             | Description                                                     | Key inputs                                       |
| ---------------- | --------------------------------------------------------------- | ------------------------------------------------ |
| `list_notebooks` | Lists all OneNote notebooks for the signed-in user.             | _(none)_                                         |
| `list_sections`  | Lists sections, optionally scoped to a single notebook.         | `notebookId?`                                    |
| `search_pages`   | Full-text search across pages (title + content).                | `query`, `limit?`                                |
| `read_page`      | Returns page metadata + content (HTML or Markdown).             | `pageId`, `format?` (`html` \| `markdown`)       |
| `create_page`    | Creates a page in a section. Accepts Markdown (default) or HTML. | `sectionId`, `title`, `content`, `format?`       |
| `delete_page`    | Permanently deletes a page. **Irreversible.**                   | `pageId`                                         |

---

## Configuration

| Env var                    | Required | Description                                                                       |
| -------------------------- | -------- | --------------------------------------------------------------------------------- |
| `ONENOTE_MCP_CLIENT_ID`    | yes      | Application (client) ID of your Microsoft Entra app registration.                  |
| `ONENOTE_MCP_TENANT_ID`    | no       | Tenant ID. Defaults to `common`, which works for both personal and work accounts. |
| `XDG_CONFIG_HOME`          | no       | Override the config directory. Tokens are stored at `<dir>/onenote-mcp/tokens.json`. |

---

## Known limitations

- **No in-place page editing in v1.** Microsoft Graph's `PATCH /pages/{id}/content` requires you to target individual elements by their `data-id` attributes, which is fiddly to expose as a useful tool. Tracked for a future release — see the roadmap below. _(coming soon)_
- **No section or notebook creation in v1.** You can create pages inside existing sections; create sections/notebooks via the OneNote UI for now. _(coming soon)_
- **No attachment / image upload in v1.** Pages with embedded binary content require multipart bodies. _(coming soon)_
- **Search latency.** Microsoft Graph's `$search` against `/me/onenote/pages` can take a few seconds against large notebooks; the server retries on 429s with exponential backoff.

---

## Contributing

PRs welcome. The codebase aims to stay small and focused.

```sh
git clone https://github.com/ahmadAlMezaal/onenote-mcp
cd onenote-mcp
npm install
npm run build
npm test
```

- `npm run typecheck` — `tsc --noEmit`
- `npm run lint` — ESLint
- `npm test` — Vitest
- `npm run dev` — TypeScript in watch mode

Commits follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:`, etc.). CI runs typecheck + lint + tests on every push and PR.

### Roadmap

- [ ] `update_page` — in-place edits via Graph's `PATCH` syntax
- [ ] `create_section` / `create_notebook`
- [ ] Image and attachment upload (multipart create_page)
- [ ] Section group support
- [ ] Resource-style page browsing (alongside the tool surface)

---

## License

[MIT](LICENSE) © Ahmad Al Mezaal
