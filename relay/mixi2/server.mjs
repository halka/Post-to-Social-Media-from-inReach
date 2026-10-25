/**
 * Receives a post from the Worker and posts it to mixi2. Cloudflare Workers cannot
 * send gRPC, which is the only protocol the mixi2 API accepts, so this runs on
 * Node.js: in a Cloudflare Container next to the Worker (worker/mixi2-container.ts),
 * or elsewhere (Cloud Run, Fly.io, Render, your own server, ...).
 *
 * Elsewhere, it is reachable from the internet, so it requires RELAY_TOKEN and
 * the Worker's WEBHOOK_URL is https://<this server>/?token=<RELAY_TOKEN>.
 * In a Container, only the Worker can reach it and RELAY_INTERNAL=1 turns the token off.
 */

import { createHash, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { Client, OAuth2Authenticator } from "mixi2-js";
import { apiAddress, tokenUrl } from "mixi2-js/helpers";
import { fitPost } from "./fit.mjs";

const { MIXI2_CLIENT_ID, MIXI2_CLIENT_SECRET, MIXI2_AUTH_KEY, RELAY_TOKEN, RELAY_INTERNAL, PORT = "8080" } = process.env;
const internal = RELAY_INTERNAL === "1";
if (!MIXI2_CLIENT_ID || !MIXI2_CLIENT_SECRET || (!RELAY_TOKEN && !internal)) {
  console.error("Set MIXI2_CLIENT_ID, MIXI2_CLIENT_SECRET and RELAY_TOKEN");
  process.exit(1);
}

const client = new Client({
  apiAddress,
  authenticator: new OAuth2Authenticator({ clientId: MIXI2_CLIENT_ID, clientSecret: MIXI2_CLIENT_SECRET, tokenUrl }),
  authKey: MIXI2_AUTH_KEY || undefined,
});

const MAX_BODY_BYTES = 64 * 1024;

/** Compare hashes so the comparison takes the same time whatever the token's length. */
function tokenMatches(token) {
  const digest = (s) => createHash("sha256").update(s).digest();
  return typeof token === "string" && timingSafeEqual(digest(token), digest(RELAY_TOKEN));
}

function reply(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

createServer(async (req, res) => {
  // Health checks from the hosting service.
  if (req.method === "GET") return reply(res, 200, { ok: true });
  if (req.method !== "POST") return reply(res, 405, { error: "POST only" });

  const url = new URL(req.url ?? "/", "http://localhost");
  const bearer = /^Bearer (.+)$/.exec(req.headers.authorization ?? "")?.[1];
  if (!internal && !tokenMatches(url.searchParams.get("token") ?? bearer)) return reply(res, 401, { error: "Bad token" });

  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) return reply(res, 413, { error: "Too large" });
    chunks.push(chunk);
  }
  let payload;
  try {
    payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return reply(res, 400, { error: "Body must be JSON" });
  }

  const text = fitPost(payload ?? {});
  if (text === "") return reply(res, 400, { error: "No text" });
  try {
    const post = await client.createPost({ text });
    console.log(`Posted to mixi2: ${post.postId}`);
    reply(res, 200, { id: post.postId });
  } catch (error) {
    console.error("Error posting to mixi2:", error);
    // 502 makes the Worker log this as a failed destination.
    reply(res, 502, { error: String(error?.message ?? error) });
  }
}).listen(Number(PORT), () => console.log(`Listening on ${PORT}`));
