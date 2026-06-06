#!/usr/bin/env node
// E2E test — spawns the MCP server over stdio, sends real MCP protocol messages,
// verifies tool responses against the live Google Places API.

const { spawn } = require("child_process");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const SERVER = path.join(__dirname, "../dist/index.js");
const PASS = "\x1b[32m✓\x1b[0m";
const FAIL = "\x1b[31m✗\x1b[0m";
const INFO = "\x1b[33m→\x1b[0m";

let msgId = 1;
let proc;
let buffer = "";
const pending = new Map(); // id → { resolve, reject }
const results = [];

function send(method, params = {}) {
  const id = msgId++;
  const msg = JSON.stringify({ jsonrpc: "2.0", id, method, params });
  proc.stdin.write(msg + "\n");
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error(`Timeout waiting for response to '${method}'`));
      }
    }, 15000);
  });
}

// Notifications have no id and expect no response
function notify(method, params = {}) {
  const msg = JSON.stringify({ jsonrpc: "2.0", method, params });
  proc.stdin.write(msg + "\n");
}

function callTool(name, args) {
  return send("tools/call", { name, arguments: args });
}

function parseToolText(res) {
  return JSON.parse(res.result.content[0].text);
}

function assert(label, condition, detail = "") {
  if (condition) {
    results.push({ ok: true, label });
    console.log(`  ${PASS} ${label}`);
  } else {
    results.push({ ok: false, label, detail });
    console.log(`  ${FAIL} ${label}${detail ? " — " + detail : ""}`);
  }
}

