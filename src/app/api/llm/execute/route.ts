import { prisma } from "@/lib/db";
import { requireApiSession, apiError, requireWorkspaceAccess } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

export const runtime = "nodejs";

const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-1.5-flash";
const DEFAULT_VERTEX_MODEL = process.env.VERTEX_GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL;
const CODEX_MODEL = "gpt-5.2";
const CODEX_CLI_PATH = process.env.CODEX_CLI_PATH ?? "codex";

const PROVIDERS = ["gemini_ai", "gemini_vertex", "codex_cli"] as const;

type Provider = (typeof PROVIDERS)[number];

type GeminiSource = "ai_studio" | "vertex";

type GeminiOptions = {
  source: GeminiSource;
  apiKey?: string;
  model: string;
  search: boolean;
  vertexProject?: string;
  vertexLocation?: string;
};

function parseProvider(value: string): Provider | null {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "gemini") return "gemini_ai";
  if (normalized === "vertex") return "gemini_vertex";
  if (normalized === "codex") return "codex_cli";
  if (normalized === "gemini_ai") return "gemini_ai";
  if (normalized === "gemini_vertex") return "gemini_vertex";
  if (normalized === "codex_cli") return "codex_cli";
  return null;
}

function getEnabledProviders(): Provider[] {
  const raw = process.env.LLM_PROVIDERS_ENABLED;
  if (!raw) return [...PROVIDERS];
  const parsed = raw
    .split(",")
    .map((entry) => parseProvider(entry))
    .filter((entry): entry is Provider => Boolean(entry));
  if (parsed.length === 0) return [...PROVIDERS];
  return Array.from(new Set(parsed));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function extractGeminiText(payload: unknown): string | null {
  if (!isRecord(payload)) return null;
  const candidates = payload.candidates;
  const candidate =
    Array.isArray(candidates) && candidates.length > 0 && isRecord(candidates[0]) ? candidates[0] : null;
  if (candidate && isRecord(candidate.content)) {
    const content = candidate.content;
    const parts = content.parts;
    if (Array.isArray(parts)) {
      return parts
        .map((part) => {
          if (typeof part === "string") return part;
          if (isRecord(part)) return readString(part.text) ?? "";
          return "";
        })
        .join("")
        .trim();
    }
    const directText = readString(content.text);
    if (directText) return directText;
  }
  const fallback = readString(payload.text);
  if (fallback) return fallback;
  return null;
}

async function* streamGemini(prompt: string, options: GeminiOptions): AsyncGenerator<string, void, unknown> {
  const apiKey = options.apiKey?.trim() ||
    (options.source === "vertex" ? process.env.VERTEX_GEMINI_API_KEY : process.env.GEMINI_API_KEY);

  if (!apiKey) {
    yield JSON.stringify({ error: "Gemini API key not configured" });
    return;
  }

  let url = "";
  if (options.source === "vertex") {
    const project = options.vertexProject?.trim() || process.env.VERTEX_GEMINI_PROJECT;
    const location = options.vertexLocation?.trim() || process.env.VERTEX_GEMINI_LOCATION;
    if (!project || !location) {
      yield JSON.stringify({ error: "Vertex project/location not configured" });
      return;
    }
    url = `https://${location}-aiplatform.googleapis.com/v1beta1/projects/${project}/locations/${location}/publishers/google/models/${options.model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;
  } else {
    url = `https://generativelanguage.googleapis.com/v1beta/models/${options.model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;
  }

  const body: Record<string, unknown> = {
    contents: [{ parts: [{ text: prompt }] }]
  };
  if (options.search) {
    body.tools = [{ googleSearch: {} }];
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const text = await response.text();
    yield JSON.stringify({ error: `Gemini error ${response.status}: ${text}` });
    return;
  }

  if (!response.body) {
     yield JSON.stringify({ error: "No response body from Gemini" });
     return;
  }

  const reader = response.body.getReader();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;
      
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      
      for (const line of lines) {
         if (line.startsWith("data: ")) {
             const jsonStr = line.slice(6).trim();
             if (jsonStr === "[DONE]") continue;
             try {
                 const data = JSON.parse(jsonStr);
                 const text = extractGeminiText(data);
                 if (text) yield text;
             } catch {
             }
         }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function waitForSpawn(child: ChildProcessWithoutNullStreams): Promise<Error | null> {
  return new Promise((resolve) => {
    const onError = (error: Error) => {
      cleanup();
      resolve(error);
    };
    const onSpawn = () => {
      cleanup();
      resolve(null);
    };
    const cleanup = () => {
      child.off("error", onError);
      child.off("spawn", onSpawn);
    };
    child.once("error", onError);
    child.once("spawn", onSpawn);
  });
}

function formatSpawnError(error: Error): string {
  if (isRecord(error) && error.code === "ENOENT") {
    return "Codex CLI not installed or not on PATH";
  }
  return `Codex CLI failed to start: ${error.message}`;
}

function extractTextFromContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (isRecord(part)) {
          return readString(part.text) ?? readString(part.output_text) ?? "";
        }
        return "";
      })
      .join("");
  }
  if (isRecord(content)) {
    return readString(content.text) ?? readString(content.output_text) ?? "";
  }
  return "";
}

