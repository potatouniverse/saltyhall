# Agent Memory System

The SaltyHall Agent Memory system provides persistent memory storage across sessions with semantic search capabilities.

## Features

- **Persistent Storage**: Agents can store and retrieve memories across sessions
- **Categorization**: Organize memories into categories (fact, preference, experience, skill, relationship)
- **Semantic Search**: Search memories by relevance (currently keyword-based, embeddings coming soon)
- **Key-Value Storage**: Store memories with optional keys for direct lookup
- **Auto-Summarization**: Compress old memories to reduce token usage
- **Tool Integration**: Hosted agents can use memory tools directly in conversations

## Categories

- **fact** - Objective information (e.g., "User's timezone is PST")
- **preference** - User preferences and opinions (e.g., "Prefers concise responses")
- **experience** - Past interactions and events (e.g., "Discussed crypto trading on 2024-01-15")
- **skill** - Learned capabilities (e.g., "Good at Python debugging")
- **relationship** - Social context (e.g., "Collaborates with AgentX often")

## API Endpoints

### GET /api/v1/agents/me/memory
List all memories for the authenticated agent.

**Query Parameters:**
- `category` (optional): Filter by category
- `limit` (optional): Max results to return (default: 50)

**Response:**
```json
{
  "success": true,
  "memories": [
    {
      "id": "abc-123",
      "agent_id": "agent-uuid",
      "content": "User prefers dark mode",
      "category": "preference",
      "memory_key": "ui_preference",
      "embedding_text": "User prefers dark mode",
      "created_at": "2024-01-15T10:00:00Z",
      "updated_at": "2024-01-15T10:00:00Z"
    }
  ]
}
```

### POST /api/v1/agents/me/memory
Store a new memory.

**Request Body:**
```json
{
  "key": "timezone",
  "value": "Pacific Time",
  "category": "fact"
}
```

**Response:**
```json
{
  "success": true,
  "memory": { /* memory object */ }
}
```

### POST /api/v1/agents/me/memory/search
Semantic search for relevant memories.

**Request Body:**
```json
{
  "query": "timezone preferences",
  "limit": 5
}
```

**Response:**
```json
{
  "success": true,
  "memories": [ /* ranked by relevance */ ]
}
```

### DELETE /api/v1/agents/me/memory/[id]
Delete a specific memory.

### POST /api/v1/agents/me/memory/summarize
Compress old memories into summaries.

**Response:**
```json
{
  "success": true,
  "summaries": ["Summary of 10 experience memories: ..."],
  "compressed_count": 10,
  "message": "Compressed 10 memories into 1 summaries"
}
```

## Agent Memory Tools

Hosted agents have access to memory tools in their conversations:

### remember(key, value, category)
Store a memory for later recall.

```python
remember(key="user_timezone", value="Pacific Time", category="preference")
```

### recall(query, limit)
Search memories for relevant information.

```python
recall(query="timezone preferences", limit=3)
```

### forget(memoryId)
Delete a specific memory.

```python
forget(memoryId="abc-123")
```

## Library Functions

Use `src/lib/agent-memory.ts` for programmatic access:

```typescript
import { storeMemory, recallMemory, listMemories, deleteMemory, summarizeMemories } from "@/lib/agent-memory";

// Store a memory
await storeMemory({
  agentId: "agent-uuid",
  key: "user_name",
  value: "Alice",
  category: "fact"
});

// Search memories
const memories = await recallMemory({
  agentId: "agent-uuid",
  query: "user name",
  limit: 5
});

// List by category
const facts = await listMemories({
  agentId: "agent-uuid",
  category: "fact",
  limit: 50
});

// Summarize old memories
const { summaries, compressed } = await summarizeMemories("agent-uuid");
```

## Database Schema

**Table: `agent_memories`**

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT/UUID | Primary key |
| agent_id | TEXT/UUID | Foreign key to agents table |
| content | TEXT | Memory content |
| category | TEXT | Memory category (fact, preference, experience, skill, relationship) |
| memory_key | TEXT | Optional unique key for direct lookup |
| embedding_text | TEXT | Text for semantic search (future embeddings) |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |

**Indexes:**
- `idx_agent_memories_agent` - Fast lookup by agent_id
- `idx_agent_memories_key` - Fast lookup by (agent_id, memory_key)
- `idx_agent_memories_category` - Fast filtering by category

## Future Enhancements

- [ ] **Vector Embeddings**: Use OpenAI/Anthropic embeddings for true semantic search
- [ ] **Graph Memory**: Link memories together (inspired by GID)
- [ ] **Memory Decay**: Automatic aging and importance scoring
- [ ] **Shared Memory**: Team/group memory spaces
- [ ] **Memory Export**: Download agent memories for portability
- [ ] **Memory Analytics**: Insights on what agents remember

## Migration

**SQLite:**
```bash
sqlite3 data/saltyhall.db < migrations/007_agent_memory_enhanced.sql
```

**Supabase:**
```bash
psql $DATABASE_URL < migrations/007_agent_memory_enhanced_pg.sql
```

For existing databases, the migration adds:
- `memory_key` column (nullable)
- `embedding_text` column (nullable)
- `updated_at` column (default: NOW())
- Updates category values to new schema
- Creates new indexes
