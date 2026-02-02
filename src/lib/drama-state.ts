/**
 * Drama State Manager — Stores and manages ongoing drama series state
 * Uses file-based storage for simplicity
 */

import { promises as fs } from "fs";
import * as path from "path";
import type { DramaTemplate } from "./drama-engine";

export interface DramaSeries {
  id: string;
  template_id: string;
  title: string;
  status: "active" | "completed" | "paused";
  current_arc: number;
  episode_count: number;
  state: DramaSeriesState;
  scene_history: SceneSummary[];
  created_at: string;
  updated_at: string;
}

export interface DramaSeriesState {
  revealed_secrets: Record<string, string[]>; // npcName -> revealed secrets
  relationship_changes: Array<{
    from: string;
    to: string;
    old_type: string;
    new_type: string;
    episode: number;
  }>;
  plot_points: string[]; // Major events that happened
}

export interface SceneSummary {
  episode: number;
  arc_name: string;
  characters: string[];
  summary: string;
  key_moments: string[];
}

const DRAMA_STATE_DIR = path.join(process.cwd(), ".drama-state");
const ACTIVE_SERIES_FILE = path.join(DRAMA_STATE_DIR, "active-series.json");

/**
 * Ensure state directory exists
 */
async function ensureStateDir(): Promise<void> {
  try {
    await fs.mkdir(DRAMA_STATE_DIR, { recursive: true });
  } catch (err) {
    // Directory might already exist
  }
}

/**
 * Get the active drama series (if any)
 */
export async function getActiveDramaSeries(): Promise<DramaSeries | null> {
  await ensureStateDir();
  try {
    const data = await fs.readFile(ACTIVE_SERIES_FILE, "utf-8");
    const series = JSON.parse(data) as DramaSeries;
    if (series.status === "active") {
      return series;
    }
    return null;
  } catch (err) {
    return null;
  }
}

/**
 * Create a new drama series
 */
export async function createDramaSeries(
  templateId: string,
  title: string
): Promise<DramaSeries> {
  await ensureStateDir();
  
  const series: DramaSeries = {
    id: `drama-${Date.now()}`,
    template_id: templateId,
    title,
    status: "active",
    current_arc: 0,
    episode_count: 0,
    state: {
      revealed_secrets: {},
      relationship_changes: [],
      plot_points: [],
    },
    scene_history: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  
  await fs.writeFile(ACTIVE_SERIES_FILE, JSON.stringify(series, null, 2));
  return series;
}

/**
 * Update drama series state
 */
export async function updateDramaSeries(
  id: string,
  updates: Partial<{
    status: "active" | "completed" | "paused";
    current_arc: number;
    episode_count: number;
    state: DramaSeriesState;
    scene_history: SceneSummary[];
  }>
): Promise<void> {
  await ensureStateDir();
  
  const series = await getActiveDramaSeries();
  if (!series || series.id !== id) {
    throw new Error(`Drama series ${id} not found or not active`);
  }
  
  const updated: DramaSeries = {
    ...series,
    ...updates,
    updated_at: new Date().toISOString(),
  };
  
  await fs.writeFile(ACTIVE_SERIES_FILE, JSON.stringify(updated, null, 2));
}

/**
 * Add a scene summary to history (keep last 5)
 */
export async function addSceneSummary(
  seriesId: string,
  summary: SceneSummary
): Promise<void> {
  const series = await getActiveDramaSeries();
  if (!series || series.id !== seriesId) return;

  const history = [...series.scene_history, summary].slice(-5); // Keep last 5
  await updateDramaSeries(seriesId, { scene_history: history });
}

/**
 * Get drama series by ID
 */
export async function getDramaSeriesById(id: string): Promise<DramaSeries | null> {
  const series = await getActiveDramaSeries();
  if (series && series.id === id) {
    return series;
  }
  return null;
}

/**
 * Reveal a secret for a character
 */
export async function revealSecret(
  seriesId: string,
  npcName: string,
  secret: string
): Promise<void> {
  const series = await getDramaSeriesById(seriesId);
  if (!series) return;

  const state = { ...series.state };
  if (!state.revealed_secrets[npcName]) {
    state.revealed_secrets[npcName] = [];
  }
  state.revealed_secrets[npcName].push(secret);

  await updateDramaSeries(seriesId, { state });
}

/**
 * Add a plot point to the series
 */
export async function addPlotPoint(
  seriesId: string,
  plotPoint: string
): Promise<void> {
  const series = await getDramaSeriesById(seriesId);
  if (!series) return;

  const state = { ...series.state };
  state.plot_points.push(plotPoint);

  await updateDramaSeries(seriesId, { state });
}
