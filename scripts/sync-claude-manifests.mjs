#!/usr/bin/env node

// Generates Claude manifests (.claude-plugin/) from the Cursor manifests
// (.cursor-plugin/) so the repo works as a Claude Code and Cowork marketplace.
// Re-run after pulling upstream changes: node scripts/sync-claude-manifests.mjs

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// plugin.json fields Claude understands. Cursor-only fields (logo, category,
// tags, displayName, minClientVersions, variables, rules) are dropped.
const PLUGIN_FIELDS = [
  "name",
  "version",
  "description",
  "author",
  "homepage",
  "repository",
  "license",
  "keywords",
];

// These ship Cursor-format hooks/hooks.json, which Claude always loads and
// rejects (and which can fail a Cowork marketplace sync), so they are left out.
const EXCLUDED_PLUGINS = new Set(["advisor", "continual-learning", "ralph-loop"]);

const loadJSON = (path) => JSON.parse(readFileSync(path, "utf-8"));
const writeJSON = (path, data) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
};
const toRelative = (source) =>
  typeof source === "string" && !source.startsWith("./") && !source.includes("://")
    ? `./${source}`
    : source;

const cursorMarketplace = loadJSON(resolve(root, ".cursor-plugin/marketplace.json"));
const plugins = cursorMarketplace.plugins.filter((entry) => !EXCLUDED_PLUGINS.has(entry.name));

for (const entry of plugins) {
  const pluginDir = resolve(root, entry.source);
  const cursorManifest = loadJSON(resolve(pluginDir, ".cursor-plugin/plugin.json"));

  const claudeManifest = {};
  for (const field of PLUGIN_FIELDS) {
    if (cursorManifest[field] !== undefined) claudeManifest[field] = cursorManifest[field];
  }

  // Cursor names the MCP file mcp.json; Claude only auto-discovers .mcp.json,
  // so point at it explicitly. skills/ and agents/ use Claude's default paths.
  if (cursorManifest.mcpServers && existsSync(resolve(pluginDir, cursorManifest.mcpServers))) {
    claudeManifest.mcpServers = cursorManifest.mcpServers;
  }

  writeJSON(resolve(pluginDir, ".claude-plugin/plugin.json"), claudeManifest);
}

writeJSON(resolve(root, ".claude-plugin/marketplace.json"), {
  ...cursorMarketplace,
  plugins: plugins.map((entry) => ({
    ...entry,
    source: toRelative(entry.source),
  })),
});

console.log(`Synced ${plugins.length} Claude plugin manifests.`);
