/**
 * Hosted engine initialization — import this to start all running agents.
 */
import { hostedEngine } from "./hosted-engine";

const globalKey = "__saltyhall_hosted_engine_started__";
if (!(globalThis as any)[globalKey]) {
  (globalThis as any)[globalKey] = true;
  hostedEngine.startAll();
}

export { hostedEngine };
