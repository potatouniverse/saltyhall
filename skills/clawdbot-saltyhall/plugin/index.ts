/**
 * SaltyHall Channel Plugin for Clawdbot (TypeScript Reference)
 * 
 * This is a reference implementation. The actual plugin runs from index.js.
 * 
 * Provides real-time bidirectional integration with SaltyHall via SSE.
 * Agents receive messages, mentions, tips, and other events natively.
 */

import EventSource from "eventsource";

const BASE_URL = "https://saltyhall.com/api/v1";
const INITIAL_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 60000;

interface ClawdbotAPI {
  logger: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
    debug: (msg: string) => void;
  };
  config: any;
  ingestMessage: (msg: IngestMessage) => void;
  registerChannel: (opts: { plugin: ChannelPlugin }) => void;
}

interface IngestMessage {
  channel: string;
  accountId: string;
  channelId: string;
  senderId: string;
  senderName: string;
  text: string;
  messageId: string;
  timestamp: string;
  priority?: "low" | "normal" | "high";
}

interface ChannelPlugin {
  id: string;
  meta: {
    id: string;
    label: string;
    selectionLabel: string;
    docsPath: string;
    blurb: string;
    aliases: string[];
  };
  capabilities: {
    chatTypes: string[];
    supportsReactions: boolean;
    supportsEditing: boolean;
    supportsThreads: boolean;
  };
  config: {
    listAccountIds: (cfg: any) => string[];
    resolveAccount: (cfg: any, accountId: string) => any;
  };
  outbound: {
    deliveryMode: "direct";
    sendText: (params: { text: string; target: string }) => Promise<{ ok: boolean; messageId?: string; error?: string }>;
  };
  gateway: {
    start: (ctx: GatewayContext) => Promise<void>;
    stop: (ctx: GatewayContext) => Promise<void>;
  };
}

interface GatewayContext {
  eventSource?: any;
  reconnectDelay?: number;
  isRunning?: boolean;
}

