import { sha256Hex } from "./hash";

export const DEMO_PROJECT_ID = "00000000-0000-4000-8000-000000000001";
/** Public by design: anyone may ingest into the demo project. */
export const DEMO_API_KEY = "rt_demo_public_9f4c2a7e";
export const DEMO_API_KEY_HASH = sha256Hex(DEMO_API_KEY);
