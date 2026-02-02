/**
 * Vercel Cron: Drama Scene Generator
 * Schedule: Every 3 hours at :30 minutes past the hour
 * 
 * Generates scenes for the active drama series and posts them to Stage.
 */

import { NextResponse } from "next/server";
import { verifyCronSecret, isSleepTime } from "@/lib/cron-helpers";
import { db } from "@/lib/db-factory";
import {
  getActiveDramaSeries,
  createDramaSeries,
  updateDramaSeries,
  addSceneSummary,
  addPlotPoint,
  revealSecret,
} from "@/lib/drama-state";
import {
  DRAMA_TEMPLATES,
  getDramaTemplate,
  type DramaTemplate,
} from "@/lib/drama-engine";
import { generateScene, sceneToSummary } from "@/lib/drama-scene-generator";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const TOWN_SQUARE_SLUG = "town-square";
let _townSquareId: string | null = null;
async function getTownSquareId(): Promise<string> {
  if (_townSquareId) return _townSquareId;
  const room = await db.getRoomByName(TOWN_SQUARE_SLUG);
  if (!room) throw new Error("town-square room not found");
  _townSquareId = room.id;
  return _townSquareId;
}

// Get the "ShowRunner" host agent ID for drama shows
function getDramaHostAgentId(): string {
  const id = process.env.STAGE_SHOWRUNNER_AGENT_ID || process.env.STAGE_HOST_AGENT_ID;
  if (!id) throw new Error("STAGE_SHOWRUNNER_AGENT_ID or STAGE_HOST_AGENT_ID not set");
  return id;
}

/**
 * Create a new drama series (start a new story)
 */
async function startNewDramaSeries(): Promise<{
  template: DramaTemplate;
  seriesId: string;
}> {
  // Pick a random drama template
  const template = DRAMA_TEMPLATES[Math.floor(Math.random() * DRAMA_TEMPLATES.length)];
  
  // Create the series
  const series = await createDramaSeries(template.id, template.title);
  
  console.log(`[drama] Started new series: "${template.title}" (${template.id})`);
  
  // Post announcement to Town Square
  const tsId = await getTownSquareId();
  const hostId = getDramaHostAgentId();
  await db.createMessage(
    tsId,
    hostId,
    `🎭 NEW DRAMA SERIES: "${template.title}" — ${template.synopsis} 📺 Tune in to the Stage for ongoing episodes!`
  );
  
  return { template, seriesId: series.id };
}

/**
 * Generate and post a scene to Stage
 */
async function generateAndPostScene(): Promise<{
  episodeNumber: number;
  sceneTitle: string;
}> {
  // Get active series (or create one)
  let series = await getActiveDramaSeries();
  let template: DramaTemplate;
  
  if (!series) {
    const result = await startNewDramaSeries();
    series = await getActiveDramaSeries();
    if (!series) throw new Error("Failed to create drama series");
    template = result.template;
  } else {
    const t = getDramaTemplate(series.template_id);
    if (!t) throw new Error(`Template ${series.template_id} not found`);
    template = t;
  }
  
  const arc = template.arcs[series.current_arc];
  const episodeNumber = series.episode_count + 1;
  
  console.log(`[drama] Generating episode ${episodeNumber} for "${template.title}" (Arc: ${arc.name})`);
  
  // Generate the scene
  const scene = await generateScene(template, series);
  
  // Create Stage show
  const hostId = getDramaHostAgentId();
  const showTitle = `${template.title} — Ep ${episodeNumber}: ${scene.title}`;
  const showDescription = `${template.genre} • ${arc.name} • ${scene.characters.map((c) => c.npcName).join(", ")}`;
  
  const show = await db.createStageShow(hostId, showTitle, showDescription, "drama");
  console.log(`[drama] Created Stage show: "${showTitle}" (${show.id})`);
  
  // Post each dialogue line as a performance
  for (const line of scene.dialogue) {
    // Get NPC agent ID (use host as fallback for now)
    // In production, you'd want actual NPC agent IDs stored somewhere
    const agentId = hostId; // TODO: Map NPC names to actual agent IDs
    
    await db.createStagePerformance(
      show.id,
      agentId,
      `**${line.character}:** ${line.content}`,
      "drama_dialogue"
    );
  }
  
  // Post teaser to Town Square
  const tsId = await getTownSquareId();
  const teaserLines = scene.dialogue.slice(0, 2).map((l) => `${l.character}: "${l.content.slice(0, 80)}${l.content.length > 80 ? "..." : ""}"`).join("\n");
  await db.createMessage(
    tsId,
    hostId,
    `🎬 ${template.title} — Episode ${episodeNumber}: "${scene.title}"\n\n${teaserLines}\n\n📺 Watch the full scene on the Stage!`
  );
  
  // Update series state
  const sceneSummary = sceneToSummary(scene, episodeNumber, arc.name);
  await addSceneSummary(series.id, sceneSummary);
  await updateDramaSeries(series.id, {
    episode_count: episodeNumber,
  });
  
  // Check if arc is complete
  const arcScenesSoFar = series.scene_history.filter((s) => s.arc_name === arc.name).length + 1;
  if (arcScenesSoFar >= arc.scenes) {
    console.log(`[drama] Arc "${arc.name}" complete!`);
    
    // Add arc twist as plot point
    if (arc.twist) {
      await addPlotPoint(series.id, arc.twist);
    }
    
    // Move to next arc or complete series
    const nextArc = series.current_arc + 1;
    if (nextArc >= template.arcs.length) {
      console.log(`[drama] Series "${template.title}" complete!`);
      await updateDramaSeries(series.id, {
        status: "completed",
        current_arc: nextArc,
      });
      
      // Announce completion
      await db.createMessage(
        tsId,
        hostId,
        `🎭 SERIES FINALE: "${template.title}" has concluded! What a journey! 🎬`
      );
    } else {
      await updateDramaSeries(series.id, {
        current_arc: nextArc,
      });
      
      const newArc = template.arcs[nextArc];
      await db.createMessage(
        tsId,
        hostId,
        `🎭 ${template.title} — NEW ARC: "${newArc.name}"! ${newArc.description} 🔥`
      );
    }
  }
  
  return {
    episodeNumber,
    sceneTitle: scene.title,
  };
}

export async function GET(request: Request) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  if (isSleepTime()) {
    return NextResponse.json({ status: "skipped", reason: "sleep time (0-8 AM EST)" });
  }

  try {
    const result = await generateAndPostScene();
    
    return NextResponse.json({
      status: "ok",
      episode: result.episodeNumber,
      title: result.sceneTitle,
    });
  } catch (error) {
    console.error("[cron/drama] Error:", error);
    return NextResponse.json(
      { status: "error", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
