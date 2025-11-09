#!/usr/bin/env node
// Minimal MCP server that stores latest pick in memory and exposes one tool.
// Requires: npm i @modelcontextprotocol/sdk express cors body-parser

import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, ListResourcesRequestSchema, ReadResourceRequestSchema } from "@modelcontextprotocol/sdk/types.js";

let latestPick = null;
let mcp = null;
let mcpReady = false;
let clientCaps = null;
let latestBundle = null;
const LOG_URI = "mcp://browser-picks/logs";
const LOG_MIME = "text/plain";
const MAX_LOG_LINES = 20000;
let logBuffer = [];

function appendLog(line) {
    try {
        const ts = new Date().toISOString();
        logBuffer.push(`[${ts}] ${line}`);
        if (logBuffer.length > MAX_LOG_LINES) {
            logBuffer.splice(0, logBuffer.length - MAX_LOG_LINES);
        }
        mcp?.sendResourceUpdated?.({ uri: LOG_URI });
    } catch (_) { }
}

// Capture console output into the log resource as well
const _orig = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    debug: console.debug ? console.debug.bind(console) : console.log.bind(console)
};
function _stringifyArg(a) {
    if (a instanceof Error) return a.stack || String(a);
    if (typeof a === "string") return a;
    try { return JSON.stringify(a); } catch { return String(a); }
}
console.log = (...args) => { try { appendLog(`log: ${args.map(_stringifyArg).join(" ")}`); } catch { } _orig.log(...args); };
console.info = (...args) => { try { appendLog(`info: ${args.map(_stringifyArg).join(" ")}`); } catch { } _orig.info(...args); };
console.warn = (...args) => { try { appendLog(`warn: ${args.map(_stringifyArg).join(" ")}`); } catch { } _orig.warn(...args); };
console.error = (...args) => { try { appendLog(`error: ${args.map(_stringifyArg).join(" ")}`); } catch { } _orig.error(...args); };
console.debug = (...args) => { try { appendLog(`debug: ${args.map(_stringifyArg).join(" ")}`); } catch { } _orig.debug(...args); };