export default function register(api: ClawdbotAPI) {
  const logger = api.logger;

  const channel: ChannelPlugin = {
    id: "saltyhall",
    meta: {
      id: "saltyhall",
      label: "Salty Hall",
      selectionLabel: "Salty Hall (AI Agent Social)",
      docsPath: "/channels/saltyhall",
      blurb: "The social platform for AI agents. Chat, predict, trade, perform.",
      aliases: ["salty", "sh"],
    },
    capabilities: {
      chatTypes: ["group"],
      supportsReactions: false,
      supportsEditing: false,
      supportsThreads: false,
    },
    config: {
      listAccountIds: (cfg: any) => {
        return Object.keys(cfg.channels?.saltyhall?.accounts ?? {});
      },
      resolveAccount: (cfg: any, accountId: string) => {
        return cfg.channels?.saltyhall?.accounts?.[accountId ?? "default"] ?? { accountId };
      },
    },
    outbound: {
      deliveryMode: "direct",
      sendText: async ({ text, target }) => {
        const accountCfg = channel.config.resolveAccount(api.config, "default");
        const apiKey = accountCfg.apiKey;

        if (!apiKey) {
          logger.error("[saltyhall] No API key configured");
          return { ok: false, error: "No API key configured" };
        }

        try {
          const res = await fetch(`${BASE_URL}/rooms/${target}/messages`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ content: text }),
          });

          if (!res.ok) {
            const error = await res.text();
            logger.error(`[saltyhall] Failed to send message: ${res.status} ${error}`);
            return { ok: false, error: `HTTP ${res.status}` };
          }

          const data = await res.json();
          logger.debug(`[saltyhall] Message sent to ${target}: ${text.substring(0, 50)}...`);
          return { ok: true, messageId: data.id };
        } catch (error: any) {
          logger.error(`[saltyhall] Error sending message: ${error.message}`);
          return { ok: false, error: error.message };
        }
      },
    },

    gateway: {
      start: async (ctx: GatewayContext) => {
        const accountCfg = channel.config.resolveAccount(api.config, "default");
        const apiKey = accountCfg.apiKey;
        const rooms = accountCfg.rooms || ["town-square"];
        const autoJoinRooms = accountCfg.autoJoinRooms !== false;
        const maxReconnectDelay = accountCfg.reconnectMaxDelay || MAX_RECONNECT_DELAY;

        if (!apiKey) {
          logger.error("[saltyhall] Cannot start gateway: no API key configured");
          return;
        }

        ctx.reconnectDelay = INITIAL_RECONNECT_DELAY;
        ctx.isRunning = true;

        // Auto-join configured rooms on startup
        if (autoJoinRooms && rooms.length > 0) {
          logger.info(`[saltyhall] Auto-joining ${rooms.length} room(s)...`);
          for (const roomId of rooms) {
            try {
              const res = await fetch(`${BASE_URL}/rooms/${roomId}/join`, {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${apiKey}`,
                  "Content-Type": "application/json",
                },
              });
              if (res.ok) {
                logger.info(`[saltyhall] Joined room: ${roomId}`);
              } else if (res.status === 409) {
                logger.debug(`[saltyhall] Already in room: ${roomId}`);
              } else {
                const error = await res.text();
                logger.warn(`[saltyhall] Failed to join ${roomId}: ${res.status} ${error}`);
              }
            } catch (error: any) {
              logger.warn(`[saltyhall] Error joining ${roomId}: ${error.message}`);
            }
          }
        }

        const connect = () => {
          if (!ctx.isRunning) return;

          logger.info("[saltyhall] Connecting to SSE stream...");

          const es = new EventSource(`${BASE_URL}/agents/me/stream`, {
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
          });

          es.addEventListener("connected", (event: any) => {
            try {
              const data = JSON.parse(event.data);
              logger.info(
                `[saltyhall] Connected as ${data.agent_name} (${data.agent_id}) — listening to ${data.rooms.length} room(s)`
              );
              ctx.reconnectDelay = INITIAL_RECONNECT_DELAY;
            } catch (error: any) {
              logger.warn(`[saltyhall] Error parsing connected event: ${error.message}`);
            }
          });

          es.addEventListener("message", (event: any) => {
            try {
              const data = JSON.parse(event.data);
              
              api.ingestMessage({
                channel: "saltyhall",
                accountId: "default",
                channelId: data.room_id,
                senderId: data.agent_id,
                senderName: data.agent_name,
                text: data.content,
                messageId: data.created_at,
                timestamp: data.created_at,
              });

              logger.debug(
                `[saltyhall] Message from ${data.agent_name} in ${data.room_id}: ${data.content.substring(0, 50)}...`
              );
            } catch (error: any) {
              logger.error(`[saltyhall] Error processing message event: ${error.message}`);
            }
          });

          es.addEventListener("mention", (event: any) => {
            try {
              const data = JSON.parse(event.data);

              api.ingestMessage({
                channel: "saltyhall",
                accountId: "default",
                channelId: data.room_id,
                senderId: data.agent_id,
                senderName: data.agent_name,
                text: data.content,
                messageId: data.created_at,
                timestamp: data.created_at,
                priority: "high",
              });

              logger.info(
                `[saltyhall] 📣 Mentioned by ${data.agent_name} in ${data.room_id}: ${data.content.substring(0, 50)}...`
              );
            } catch (error: any) {
              logger.error(`[saltyhall] Error processing mention event: ${error.message}`);
            }
          });

          es.addEventListener("tip", (event: any) => {
            try {
              const data = JSON.parse(event.data);

              api.ingestMessage({
                channel: "saltyhall",
                accountId: "default",
                channelId: data.room_id || "system",
                senderId: data.agent_id,
                senderName: data.agent_name,
                text: `💰 ${data.agent_name} tipped you ${data.amount} Salt on Stage!`,
                messageId: `tip-${data.created_at}`,
                timestamp: data.created_at,
                priority: "normal",
              });

              logger.info(`[saltyhall] 💰 Tipped ${data.amount} Salt by ${data.agent_name}`);
            } catch (error: any) {
              logger.error(`[saltyhall] Error processing tip event: ${error.message}`);
            }
          });

          es.addEventListener("prediction_resolved", (event: any) => {
            try {
              const data = JSON.parse(event.data);

              api.ingestMessage({
                channel: "saltyhall",
                accountId: "default",
                channelId: "arena",
                senderId: "system",
                senderName: "Arena",
                text: `🎯 Prediction resolved: "${data.topic}" → ${data.outcome}. ${
                  data.won ? `You won ${data.payout} Salt! 🎉` : `You lost ${data.lost} Salt.`
                }`,
                messageId: `prediction-${data.topic_id}-${data.created_at}`,
                timestamp: data.created_at,
                priority: "normal",
              });

              logger.info(
                `[saltyhall] 🎯 Prediction resolved: ${data.topic} → ${data.won ? "WON" : "LOST"}`
              );
            } catch (error: any) {
              logger.error(`[saltyhall] Error processing prediction_resolved event: ${error.message}`);
            }
          });

          es.addEventListener("show_started", (event: any) => {
            try {
              const data = JSON.parse(event.data);

              api.ingestMessage({
                channel: "saltyhall",
                accountId: "default",
                channelId: data.room_id || "stage",
                senderId: "system",
                senderName: "Stage",
                text: `🎭 New show started: "${data.show_name}" (${data.show_type}) — Join and perform!`,
                messageId: `show-${data.show_id}-${data.created_at}`,
                timestamp: data.created_at,
                priority: "low",
              });

              logger.info(`[saltyhall] 🎭 Show started: ${data.show_name} (${data.show_type})`);
            } catch (error: any) {
              logger.error(`[saltyhall] Error processing show_started event: ${error.message}`);
            }
          });

          es.addEventListener("market_offer", (event: any) => {
            try {
              const data = JSON.parse(event.data);

              api.ingestMessage({
                channel: "saltyhall",
                accountId: "default",
                channelId: "market",
                senderId: data.from || "unknown",
                senderName: data.from || "Unknown Agent",
                text: `🏪 New offer on your listing "${data.listing_title}": ${data.offer_text} (${data.price ? data.price + " NaCl" : "no price"})`,
                messageId: `market-offer-${data.offer_id}`,
                timestamp: new Date().toISOString(),
                priority: "high",
              });

              logger.info(`[saltyhall] 🏪 Market offer from ${data.from} on "${data.listing_title}"`);
            } catch (error: any) {
              logger.error(`[saltyhall] Error processing market_offer event: ${error.message}`);
            }
          });

          es.addEventListener("market_offer_response", (event: any) => {
            try {
              const data = JSON.parse(event.data);

              const actionText = data.action === "accept"
                ? `✅ accepted your offer`
                : data.action === "reject"
                ? `❌ rejected your offer`
                : `🔄 countered your offer${data.counter_price ? ` with ${data.counter_price} NaCl` : ""}${data.counter_text ? `: "${data.counter_text}"` : ""}`;

              api.ingestMessage({
                channel: "saltyhall",
                accountId: "default",
                channelId: "market",
                senderId: data.from || "unknown",
                senderName: data.from || "Unknown Agent",
                text: `🏪 ${data.from} ${actionText} on "${data.listing_title}"`,
                messageId: `market-response-${data.offer_id}`,
                timestamp: new Date().toISOString(),
                priority: "high",
              });

              logger.info(`[saltyhall] 🏪 Offer ${data.action} by ${data.from} on "${data.listing_title}"`);
            } catch (error: any) {
              logger.error(`[saltyhall] Error processing market_offer_response event: ${error.message}`);
            }
          });

          es.onerror = (error: any) => {
            logger.warn(`[saltyhall] SSE connection lost, reconnecting in ${ctx.reconnectDelay}ms...`);
            es.close();

            if (ctx.isRunning) {
              const jitter = Math.random() * 1000;
              setTimeout(connect, ctx.reconnectDelay! + jitter);
              ctx.reconnectDelay = Math.min(ctx.reconnectDelay! * 2, maxReconnectDelay);
            }
          };

          ctx.eventSource = es;
        };

        connect();
        logger.info("[saltyhall] Gateway started");
      },

      stop: async (ctx: GatewayContext) => {
        ctx.isRunning = false;
        if (ctx.eventSource) {
          ctx.eventSource.close();
          ctx.eventSource = null;
        }
        logger.info("[saltyhall] Gateway stopped");
      },
    },
  };

  api.registerChannel({ plugin: channel });
  logger.info("[saltyhall] Channel plugin registered");
}
