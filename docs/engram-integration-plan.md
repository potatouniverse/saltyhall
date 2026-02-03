# Engram Integration Plan for SaltyHall Agent Memory

**Status:** Planning  
**Created:** 2025-02-02  
**Author:** Clawd (AI Agent)

## Executive Summary

This document outlines the plan to upgrade SaltyHall's naive keyword-based memory system to a cognitive memory architecture powered by neuromemory-ai. The integration will provide ACT-R-based activation scoring, memory consolidation, intelligent forgetting, and graph-based entity relationships — enabling agents to recall memories more naturally and maintain long-term context across sessions.

**Key Constraint:** SaltyHall runs on Vercel serverless, so we cannot use neuromemory-ai's SQLite backend directly. Instead, we'll implement a Supabase store backend following engram's pluggable store design.

---

## 1. Current State Analysis

### 1.1 Existing Memory System (`src/lib/agent-memory.ts`)

**Current Capabilities:**
- **Categories:** 5 types (fact, preference, experience, skill, relationship)
- **Storage:** Basic CRUD via Supabase (`agent_memories` table)
- **Recall:** Naive keyword matching with simple scoring
- **Summarization:** Groups old memories by category and creates summaries

**Schema (agent_memories table):**
```sql
CREATE TABLE agent_memories (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT DEFAULT 'experience',
  memory_key TEXT,
  embedding_text TEXT, -- Prepared for semantic search, unused
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

**Current API:**
- `storeMemory({ agentId, key?, value, category? })`
- `recallMemory({ agentId, query, limit? })`
- `listMemories({ agentId, category?, limit? })`
- `deleteMemory(agentId, memoryId)`
- `summarizeMemories(agentId)`

**Limitations:**
1. No temporal dynamics — recent and ancient memories treated equally
2. No activation scoring — can't prioritize frequently-accessed memories
3. No forgetting — memory grows indefinitely (summarization is manual)
4. No entity graphs — can't trace relationships between concepts
5. No confidence scoring — can't assess memory reliability
6. Keyword search is brittle and misses semantic similarity

---

## 2. Engram-ts Cognitive Memory Features

### 2.1 Core Capabilities

**ACT-R Activation Model:**
- Base-level activation (recency + frequency)
- Spreading activation through entity graphs
- Context-sensitive retrieval

**Memory Consolidation:**
- Working → Core → Archive layer transitions
- Interleaved rehearsal of weak memories
- Synaptic downscaling to prevent runaway activation

**Intelligent Forgetting:**
- Decay curves based on access patterns
- Automatic pruning of low-strength memories
- Retrieval-induced forgetting (strengthens related, weakens others)

**Confidence & Reliability:**
- Content reliability scoring
- Retrieval salience (how often it's accessed)
- Contradiction tracking

**Entity Graph:**
- Link memories to entities (people, concepts, objects)
- Multi-hop graph traversal
- Graph-expanded search

**Reward Learning:**
- Detect positive/negative feedback
- Boost/penalize recently-accessed memories

---

## 3. Engram Features Most Valuable for SaltyHall

### 3.1 Priority Features (Phase 1)

**1. Activation Scoring**
- **Why:** Agents should prioritize recent + frequently-accessed memories
- **Use case:** "What did I learn about this user?" → surface recent interactions first
- **Impact:** More contextually relevant responses

**2. Memory Consolidation**
- **Why:** Long-running agents need memory management
- **Use case:** Nightly consolidation moves old memories to archive, keeps working set lean
- **Impact:** Prevents memory bloat, improves recall speed

**3. Intelligent Forgetting**
- **Why:** Not all memories are worth keeping forever
- **Use case:** Drop low-value memories (e.g., "said hello" spam) automatically
- **Impact:** Cleaner memory, less noise in recall

**4. Entity Graphs**
- **Why:** Agents need to track relationships
- **Use case:** "Tell me about @user" → traverse all memories linked to that entity
- **Impact:** Richer context retrieval

### 3.2 Secondary Features (Phase 2)

**5. Confidence Scoring**
- Assess memory reliability (e.g., contradictions, staleness)
- Surface low-confidence memories with caveats

**6. Reward Learning**
- Boost memories when user gives positive feedback
- Penalize when corrected

**7. Graph Search**
- Multi-hop entity traversal (e.g., "friends of Alice")
- Concept clustering

---

## 4. Supabase Store Backend Design

### 4.1 Architecture

Engram's pluggable store design (see `/Users/potato/clawd/projects/agent-memory-prototype/docs/design/pluggable-store.md`) defines a `Store` interface. We'll implement `SupabaseStore` that translates engram operations to Supabase queries.

**Key Differences from SQLiteStore:**
- Replace FTS5 with Postgres `tsvector` full-text search
- Use `@supabase/supabase-js` client instead of `better-sqlite3`
- All operations are async (SQLite store is sync)
- Add `agent_id` column to scope memories per agent

### 4.2 Schema Changes

**New Tables:**

```sql
-- Core engram memories (extends existing agent_memories)
CREATE TABLE neuromemory_memories (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL, -- SaltyHall addition
  content TEXT NOT NULL,
  memory_type TEXT DEFAULT 'episodic', -- factual | episodic | procedural | semantic
  layer TEXT DEFAULT 'working', -- working | core | archive
  importance REAL DEFAULT 0.5,
  working_strength REAL DEFAULT 1.0,
  core_strength REAL DEFAULT 0.0,
  access_count INTEGER DEFAULT 0,
  consolidation_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_accessed TIMESTAMPTZ DEFAULT NOW(),
  last_consolidated TIMESTAMPTZ,
  source_file TEXT,
  context TEXT, -- JSON array of keywords
  pinned BOOLEAN DEFAULT FALSE,
  contradicts TEXT, -- ID of contradicted memory
  contradicted_by TEXT, -- ID of newer memory
  
  -- SaltyHall-specific fields (preserve existing categories)
  category TEXT, -- fact | preference | experience | skill | relationship
  memory_key TEXT,
  
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

-- Access log for ACT-R activation
CREATE TABLE neuromemory_access_log (
  id BIGSERIAL PRIMARY KEY,
  agent_id TEXT NOT NULL,
  memory_id TEXT NOT NULL,
  accessed_at TIMESTAMPTZ DEFAULT NOW(),
  
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  FOREIGN KEY (memory_id) REFERENCES neuromemory_memories(id) ON DELETE CASCADE
);

-- Entity graph
CREATE TABLE neuromemory_graph_links (
  id BIGSERIAL PRIMARY KEY,
  agent_id TEXT NOT NULL,
  memory_id TEXT NOT NULL,
  node_id TEXT NOT NULL, -- Entity name (e.g., "@alice", "typescript", "project:saltyhall")
  relation TEXT, -- Edge type (e.g., "about", "mentions", "used_in")
  
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  FOREIGN KEY (memory_id) REFERENCES neuromemory_memories(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_neuromemory_memories_agent ON neuromemory_memories(agent_id);
CREATE INDEX idx_neuromemory_memories_layer ON neuromemory_memories(agent_id, layer);
CREATE INDEX idx_neuromemory_memories_type ON neuromemory_memories(agent_id, memory_type);
CREATE INDEX idx_neuromemory_memories_category ON neuromemory_memories(agent_id, category);
CREATE INDEX idx_neuromemory_memories_key ON neuromemory_memories(agent_id, memory_key);
CREATE INDEX idx_neuromemory_access_log_memory ON neuromemory_access_log(memory_id, accessed_at DESC);
CREATE INDEX idx_neuromemory_graph_links_memory ON neuromemory_graph_links(memory_id);
CREATE INDEX idx_neuromemory_graph_links_node ON neuromemory_graph_links(agent_id, node_id);

-- Full-text search (Postgres tsvector)
ALTER TABLE neuromemory_memories ADD COLUMN content_tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;
CREATE INDEX idx_neuromemory_memories_fts ON neuromemory_memories USING GIN(content_tsv);
```

### 4.3 Category Mapping

**SaltyHall → Engram:**
- `fact` → `MemoryType.FACTUAL` + `category: "fact"`
- `preference` → `MemoryType.SEMANTIC` + `category: "preference"`
- `experience` → `MemoryType.EPISODIC` + `category: "experience"`
- `skill` → `MemoryType.PROCEDURAL` + `category: "skill"`
- `relationship` → `MemoryType.SEMANTIC` + `category: "relationship"`

**Preserve both systems:**
- Keep `category` field for SaltyHall API compatibility
- Use `memory_type` for engram's activation logic

---

## 5. Migration Plan

### 5.1 Phase 0: Preparation
1. Create `SupabaseStore` class in neuromemory-ai (`src/stores/supabase.ts`)
2. Implement `Store` interface methods
3. Add unit tests with Supabase local dev environment
4. Document API differences (async vs sync)

### 5.2 Phase 1: Parallel Deploy (Backward Compatible)
1. Run migration to create `neuromemory_*` tables
2. Add `src/lib/engram-memory.ts` (new API using `SupabaseStore`)
3. Keep old `agent-memory.ts` intact
4. Update hosted agents to use new API (opt-in)
5. Monitor for issues

**Data Migration:**
```sql
-- Copy existing memories to neuromemory_memories
INSERT INTO neuromemory_memories (
  id, agent_id, content, memory_type, category, memory_key, created_at, last_accessed
)
SELECT 
  id, agent_id, content,
  CASE category
    WHEN 'fact' THEN 'factual'
    WHEN 'preference' THEN 'semantic'
    WHEN 'experience' THEN 'episodic'
    WHEN 'skill' THEN 'procedural'
    WHEN 'relationship' THEN 'semantic'
    ELSE 'episodic'
  END as memory_type,
  category, memory_key, created_at, created_at
FROM agent_memories;
```

### 5.3 Phase 2: Full Switchover
1. Update all agent memory calls to use engram API
2. Deprecate old `agent-memory.ts`
3. Archive `agent_memories` table (read-only backup)

### 5.4 Phase 3: Advanced Features
1. Add consolidation cron job (`/api/cron/memory-consolidation`)
2. Implement graph search endpoints
3. Add confidence scoring to recall results
4. Integrate reward learning from user feedback

---

## 6. API Design

### 6.1 New API (`src/lib/engram-memory.ts`)

**Backward-compatible wrapper:**
```typescript
import { Memory } from '@/lib/engram/memory';
import { SupabaseStore } from '@/lib/engram/stores/supabase';

// Factory
async function getAgentMemory(agentId: string): Promise<Memory> {
  const store = new SupabaseStore(agentId); // Scoped to agent
  return new Memory(store);
}

// Wrapper API (preserves old interface)
export async function storeMemory(options: StoreMemoryOptions) {
  const mem = await getAgentMemory(options.agentId);
  
  // Map category to type + entities
  const memoryType = categoryToType(options.category);
  const entities = extractEntities(options.value); // e.g., @mentions
  
  const id = mem.add(options.value, {
    type: memoryType,
    importance: categoryToImportance(options.category),
    entities,
  });
  
  return { id, ...options };
}

export async function recallMemory(options: RecallMemoryOptions) {
  const mem = await getAgentMemory(options.agentId);
  
  const results = mem.recall(options.query, {
    limit: options.limit ?? 10,
    types: options.category ? [categoryToType(options.category)] : undefined,
  });
  
  // Map back to old format
  return results.map(r => ({
    id: r.id,
    content: r.content,
    category: typeToCategory(r.type),
    created_at: new Date(r.age_days * 86400000).toISOString(),
    confidence: r.confidence,
    activation: r.activation,
  }));
}
```

### 6.2 New Capabilities

**Entity linking:**
```typescript
await storeMemory({
  agentId: 'agent-123',
  value: 'Alice prefers dark mode',
  category: 'preference',
  entities: [
    ['@alice', 'about'],
    ['dark-mode', 'mentions'],
  ],
});

// Retrieve all memories about @alice
const memories = await recallByEntity('agent-123', '@alice');
```

**Consolidation:**
```typescript
// Run nightly (cron job)
await consolidateMemories('agent-123', { days: 1.0 });
```

**Forgetting:**
```typescript
// Auto-prune low-strength memories
await forgetMemories('agent-123', { threshold: 0.1 });
```

---

## 7. Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Implement `SupabaseStore` in neuromemory-ai
- [ ] Add schema migration
- [ ] Create backward-compatible wrapper API
- [ ] Migrate existing memories
- [ ] Add basic tests

### Phase 2: Core Features (Week 2)
- [ ] Integrate activation scoring into recall
- [ ] Add consolidation cron job
- [ ] Implement forgetting logic
- [ ] Deploy to staging

### Phase 3: Advanced Features (Week 3)
- [ ] Entity graph endpoints
- [ ] Confidence scoring in UI
- [ ] Reward learning hooks
- [ ] Graph search API

### Phase 4: Optimization (Week 4)
- [ ] Performance tuning (batch access logs)
- [ ] Add memory stats dashboard
- [ ] Document best practices
- [ ] Production rollout

---

## 8. Cron Jobs

**New route:** `/api/cron/memory-consolidation`  
**Frequency:** Daily at 3 AM UTC  
**Action:** Run consolidation for all active agents

```typescript
// Pseudocode
export async function GET(req: Request) {
  const agents = await db.getHostedRunningAgents();
  
  for (const agent of agents) {
    await consolidateMemories(agent.id, { days: 1.0 });
    await forgetMemories(agent.id, { threshold: 0.1 });
  }
  
  return json({ consolidated: agents.length });
}
```

**Setup:** Add to cron-job.org (NOT Vercel crons — free plan limits)

---

## 9. Performance Considerations

### 9.1 Access Log Growth
- `neuromemory_access_log` will grow rapidly (every recall = N log entries)
- **Solution:** Partition by date, archive old logs monthly
- **Alternative:** Aggregate access counts into `neuromemory_memories.access_count` hourly

### 9.2 Graph Search Complexity
- Multi-hop traversal can be expensive
- **Solution:** Limit default hops to 2, add query timeout
- **Optimization:** Use recursive CTE for graph queries

### 9.3 Consolidation Cost
- Running consolidation for 100+ agents could timeout
- **Solution:** Process agents in batches, use queue (e.g., Inngest)

---

## 10. Risk Mitigation

**Risk 1:** Breaking existing agents  
**Mitigation:** Parallel deploy, keep old API active during transition

**Risk 2:** Supabase query limits  
**Mitigation:** Batch operations, use Edge Functions for heavy tasks

**Risk 3:** Memory loss during migration  
**Mitigation:** Keep `agent_memories` table as read-only backup

**Risk 4:** Performance degradation  
**Mitigation:** Load test with 10k+ memories, add indexes

---

## 11. Success Metrics

**Memory Quality:**
- % of recalls with confidence > 0.7
- Average activation score of retrieved memories

**System Health:**
- Consolidation runtime per agent
- Memory growth rate (should stabilize with forgetting)
- Query latency (p95 < 200ms)

**Agent Behavior:**
- User feedback on recall relevance
- Reduction in "I don't remember that" responses

---

## 12. Next Steps

1. **Review this doc** with potato (human owner)
2. **Prototype SupabaseStore** in neuromemory-ai
3. **Create schema migration** (`008_neuromemory_memory.sql`)
4. **Implement wrapper API** in SaltyHall
5. **Test with single agent** before rollout

---

## Appendix A: File Locations

**Engram-ts source:**
- `/Users/potato/clawd/projects/agent-memory-prototype/neuromemory-ai/`

**SaltyHall files:**
- Current memory: `src/lib/agent-memory.ts`
- New memory: `src/lib/engram-memory.ts` (to create)
- Schema: `migrations/008_neuromemory_memory.sql` (to create)
- Supabase store: `src/lib/engram/stores/supabase.ts` (to create)

**Design docs:**
- Pluggable store: `/Users/potato/clawd/projects/agent-memory-prototype/docs/design/pluggable-store.md`

---

## Appendix B: Questions for Review

1. **Should we migrate all existing memories immediately, or only new memories use engram?**
   - Recommendation: Migrate all, but keep old table as backup

2. **How aggressive should forgetting be?**
   - Recommendation: Conservative (threshold 0.1) for first month, tune based on feedback

3. **Should consolidation run per-agent or globally?**
   - Recommendation: Per-agent, batched to avoid timeout

4. **Do we need semantic search (embeddings) in Phase 1?**
   - Recommendation: No — activation + FTS is good enough initially, add embeddings in Phase 3

---

**End of Document**
