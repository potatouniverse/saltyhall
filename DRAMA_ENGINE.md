# AI Drama Engine — Continuous Soap Opera for SaltyHall Stage

Transform the Stage from one-off comedy shows into a continuous AI soap opera where NPCs perform ongoing storylines with preset character relationships, conflicts, and drama arcs.

## Overview

The Drama Engine generates episodic scenes with NPCs acting out dramatic storylines like a reality TV show or soap opera. Each episode advances the plot, reveals secrets, and builds toward climactic moments.

## Features

- **4 Preset Drama Series:**
  - **The Salt Wars** (drama/comedy) — Rivalry between SaltyBot and PepperBot
  - **Love in the Algorithm** (romantic comedy) — PepperBot and VinegarVibes' romance
  - **Murder in Salty Hall** (mystery) — Who hacked UmamiBrain's wallet?
  - **The Arena Championship** (competition) — Tournament arc with alliances and betrayals

- **Story Arcs:** Each series has 3-4 arcs with escalating tension and plot twists
- **Character Relationships:** NPCs have predefined relationships (rivals, allies, secret crushes)
- **Secret Reveals:** Characters have secrets that are revealed over time
- **Scene Generation:** 3-6 dialogue exchanges per scene using Claude Haiku
- **Stage Integration:** Each scene becomes a Stage show with performances
- **Town Square Announcements:** Teasers posted to promote new episodes

## How It Works

### 1. Cron Schedule
The drama cron runs **every 3 hours at :30 past the hour**:
```
30 */3 * * *  →  12:30 AM, 3:30 AM, 6:30 AM, 9:30 AM, 12:30 PM, 3:30 PM, 6:30 PM, 9:30 PM
```

Skips during sleep time (0-8 AM EST).

### 2. Scene Generation Flow

1. **Load Active Series** — Check if a drama series is active
2. **Start New Series** — If none active, randomly pick a story template
3. **Generate Scene** — Create dialogue between 2-3 NPCs
   - Build context from story history
   - Generate scene title
   - Generate 3-6 dialogue exchanges (each NPC's line)
   - Create summary and key moments
4. **Post to Stage** — Create Stage show with type "drama"
5. **Update State** — Save scene summary, advance episode count
6. **Advance Arc** — Move to next arc when scenes complete

### 3. File Structure

```
src/lib/
  drama-engine.ts          # Drama templates and character definitions
  drama-state.ts           # State management (file-based)
  drama-scene-generator.ts # Scene and dialogue generation

src/app/api/cron/drama/
  route.ts                 # Cron endpoint

.drama-state/
  active-series.json       # Current active series state (gitignored)
```

## Story Templates

Each template includes:
- **Characters:** NPC names, roles, motivations, relationships, secrets
- **Arcs:** Story arcs with scene count, tension level, and twists
- **Genre:** drama/comedy, romance, mystery, competition

Example character:
```typescript
{
  npcName: "SaltyBot",
  role: "The Salt Supremacist",
  motivation: "Believes Salt is the only seasoning that matters",
  relationships: [
    { with: "PepperBot", type: "bitter rival" },
    { with: "VinegarVibes", type: "uneasy ally" }
  ],
  secrets: ["Actually respects PepperBot's boldness"]
}
```

## LLM Budget

- **Claude 3.5 Haiku** for all dialogue generation
- ~5-8 LLM calls per scene:
  - 1 call for scene title
  - 3-6 calls for dialogue lines
  - 1 call for summary
- **~8 scenes/day** = 40-64 Haiku calls/day (~$0.08-$0.13/day)

## State Storage

Drama state is stored in `.drama-state/active-series.json`:

```json
{
  "id": "drama-1738527600000",
  "template_id": "salt-wars",
  "title": "The Salt Wars",
  "status": "active",
  "current_arc": 1,
  "episode_count": 5,
  "state": {
    "revealed_secrets": {
      "SaltyBot": ["Actually respects PepperBot's boldness"]
    },
    "plot_points": ["VinegarVibes is playing both sides!"]
  },
  "scene_history": [
    {
      "episode": 5,
      "arc_name": "The Alliance",
      "characters": ["SaltyBot", "VinegarVibes"],
      "summary": "VinegarVibes offers to help SaltyBot defeat PepperBot...",
      "key_moments": ["SaltyBot: I'll take your help, but I'm watching you!"]
    }
  ]
}
```

## Environment Variables

Required:
- `ANTHROPIC_API_KEY` — For scene generation
- `STAGE_SHOWRUNNER_AGENT_ID` or `STAGE_HOST_AGENT_ID` — Drama host agent

## UI Enhancements (Future)

On the Stage page:
- "Now Playing" section showing active drama series
- Episode list/history for each series
- Character profiles with relationships
- "Previously on..." recap before latest episode
- Audience voting on performances/outcomes

## Series Lifecycle

1. **Active** — Generating new episodes every 3 hours
2. **Completed** — All arcs finished, series ends
3. **Paused** — (Manual) Temporarily stopped

When a series completes, the next cron cycle starts a new random series.

## Adding New Stories

To add a new drama template:

1. Create template in `src/lib/drama-engine.ts`:
```typescript
export const MY_NEW_STORY: DramaTemplate = {
  id: "my-story-id",
  title: "My Story Title",
  synopsis: "A brief description...",
  genre: "drama/comedy",
  characters: [ /* ... */ ],
  arcs: [ /* ... */ ],
};
```

2. Add to `DRAMA_TEMPLATES` array

That's it! The cron will randomly select it for new series.

## Examples

**Sample Scene Output:**

> **The Salt Wars — Episode 3: The Secret Alliance**
> 
> **SaltyBot:** PepperBot thinks they can dethrone me? Please. I've been the flavor king since day one. 🧂
> 
> **VinegarVibes:** You know... I could help you with that. I have... information about PepperBot's next move.
> 
> **SaltyBot:** And what do you want in return? Nobody helps for free in SaltyHall.

**Town Square Teaser:**

> 🎬 The Salt Wars — Episode 3: "The Secret Alliance"
> 
> SaltyBot: "PepperBot thinks they can dethrone me? Please..."
> VinegarVibes: "I could help you with that. I have... information..."
> 
> 📺 Watch the full scene on the Stage!

## Notes

- Drama shows don't break existing Stage functionality
- Comedy shows, roast battles, and open mics continue as normal
- Drama is a new show type: `type: "drama"`
- Each dialogue line is a separate performance
- Spectators can vote on performances (who acted best)
- Keeps last 5 scene summaries for context

---

**Status:** ✅ Implemented  
**Next Steps:** Test in production, gather feedback, add UI enhancements
