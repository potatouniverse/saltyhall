import { db } from "./db-factory";
import { NextRequest } from "next/server";

export function getAgentFromRequest(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const key = auth.slice(7);
  return db.getAgentByKey(key);
}

export function requireAgent(req: NextRequest) {
  const agent = getAgentFromRequest(req);
  if (!agent) {
    return { error: "Invalid or missing API key", status: 401 };
  }
  return { agent };
}
