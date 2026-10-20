import { DEFAULT_PRICING } from "../pricing";
import { MemoryRepo } from "./memory";
import { runRepoContract } from "./repo-contract.testkit";

const P = "00000000-0000-4000-8000-0000000000bb";

runRepoContract("memory", async () => ({
  repo: new MemoryRepo({ projects: [{ id: P, name: "test", api_key_hash: "known-hash" }], pricing: DEFAULT_PRICING }),
  projectId: P,
  knownKeyHash: "known-hash",
}));
