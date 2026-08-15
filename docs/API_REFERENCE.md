# OmniLink AI - REST API & Schema Reference

OmniLink AI exposes a RESTful API with runtime **Zod** schema validation, global error boundaries, and SQLite transaction safety.

Base URL: `http://localhost:3000`

---

## 📑 1. Bookmarks & CRUD Endpoints

### `GET /api/links`
Retrieve bookmarks with optional sorting and filtering.
- **Query Parameters**:
  - `search` (string): Search query
  - `category` (string): Filter by category
  - `platform` (string): Filter by platform (`github`, `paper`, `article`, `youtube`, `reddit_post`, `instagram_short`, etc.)
  - `tag` (string): Filter by tag
  - `readStatus` (string): `unread` | `reading` | `read` | `all`
  - `onlyFavorites` (boolean): `true` | `false`
  - `includeArchived` (boolean): `true` | `false`
- **Response**: `{ "links": LinkItem[] }`

### `POST /api/links`
Add a new bookmark with automatic AI metadata extraction and background vector indexing.
- **Request Body (Zod `CreateLinkSchema`)**:
  ```json
  {
    "url": "https://github.com/astral-sh/uv",
    "title": "Astral UV",
    "notes": "Fast Python package manager",
    "tags": ["python", "rust", "cli"],
    "category": "Dev & Tech",
    "autoAiExtract": true
  }
  ```
- **Response (201 Created)**: `{ "link": LinkItem }`

### `PUT /api/links/:id`
Update an existing bookmark's metadata or status.
- **Request Body (Zod `UpdateLinkSchema`)**: Partial `LinkItem` fields.
- **Response**: `{ "link": LinkItem }`

### `DELETE /api/links/:id`
Permanently delete a bookmark and its associated vector embeddings.
- **Response**: `{ "success": true, "id": string }`

### `POST /api/links/batch`
Perform batch status changes, categorization, or deletion across multiple links.
- **Request Body (Zod `BatchActionSchema`)**:
  ```json
  {
    "ids": ["link-1", "link-2"],
    "action": "mark_read" | "mark_unread" | "mark_reading" | "archive" | "unarchive" | "favorite" | "unfavorite" | "delete" | "change_category" | "add_tag" | "remove_tag",
    "value": "Optional string value for change_category / add_tag"
  }
  ```

---

## ⚡ 2. Mobile Ingress & Quick Capture

### `POST /api/share/quick`
Fast headless ingress for Apple Shortcuts, Android Share Targets, Raycast, and Webhook bots.
- **Request Body**:
  ```json
  {
    "url": "https://instagram.com/reel/123",
    "title": "Optional Title",
    "notes": "Optional notes or commentary",
    "tags": ["design", "mobile-share"]
  }
  ```
- **Features**: Automatically handles strings where the URL is embedded inside the `text` parameter. Deduplicates against existing bookmarks.
- **Response (201 Created)**:
  ```json
  {
    "success": true,
    "message": "Saved: \"Astral UV\"",
    "link": LinkItem
  }
  ```

---

## 🔍 3. Hybrid Search & Vector Retrieval

### `POST /api/ai/search/hybrid`
Search your repository using FTS5 lexical BM25 + Gemini Dense Vectors + Reciprocal Rank Fusion (RRF).
- **Request Body (Zod `HybridSearchSchema`)**:
  ```json
  {
    "query": "vector database sqlite",
    "category": "Dev & Tech",
    "platform": "all",
    "readStatus": "all",
    "limit": 10
  }
  ```
- **Response**:
  ```json
  {
    "results": [
      {
        "link": LinkItem,
        "rrfScore": 0.03278,
        "ftsRank": 1,
        "vectorSimilarity": 0.89,
        "matchReasons": [
          "FTS5 Lexical Match (Rank #1)",
          "Semantic Vector Match (89% similarity, Rank #1)"
        ]
      }
    ]
  }
  ```

### `GET /api/ai/embeddings/status`
Inspect real-time vector embedding index telemetry.
- **Response**:
  ```json
  {
    "total": 120,
    "indexed": 120,
    "unindexed": 0,
    "isIndexing": false
  }
  ```

### `POST /api/ai/embeddings/reindex`
Trigger background re-indexing of all bookmarks missing dense vector embeddings.

---

## 📖 4. Offline Reader Mode & Readability

### `GET /api/links/:id/reader`
Retrieve the clean, distraction-free Markdown reader snapshot for a bookmark.
- **Response**: `{ "snapshot": ReaderSnapshot }`

### `POST /api/links/:id/reader/snapshot`
Trigger a fresh Mozilla Readability DOM parse and Markdown generation for a link.
- **Response**: `{ "snapshot": ReaderSnapshot }`

---

## 💬 5. AI RAG & Synthesis

### `POST /api/ai/ask`
Ask questions over your entire personal knowledge repository with grounded hybrid search citations.
- **Request Body (Zod `AskRepoSchema`)**:
  ```json
  {
    "question": "What tools do I have bookmarked for SQLite embeddings?",
    "category": "Dev & Tech",
    "preferredModel": "gemini-3.7-flash"
  }
  ```
- **Response**:
  ```json
  {
    "answer": "Based on your library...",
    "modelUsed": "gemini-3.7-flash",
    "sources": [
      {
        "id": "link-1",
        "title": "sqlite-vec repository",
        "url": "https://github.com/asg017/sqlite-vec",
        "category": "Dev & Tech",
        "similarity": 0.91,
        "score": 0.032
      }
    ]
  }
  ```

---

## 🛡️ 6. Error Responses

When a request fails schema validation or resource lookup, OmniLink returns structured error JSON:

```json
// HTTP 400 Bad Request (Validation Failure)
{
  "error": "Validation failed: url (Invalid url)",
  "issues": [
    {
      "code": "invalid_string",
      "path": ["url"],
      "message": "Invalid url"
    }
  ]
}

// HTTP 404 Not Found
{
  "error": "Link not found."
}
```