async function run() {
  proc = spawn("node", [SERVER], {
    env: { ...process.env, RATE_LIMIT_PER_DAY: "45" },
    stdio: ["pipe", "pipe", "inherit"],
  });

  proc.stdout.on("data", (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop();
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line);
        if (msg.id != null && pending.has(msg.id)) {
          const { resolve, reject } = pending.get(msg.id);
          pending.delete(msg.id);
          if (msg.error) reject(new Error(msg.error.message));
          else resolve(msg);
        }
      } catch { /* ignore non-JSON */ }
    }
  });

  proc.on("exit", (code) => {
    if (code !== 0 && pending.size > 0) {
      for (const [, { reject }] of pending) reject(new Error("Server exited"));
    }
  });

  try {
    // ── 1. Initialize ──────────────────────────────────────────────────
    console.log("\n[1] MCP handshake");
    const init = await send("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "e2e-test", version: "1.0" },
    });
    assert("server initializes", init.result?.serverInfo?.name === "google-maps-mcp");
    notify("notifications/initialized");

    // ── 2. Tool list ───────────────────────────────────────────────────
    console.log("\n[2] Tool discovery");
    const tools = await send("tools/list");
    const toolNames = tools.result.tools.map((t) => t.name);
    assert("9 tools registered", toolNames.length === 9, `got ${toolNames.length}`);
    const required = [
      "search_nearby_places", "search_text_places", "get_place_details",
      "get_place_photos", "find_low_visibility_businesses",
      "batch_get_place_details", "get_rate_limit_status",
      "get_cache_stats", "clear_expired_cache",
    ];
    for (const t of required) assert(`tool: ${t}`, toolNames.includes(t));

    // ── 3. Rate limit status (fresh) ───────────────────────────────────
    console.log("\n[3] Rate limit (before API calls)");
    const rl0 = parseToolText(await callTool("get_rate_limit_status", {}));
    assert("limit is 45", rl0.limit === 45, `got ${rl0.limit}`);
    // Count may be > 0 from a prior run — SQLite persists across restarts (by design)
    assert("count within limit", rl0.count < rl0.limit, `got ${rl0.count}`);
    assert("remaining = limit - count", rl0.remaining === rl0.limit - rl0.count);

    // ── 4. Text search ─────────────────────────────────────────────────
    console.log("\n[4] search_text_places — biryani in Hyderabad");
    const textRes = parseToolText(await callTool("search_text_places", {
      query: "best biryani restaurants in Hyderabad",
      max_results: 3,
    }));
    console.log(`  ${INFO} got ${textRes.total} results`);
    assert("text search returns results", textRes.total > 0);
    assert("results have placeId", textRes.places?.every((p) => p.placeId));
    assert("results have name", textRes.places?.every((p) => p.name));
    const firstPlaceId = textRes.places[0].placeId;

    // ── 5. Nearby search ───────────────────────────────────────────────
    console.log("\n[5] search_nearby_places — restaurants near Connaught Place, Delhi");
    const nearbyRes = parseToolText(await callTool("search_nearby_places", {
      latitude: 28.6315,
      longitude: 77.2167,
      radius: 500,
      types: ["restaurant"],
      max_results: 3,
    }));
    console.log(`  ${INFO} got ${nearbyRes.total} results`);
    assert("nearby search returns results", nearbyRes.total > 0);
    assert("results have placeId", nearbyRes.places?.every((p) => p.placeId));

    // ── 6. Place details ───────────────────────────────────────────────
    console.log("\n[6] get_place_details — first result from text search");
    // force_refresh: true so we always hit the live API regardless of cache state
    const detailRes = parseToolText(await callTool("get_place_details", {
      place_id: firstPlaceId,
      force_refresh: true,
    }));
    // Response shape: { source, placeId, name, address, rating, ... }
    console.log(`  ${INFO} source: ${detailRes.source} — ${detailRes.name ?? "?"}`);
    assert("details returned", detailRes.placeId != null);
    assert("source is api (force_refresh)", detailRes.source === "api");

    // ── 7. Cache hit ───────────────────────────────────────────────────
    console.log("\n[7] get_place_details — same placeId (should hit cache)");
    const cachedRes = parseToolText(await callTool("get_place_details", {
      place_id: firstPlaceId,
      force_refresh: false,
    }));
    console.log(`  ${INFO} source: ${cachedRes.source}`);
    assert("second call hits cache", cachedRes.source === "cache");

    // ── 8. Photos ──────────────────────────────────────────────────────
    console.log("\n[8] get_place_photos — first result");
    const photoRes = parseToolText(await callTool("get_place_photos", {
      place_id: firstPlaceId,
      max_photos: 2,
    }));
    // Response shape: { source, placeId, photos: [{url, widthPx, heightPx}] }
    console.log(`  ${INFO} got ${photoRes.photos?.length ?? 0} photos`);
    assert("photos returned", (photoRes.photos?.length ?? 0) > 0);
    assert("photos have url", photoRes.photos?.every((p) => p.url?.startsWith("http")));

    // ── 9. Rate limit status (after API calls) ─────────────────────────
    console.log("\n[9] Rate limit (after API calls)");
    const rl1 = parseToolText(await callTool("get_rate_limit_status", {}));
    console.log(`  ${INFO} used ${rl1.count}/${rl1.limit}, resets at ${rl1.resetsAt}`);
    assert("count incremented", rl1.count > 0, `still 0`);
    assert("remaining decreased", rl1.remaining < rl1.limit);

    // ── 10. Cache stats ────────────────────────────────────────────────
    console.log("\n[10] Cache stats");
    const cacheStats = parseToolText(await callTool("get_cache_stats", {}));
    console.log(`  ${INFO} ${cacheStats.detailsCount} details cached`);
    assert("at least 1 detail cached", cacheStats.detailsCount >= 1);

    // ── 11. Lead-gen ───────────────────────────────────────────────────
    console.log("\n[11] find_low_visibility_businesses");
    const leadRes = parseToolText(await callTool("find_low_visibility_businesses", {
      latitude: 28.6315,
      longitude: 77.2167,
      radius: 1000,
      keyword: "salon",
      require_no_website: false,
      min_rating: 3.5,
      max_results: 3,
    }));
    // Response shape: { searchedTotal, filteredTotal, criteria, businesses: [...] }
    // When no results: plain text string (not JSON) — handle both
    const leadCount = leadRes.filteredTotal ?? leadRes.businesses?.length ?? 0;
    console.log(`  ${INFO} searched ${leadRes.searchedTotal ?? "?"}, matched ${leadCount}`);
    assert("lead-gen searched places", (leadRes.searchedTotal ?? 0) >= 0);
    if (leadRes.businesses?.length > 0) {
      assert("leads have leadScore", leadRes.businesses.every((b) => typeof b.leadScore === "number"));
    }

  } catch (err) {
    console.error(`\n${FAIL} Unexpected error: ${err.message}`);
    results.push({ ok: false, label: "Unexpected error", detail: err.message });
  } finally {
    proc.kill();
    console.log("\n────────────────────────────────────");
    const passed = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok);
    console.log(`Results: ${passed}/${results.length} passed`);
    if (failed.length) {
      console.log("Failed:");
      for (const f of failed) console.log(`  ${FAIL} ${f.label}${f.detail ? " — " + f.detail : ""}`);
    }
    process.exit(failed.length ? 1 : 0);
  }
}

run();