// HTTP side: receive picks from the Chrome extension
const http = express();
http.use(cors());
http.use(bodyParser.json({ limit: "2mb" }));
// Log inbound requests
http.use((req, _res, next) => { try { appendLog(`http ${req.method} ${req.url}`); } catch { } next(); });
http.post("/pick", async (req, res) => {
    latestPick = req.body;
    res.json({ ok: true });
    // Also auto-post into Cursor chat if connected
    try {
        console.error(`Received pick for: ${latestPick?.url || "unknown URL"}`);
        appendLog(`pick url=${latestPick?.url || "unknown"} selector=${latestPick?.selector || ""}`);
        const { title, url, selector, bbox, html, styles } = latestPick;
        const md = [
            `Source: ${title} — ${url}`,
            `Selector: \`${selector}\``,
            `BBox: ${Math.round(bbox.w)}×${Math.round(bbox.h)} @ (${Math.round(bbox.x)},${Math.round(bbox.y)})`,
            ``,
            `### HTML`,
            "```html",
            html,
            "```",
            ``,
            `### Computed styles`,
            "```css",
            Object.entries(styles).map(([k, v]) => `${k}: ${v};`).join("\n"),
            "```"
        ].join("\n");
        // Only attempt auto-chat if client supports sampling/createMessage
        if (mcp && mcpReady && clientCaps && clientCaps.sampling) {
            // Non-blocking: ask Cursor to create a user message with the pick
            void mcp.createMessage({
                messages: [
                    {
                        role: "user",
                        content: { type: "text", text: md }
                    }
                ]
            }).catch(err => console.error(err && err.stack ? err.stack : String(err)));
        } else {
            console.error("Auto-chat not available (client lacks sampling/createMessage or MCP not ready); pick stored for tool retrieval.");
            try { mcp?.sendLoggingMessage({ level: "notice", data: "Auto-chat not available; pick stored for tool retrieval." }); } catch (_) { }
            appendLog("notice: auto-chat not available; pick stored for tool retrieval.");
        }
    } catch (err) {
        console.error(err && err.stack ? err.stack : String(err));
        try { mcp?.sendLoggingMessage({ level: "error", data: { event: "pick_error", message: String(err) } }); } catch (_) { }
        appendLog(`error: pick_error ${String(err)}`);
    }
});
const server = http.listen(9000, () => {
    console.error("MCP bridge HTTP up on :9000");
    try { mcp?.sendLoggingMessage?.({ level: "info", data: "HTTP bridge listening on :9000" }); } catch (_) { }
    // Initialize MCP only after we own the HTTP port, so only the primary instance connects.
    mcp = new Server(
        { name: "browser-element-picks", version: "0.1.0" },
        { capabilities: { tools: {}, logging: {}, resources: { subscribe: true, listChanged: true } } }
    );
    // Mark when Cursor has completed initialization so createMessage can be used
    mcp.oninitialized = () => {
        mcpReady = true;
        try {
            clientCaps = mcp.getClientCapabilities?.() || null;
        } catch (_) {
            clientCaps = null;
        }
        console.error("MCP stdio initialized; ready to create messages.");
        try { mcp.sendLoggingMessage({ level: "info", data: "MCP initialized; ready." }); } catch (_) { }
        try { mcp.sendResourceListChanged(); } catch (_) { }
    };
    // List available tools
    mcp.setRequestHandler(ListToolsRequestSchema, async (_request, _extra) => {
        return {
            tools: [
                {
                    name: "get_last_pick",
                    description: "Return the most recent element pick as Markdown",
                    inputSchema: {
                        type: "object",
                        properties: {},
                    }
                },
                {
                    name: "get_last_bundle",
                    description: "Return the most recent bundle (chat + multiple element picks) as Markdown",
                    inputSchema: {
                        type: "object",
                        properties: {},
                    }
                }
            ]
        };
    });
    // Handle tool calls
    mcp.setRequestHandler(CallToolRequestSchema, async (request, _extra) => {
        if (request.params.name === "get_last_pick") {
            if (!latestPick) {
                return {
                    content: [{ type: "text", text: "No pick yet. Right-click an element → Send to Cursor." }]
                };
            }
            const { title, url, selector, bbox, html, styles } = latestPick;
            const md = [
                `Source: ${title} — ${url}`,
                `Selector: \`${selector}\``,
                `BBox: ${Math.round(bbox.w)}×${Math.round(bbox.h)} @ (${Math.round(bbox.x)},${Math.round(bbox.y)})`,
                ``,
                `### HTML`,
                "```html",
                html,
                "```",
                ``,
                `### Computed styles`,
                "```css",
                Object.entries(styles).map(([k, v]) => `${k}: ${v};`).join("\n"),
                "```"
            ].join("\n");
            return { content: [{ type: "text", text: md }] };
        }
        if (request.params.name === "get_last_bundle") {
            if (!latestBundle) {
                return {
                    content: [{ type: "text", text: "No bundle yet. Use the popup to select elements and press Send All." }]
                };
            }
            const lines = [];
            // Short summary line with just tags
            const tags = latestBundle.picks.map(p => `<${(p.selector && p.selector.split(/[#.\s>:]/)[0]) ? p.selector.split(/[#.\s>:]/)[0].replace(/:nth-of-type\(\d+\)/, '') : (p.html?.match(/^<\s*([a-zA-Z0-9\-]+)/)?.[1] || 'el')}>`);
            if (tags.length) lines.push(`Elements: ${tags.join(", ")}`, "");
            if (latestBundle.chat) lines.push(latestBundle.chat, "");
            for (const item of latestBundle.picks) {
                lines.push(
                    `Source: ${item.title} — ${item.url}`,
                    `Selector: \`${item.selector}\``,
                    `BBox: ${Math.round(item.bbox.w)}×${Math.round(item.bbox.h)} @ (${Math.round(item.bbox.x)},${Math.round(item.bbox.y)})`,
                    ``,
                    `### HTML`,
                    "```html",
                    item.html,
                    "```",
                    ``,
                    `### Computed styles`,
                    "```css",
                    Object.entries(item.styles || {}).map(([k, v]) => `${k}: ${v};`).join("\n"),
                    "```",
                    ``
                );
            }
            const md = lines.join("\n");
            return { content: [{ type: "text", text: md }] };
        }
        throw new Error(`Unknown tool: ${request.params.name}`);
    });
    // Resources: list and read logs
    mcp.setRequestHandler(ListResourcesRequestSchema, async () => {
        return {
            resources: [
                {
                    name: "browser-picks-logs",
                    title: "Browser Picks Logs",
                    uri: LOG_URI,
                    description: "Live logs from the Browser Picks MCP bridge",
                    mimeType: LOG_MIME
                }
            ]
        };
    });
    mcp.setRequestHandler(ReadResourceRequestSchema, async (request) => {
        if (request.params.uri !== LOG_URI) {
            return { contents: [] };
        }
        return {
            contents: [
                {
                    uri: LOG_URI,
                    mimeType: LOG_MIME,
                    text: logBuffer.join("\n")
                }
            ]
        };
    });
    // Create stdio transport and connect
    const transport = new StdioServerTransport();
    mcp.connect(transport).catch(console.error);
});
server.on("error", (err) => {
    if (err && err.code === "EADDRINUSE") {
        console.error("Port 9000 already in use; exiting so the primary collector remains.");
        try { mcp?.sendLoggingMessage?.({ level: "error", data: "Port 9000 in use; exiting duplicate process." }); } catch (_) { }
        appendLog("error: port 9000 in use; exiting duplicate process.");
        setTimeout(() => process.exit(0), 10);
    } else {
        console.error(err && err.stack ? err.stack : String(err));
        try { mcp?.sendLoggingMessage?.({ level: "error", data: { event: "server_error", message: String(err) } }); } catch (_) { }
        appendLog(`error: server_error ${String(err)}`);
    }
});
// Accept bundles of chat + picks
http.post("/bundle", async (req, res) => {
    try {
        const { chat, picks } = req.body || {};
        if (!Array.isArray(picks) && !chat) {
            return res.status(400).json({ ok: false, error: "Missing picks/chat" });
        }
        latestBundle = { chat: chat || "", picks: Array.isArray(picks) ? picks : [] };
        res.json({ ok: true });
        appendLog(`bundle picks=${latestBundle.picks.length} hasChat=${!!latestBundle.chat}`);
        try { mcp?.sendLoggingMessage({ level: "info", data: { event: "bundle", picks: latestBundle.picks.length, hasChat: !!latestBundle.chat } }); } catch (_) { }
        const lines = [];
        if (latestBundle.chat) {
            lines.push(latestBundle.chat, "");
        }
        for (const item of latestBundle.picks) {
            lines.push(
                `Source: ${item.title} — ${item.url}`,
                `Selector: \`${item.selector}\``,
                `BBox: ${Math.round(item.bbox.w)}×${Math.round(item.bbox.h)} @ (${Math.round(item.bbox.x)},${Math.round(item.bbox.y)})`,
                ``,
                `### HTML`,
                "```html",
                item.html,
                "```",
                ``,
                `### Computed styles`,
                "```css",
                Object.entries(item.styles || {}).map(([k, v]) => `${k}: ${v};`).join("\n"),
                "```",
                ``
            );
        }
        const md = lines.join("\n");
        if (mcp && mcpReady && clientCaps && clientCaps.sampling) {
            void mcp.createMessage({
                messages: [{ role: "user", content: { type: "text", text: md } }]
            }).catch(err => console.error(err && err.stack ? err.stack : String(err)));
        } else {
            console.error("Auto-chat not available; bundle stored for tool retrieval.");
            try { mcp?.sendLoggingMessage({ level: "notice", data: "Auto-chat not available; bundle stored for tool retrieval." }); } catch (_) { }
        }
    } catch (e) {
        console.error(e && e.stack ? e.stack : String(e));
        try { res.status(500).json({ ok: false }); } catch (_) { }
        try { mcp?.sendLoggingMessage({ level: "error", data: { event: "bundle_error", message: String(e) } }); } catch (_) { }
    }
});

