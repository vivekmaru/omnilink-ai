# OmniLink AI - Model Context Protocol (MCP) Integration Guide

The OmniLink MCP Server connects your personal SQLite knowledge repository to LLMs and AI Agents (Claude Desktop, Cursor, Antigravity, Zed, and autonomous agent frameworks) over the standard **Model Context Protocol (MCP)** via **STDIO** transport.

---

## 🚀 Quick Setup

### 1. Claude Desktop Setup

Open your Claude Desktop configuration file:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

Add the `omnilink` server definition to `mcpServers`:

```json
{
  "mcpServers": {
    "omnilink": {
      "command": "npx",
      "args": [
        "-y",
        "tsx",
        "/absolute/path/to/omnilink-ai/server/mcpServer.ts"
      ],
      "env": {
        "GEMINI_API_KEY": "YOUR_GEMINI_API_KEY",
        "OMNILINK_MODE": "multi-user",
        "OMNILINK_SERVICE_TOKEN": "YOUR_SCOPED_SERVICE_TOKEN",
        "OMNILINK_AI_QUOTA_MONTHLY_UNITS": "1000000"
      }
    }
  }
}
```

> **Note**: Replace the path and placeholders with values from your installation. Local mode needs neither a service token nor a quota. A multi-user MCP process also inherits the complete Phase 1B OIDC/application-origin environment contract; the shortened JSON above shows only the MCP-specific additions. Its revocable token needs `repository:read` for retrieval, `repository:write` for saves, and `ai:execute` for synthesis or embedding queries. The raw token is shown only when created and must be supplied through `OMNILINK_SERVICE_TOKEN`, never a command-line URL.

Restart Claude Desktop. You will see a hammer icon (`🛠️`) indicating that OmniLink tools and resources are active.

---

### 2. Cursor IDE Setup

1. In Cursor, open **Settings** (`Cmd + ,` or `Ctrl + ,`).
2. Navigate to **Features** &rarr; **MCP Servers**.
3. Click **Add New MCP Server**:
   - **Name**: `omnilink`
   - **Type**: `command`
   - **Command**: `npx -y tsx /absolute/path/to/OmniLink/server/mcpServer.ts`
4. Cursor Composer and Chat can now directly query your OmniLink bookmarks while writing code!

---

### 3. Running Standalone via Terminal

You can start the MCP Server directly in your terminal:

```bash
# Using npm script
npm run mcp

# Using npx tsx directly
npx tsx server/mcpServer.ts
```

---

## 🛠️ Available MCP Tools

| Tool Name | Description | Key Parameters |
| :--- | :--- | :--- |
| `search_repository` | Performs **Hybrid Search** (SQLite FTS5 BM25 + Gemini Dense Vector Embeddings + RRF Fusion). | `query` (required), `category`, `platform`, `readStatus`, `limit` |
| `save_bookmark` | Saves a URL to OmniLink with automated AI categorization, summary, and vector indexing. | `url` (required), `title`, `notes`, `tags`, `category` |
| `get_article_snapshot` | Retrieves the distraction-free, clean Markdown article snapshot cached in SQLite. | `id_or_url` (required) |
| `ask_repository` | Grounded conversational RAG question-answering with source citations. | `question` (required), `category` |
| `list_recent_bookmarks` | Lists recent bookmarks with status and tag metadata. | `limit`, `readStatus` (`unread`, `reading`, `read`, `all`), `category` |
| `get_repository_stats` | Returns total bookmark count, unread count, and vector index health metrics. | *None* |

---

## 📦 Available MCP Resources

| URI | Content Description |
| :--- | :--- |
| `omnilink://library/stats` | JSON object of overall repository statistics, reading counts, and categories. |
| `omnilink://library/unread` | Markdown list of all unread inbox items waiting to be reviewed. |

---

## 💡 Example Prompt Workflows in Claude / Cursor

### 1. Researching a Saved Topic
> *"Claude, use OmniLink to find all my saved bookmarks regarding SQLite WAL mode and vector embeddings. Synthesize a comparison of how they handle indexing."*

Claude will automatically call `search_repository({ query: "SQLite WAL vector embeddings" })` and synthesize a grounded answer using your library.

### 2. Saving a Discovery While Chatting
> *"Bookmark this repository to OmniLink: https://github.com/astral-sh/uv with notes 'Super fast Python package manager in Rust'."*

Claude will call `save_bookmark({ url: "https://github.com/astral-sh/uv", notes: "Super fast Python package manager in Rust" })` and confirm the save.

### 3. Reading Full Articles in Distraction-Free Markdown
> *"Retrieve the full article snapshot for my saved link on Direct Preference Optimization and extract the 3 primary mathematical formulas."*

Claude will call `get_article_snapshot({ id_or_url: "https://arxiv.org/abs/..." })` and analyze the cached Markdown body.