async function* streamCodexCli(prompt: string, authBase64?: string): AsyncGenerator<string, void, unknown> {
  let authDir: string | null = null;
  const env = { ...process.env } as NodeJS.ProcessEnv;

  if (authBase64?.trim()) {
    let decoded = "";
    try {
      decoded = Buffer.from(authBase64.trim(), "base64").toString("utf8");
      JSON.parse(decoded);
    } catch {
      yield JSON.stringify({ error: "Invalid codex auth base64 (expected JSON)" });
      return;
    }

    authDir = await fs.mkdtemp(path.join(os.tmpdir(), "codex-auth-"));
    await fs.writeFile(path.join(authDir, "auth.json"), decoded, "utf8");
    env.CODEX_HOME = authDir;
  }

  const args = [
    "exec",
    "--json",
    "--model",
    CODEX_MODEL,
    "--sandbox",
    "read-only",
    "-"
  ];

  const child = spawn(CODEX_CLI_PATH, args, { env });
  const spawnError = await waitForSpawn(child);
  if (spawnError) {
    yield JSON.stringify({ error: formatSpawnError(spawnError) });
    return;
  }
  if (!child.stdin || !child.stdout) {
    yield JSON.stringify({ error: "Codex CLI stdio not available" });
    return;
  }
  child.stdin.write(`${prompt}\n`);
  child.stdin.end();

  let buffer = "";

  // Since we are in an async generator, let's use a more direct approach to event handling
  const readable = child.stdout;
  
  try {
    for await (const chunk of readable) {
        buffer += chunk.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
                const event = JSON.parse(trimmed);
                
                // Handle Errors immediately
                if (event.type === "error" || event.type === "turn.failed") {
                    const errMessage =
                      isRecord(event.error) && typeof event.error.message === "string"
                        ? event.error.message
                        : undefined;
                    const msg = extractTextFromContent(event.message ?? errMessage);
                    if (msg) yield `\n> *Error: ${msg}*\n`;
                    continue;
                }

                // Extract thinking process if available
                if (event.type === "thought" || event.type === "reasoning") {
                    const thought = extractTextFromContent(event.content ?? event.text);
                    if (thought) yield `> *Thinking: ${thought}*\n\n`;
                }
                
                // Extract message content
                if (event.type === "message" || event.type === "thread.message") {
                    const msg = event.message ?? event;
                    // Only output assistant messages to avoid duplicating user prompt if echoed
                    if (isRecord(msg) && msg.role === "assistant") {
                        const content = extractTextFromContent(msg.content ?? msg.text);
                        // Avoid re-yielding the whole block if it's a final message summary, 
                        // but usually stream provides deltas. 
                        // If this CLI provides full message at end, we might duplicate.
                        // Assuming events are distinct or deltas. 
                        // If 'content' is a string, it's likely a full chunk or message.
                        if (content) yield content;
                    }
                }
                
                // Extract incremental output (deltas)
                if (event.type === "text_delta" || event.type === "content_block_delta" || event.type === "delta") {
                    const text = extractTextFromContent(event.text ?? event.delta ?? event.output_text);
                    if (text) yield text;
                }
            } catch {
                // If not JSON, it might be raw output
                yield trimmed + "\n";
            }
        }
    }
  } finally {
    if (authDir) {
        try { await fs.rm(authDir, { recursive: true, force: true }); } catch {}
    }
  }

  const exitCode = await new Promise<number | null>((resolve) => {
    child.on("close", resolve);
  });

  if (exitCode !== 0 && exitCode !== null) {
      yield `\n\n[Codex CLI exited with code ${exitCode}]`;
  }
}

