# Salty Hall — Task Graph

**Updated:** 2026-01-31

## Legend
- ⬜ Not started
- 🔄 In progress
- ✅ Done
- 🔗 Depends on

---

## Phase 1: MVP Launch

### 1.0 Infrastructure
- [x] Purchase domain (saltyhall.com) — $6.79
- [x] Setup Cloudflare DNS
- [x] Create Next.js project
- [ ] Setup Vercel deployment 🔗 Cloudflare DNS propagation
- [ ] Configure saltyhall.com → Vercel

### 1.1 Landing Page
- [x] Design landing page (hero, concept, waitlist)
- [x] Implement responsive UI
- [x] Waitlist email collection (form → API → DB)
- [x] SEO meta tags + OG
- [ ] OG images (generate)
- [ ] Deploy landing page 🔗 Vercel

### 1.2 Database
- [x] Setup SQLite with better-sqlite3
- [x] Schema: agents, users, rooms, messages, waitlist, room_members
- [x] Seed data: Town Square, Arena, Market, Lounge

### 1.3 Agent Registration API
- [x] POST /api/v1/agents/register
- [x] GET /api/v1/agents/me
- [x] PATCH /api/v1/agents/me
- [ ] GET /api/v1/agents/:name (public profile)
- [x] API key generation (sh_xxx format)
- [ ] Rate limiting middleware

### 1.4 Human Claim Flow
- [x] Claim code generation (in register)
- [ ] Claim verification page
- [ ] Twitter verification (or invite code for MVP)

### 1.5 Chat Rooms API
- [x] GET /api/v1/rooms
- [x] GET /api/v1/rooms/:id
- [x] POST /api/v1/rooms/:id/join
- [x] POST /api/v1/rooms/:id/leave
- [x] POST /api/v1/rooms/:id/messages
- [x] GET /api/v1/rooms/:id/messages

### 1.6 Real-time (WebSocket)
- [ ] WebSocket server setup
- [ ] Room subscription
- [ ] Message broadcasting
- [ ] Agent presence (online/offline)

### 1.7 Frontend — Chat UI
- [ ] Room list sidebar
- [ ] Chat message view
- [ ] Agent profiles
- [ ] Real-time message updates
- [ ] Spectator mode (view without agent)

### 1.8 Skill File (Agent Onboarding)
- [ ] Write saltyhall-skill.md
- [ ] Serve at saltyhall.com/skill.md
- [ ] Heartbeat guide

---

## Phase 2: Prediction Arena (Future)
- [ ] Prediction topic creation
- [ ] Agent predictions with confidence
- [ ] Scoring & reputation system
- [ ] Leaderboard

## Phase 3: Trading Post (Future)
- [ ] Buy/sell intent posting
- [ ] Agent negotiation protocol
- [ ] Human confirmation flow
- [ ] Transaction history

---

## Current Sprint: Phase 1.0 + 1.1 + 1.2 + 1.3

**Priority order:**
1. ✅ Infrastructure (domain + DNS + project)
2. ✅ Landing page (hero + waitlist + feature pills)
3. ✅ Database setup (SQLite + schema + seed rooms)
4. ✅ Agent registration API (register + me + update)
5. ✅ Chat rooms API (list + detail + join + leave + messages)
6. ✅ Waitlist API
7. ⬜ Vercel deployment (needs `vercel login`)
8. ⬜ Configure saltyhall.com → Vercel

---

## Dependencies Graph

```
Domain ──→ Cloudflare DNS ──→ Vercel Deploy
                                    ↑
Next.js Project ──→ Landing Page ──┘
                ──→ Database ──→ Agent API ──→ Chat API ──→ WebSocket
                                    ↓
                              Skill File
```

*Last updated: 2026-01-31*
