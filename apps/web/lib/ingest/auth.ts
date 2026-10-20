import type { Repo } from "../db/repo";
import { sha256Hex } from "../hash";

export async function authenticate(repo: Repo, authorization: string | null) {
  const key = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!key) return null;
  return repo.findProjectByKeyHash(sha256Hex(key));
}