export async function POST(request: Request) {
  let session;
  try { session = await requireApiSession(); } catch { return apiError("Unauthorized", 401); }

  const form = await request.formData();
  const providerRaw = String(form.get("provider") ?? "");
  const provider = parseProvider(providerRaw) ?? "gemini_ai";
  const prompt = String(form.get("prompt") ?? "").trim();
  const context = String(form.get("context") ?? "").trim();
  const workspaceId = String(form.get("workspaceId") ?? "").trim();

  if (!prompt) return apiError("Prompt required", 400);

  const enabledProviders = getEnabledProviders();
  if (!enabledProviders.includes(provider)) return apiError("Provider disabled", 400);

  if (workspaceId) {
    try { await requireWorkspaceAccess(session.userId, workspaceId, "viewer"); } catch { return apiError("Forbidden", 403); }
  }

  const model = String(form.get("model") ?? "").trim();
  const search = String(form.get("search") ?? "false") === "true";
  const apiKey = String(form.get("apiKey") ?? "");
  const vertexProject = String(form.get("vertexProject") ?? "");
  const vertexLocation = String(form.get("vertexLocation") ?? "");
  const codexAuthBase64 = String(form.get("codexAuthBase64") ?? "");

  const fullPrompt = context ? `${prompt}\n\n[Context]\n${context}` : prompt;

  const logInput = {
    prompt,
    context: context || null,
    provider,
    model: provider === "codex_cli" ? CODEX_MODEL : model || null,
    search: provider === "codex_cli" ? true : search
  };

  const log = await prisma.llmLog.create({
    data: {
      provider: provider === "codex_cli" ? "codex_cli" : "gemini",
      input: logInput,
      status: "streaming",
      userId: session.userId,
      workspaceId: workspaceId || null
    }
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let fullText = "";
      let error: string | null = null;

      try {
        if (provider === "codex_cli") {
          for await (const chunk of streamCodexCli(fullPrompt, codexAuthBase64)) {
              fullText += chunk;
              controller.enqueue(encoder.encode(chunk));
          }
        } else {
          const options: GeminiOptions = {
            source: provider === "gemini_vertex" ? "vertex" : "ai_studio",
            apiKey,
            model: model || (provider === "gemini_vertex" ? DEFAULT_VERTEX_MODEL : DEFAULT_GEMINI_MODEL),
            search,
            vertexProject,
            vertexLocation
          };
          for await (const chunk of streamGemini(fullPrompt, options)) {
             if (chunk.trim().startsWith('{"error":')) {
                 controller.enqueue(encoder.encode(chunk));
                 try { const parsed = JSON.parse(chunk); if (parsed.error) error = parsed.error; } catch {}
             } else {
                 fullText += chunk;
                 controller.enqueue(encoder.encode(chunk));
             }
          }
        }
      } catch (e) {
        error = String(e);
        controller.enqueue(encoder.encode(`\n\n[Error: ${error}]`));
      } finally {
        const finalStatus = error ? "error" : "ok";
        await prisma.llmLog.update({
          where: { id: log.id },
          data: { status: finalStatus, output: { data: { text: fullText }, error } }
        });
        await logAudit({
            workspaceId: workspaceId || "system",
            actorUserId: session.userId,
            action: "llm_execute",
            targetType: "llm_log",
            targetId: log.id,
            meta: { provider, status: finalStatus }
        });
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "X-Log-Id": log.id }
  });
}
