import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiSession, apiError, requireWorkspaceAccess } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

export const runtime = "nodejs";

const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-1.5-flash";
const DEFAULT_VERTEX_MODEL = process.env.VERTEX_GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL;
const CODEX_MODEL = "gpt-5.2";
const CODEX_CLI_PATH = process.env.CODEX_CLI_PATH ?? "codex";
const CODEX_TIMEOUT_MS = Number(process.env.CODEX_EXEC_TIMEOUT_MS ?? "120000");

const PROVIDERS = ["gemini_ai", "gemini_vertex", "codex_cli"] as const;

type Provider = (typeof PROVIDERS)[number];

type LlmResult = {
  data?: {
    text?: string;
    raw?: unknown;
    meta?: Record<string, unknown>;
  };
  error?: string;
};

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
    if (directText) return directText.trim();
  }
  const fallback = readString(payload.text);
  if (fallback) return fallback.trim();
  return null;
}

async function callGemini(prompt: string, options: GeminiOptions): Promise<LlmResult> {
  const apiKey = options.apiKey?.trim() ||
    (options.source === "vertex" ? process.env.VERTEX_GEMINI_API_KEY : process.env.GEMINI_API_KEY);

  if (!apiKey) {
    return { error: "Gemini API key not configured" };
  }

  let url = "";
  if (options.source === "vertex") {
    const project = options.vertexProject?.trim() || process.env.VERTEX_GEMINI_PROJECT;
    const location = options.vertexLocation?.trim() || process.env.VERTEX_GEMINI_LOCATION;
    if (!project || !location) {
      return { error: "Vertex project/location not configured" };
    }
    url = `https://${location}-aiplatform.googleapis.com/v1beta1/projects/${project}/locations/${location}/publishers/google/models/${options.model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  } else {
    url = `https://generativelanguage.googleapis.com/v1beta/models/${options.model}:generateContent?key=${encodeURIComponent(apiKey)}`;
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

  const textPayload = await response.text();
  let data: unknown = textPayload;
  try {
    data = JSON.parse(textPayload);
  } catch {
    data = textPayload;
  }

  if (!response.ok) {
    return {
      error: `Gemini error ${response.status}`,
      data: { raw: data }
    };
  }

  const text = extractGeminiText(data);
  if (!text) {
    return { error: "Gemini returned no text output", data: { raw: data } };
  }

  return { data: { text, raw: data } };
}

function parseJsonLines(output: string): unknown[] {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return { type: "raw", text: line };
      }
    });
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

function extractCodexText(events: unknown[]): string | null {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const entry = events[index];
    if (!isRecord(entry)) continue;
    if (entry.type === "message" && isRecord(entry.message) && entry.message.role === "assistant") {
      const content = "content" in entry.message ? entry.message.content : undefined;
      const text = extractTextFromContent(content ?? entry.message.text);
      if (text.trim()) return text.trim();
    }
    if (entry.role === "assistant") {
      const content = "content" in entry ? entry.content : undefined;
      const text = extractTextFromContent(content ?? entry.text);
      if (text.trim()) return text.trim();
    }
    if (entry.type === "output_text") {
      const text = extractTextFromContent(entry.text ?? entry.output_text);
      if (text.trim()) return text.trim();
    }
  }
  return null;
}

async function runCommand(
  command: string,
  args: string[],
  input: string,
  env: NodeJS.ProcessEnv,
  timeoutMs: number
) {
  return new Promise<{ stdout: string; stderr: string; exitCode: number | null; timedOut: boolean }>(
    (resolve, reject) => {
      const child = spawn(command, args, { env });
      let stdout = "";
      let stderr = "";
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill();
      }, timeoutMs);

      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
      });

      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });

      child.on("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });

      child.on("close", (code) => {
        clearTimeout(timer);
        resolve({ stdout, stderr, exitCode: code, timedOut });
      });

      if (input) {
        child.stdin.write(`${input}\n`);
      }
      child.stdin.end();
    }
  );
}

async function callCodexCli(prompt: string, authBase64?: string): Promise<LlmResult> {
  let authDir: string | null = null;
  const env = { ...process.env } as NodeJS.ProcessEnv;

  if (authBase64?.trim()) {
    let decoded = "";
    try {
      decoded = Buffer.from(authBase64.trim(), "base64").toString("utf8");
      JSON.parse(decoded);
    } catch {
      return { error: "Invalid codex auth base64 (expected JSON)" };
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
    "--search",
    "true",
    "--sandbox",
    "read-only",
    "--ask-for-approval",
    "never",
    "-"
  ];

  try {
    const { stdout, stderr, exitCode, timedOut } = await runCommand(
      CODEX_CLI_PATH,
      args,
      prompt,
      env,
      CODEX_TIMEOUT_MS
    );

    if (timedOut) {
      return { error: "Codex CLI timed out" };
    }

    const events = parseJsonLines(stdout);
    const text = extractCodexText(events);
    const data = { text: text ?? undefined, raw: events, meta: { exitCode, stderr } };

    if (exitCode && exitCode !== 0) {
      return { error: `Codex CLI exited with code ${exitCode}`, data };
    }

    if (!text) {
      return { error: "Codex CLI returned no text output", data };
    }

    return { data };
  } catch (error: unknown) {
    if (isRecord(error) && error.code === "ENOENT") {
      return { error: "Codex CLI not installed or not on PATH" };
    }
    if (isRecord(error) && typeof error.message === "string") {
      return { error: `Codex CLI error: ${error.message}` };
    }
    return { error: "Codex CLI error: unknown error" };
  } finally {
    if (authDir) {
      try {
        await fs.rm(authDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup failure in temp dir.
      }
    }
  }
}

export async function POST(request: Request) {
  let session;
  try {
    session = await requireApiSession();
  } catch {
    return apiError("Unauthorized", 401);
  }

  const form = await request.formData();
  const providerRaw = String(form.get("provider") ?? "");
  const provider = parseProvider(providerRaw) ?? "gemini_ai";
  const prompt = String(form.get("prompt") ?? "").trim();
  const context = String(form.get("context") ?? "").trim();
  const workspaceId = String(form.get("workspaceId") ?? "").trim();

  if (!prompt) {
    return apiError("Prompt required", 400);
  }

  const enabledProviders = getEnabledProviders();
  if (!enabledProviders.includes(provider)) {
    return apiError("Provider disabled", 400);
  }

  if (workspaceId) {
    try {
      await requireWorkspaceAccess(session.userId, workspaceId, "viewer");
    } catch {
      return apiError("Forbidden", 403);
    }
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
    search: provider === "codex_cli" ? true : search,
    apiKeyProvided: Boolean(apiKey?.trim()),
    codexAuthProvided: Boolean(codexAuthBase64?.trim())
  };

  const log = await prisma.llmLog.create({
    data: {
      provider: provider === "codex_cli" ? "codex_cli" : "gemini",
      input: logInput,
      status: "pending",
      userId: session.userId,
      workspaceId: workspaceId || null
    }
  });

  let result: LlmResult;
  if (provider === "codex_cli") {
    result = await callCodexCli(fullPrompt, codexAuthBase64);
  } else if (provider === "gemini_vertex") {
    result = await callGemini(fullPrompt, {
      source: "vertex",
      apiKey,
      model: model || DEFAULT_VERTEX_MODEL,
      search,
      vertexProject,
      vertexLocation
    });
  } else {
    result = await callGemini(fullPrompt, {
      source: "ai_studio",
      apiKey,
      model: model || DEFAULT_GEMINI_MODEL,
      search,
      vertexProject: undefined,
      vertexLocation: undefined
    });
  }

  const status = result.error ? "error" : "ok";
  await prisma.llmLog.update({
    where: { id: log.id },
    data: { output: result, status }
  });

  await logAudit({
    workspaceId: workspaceId || "system",
    actorUserId: session.userId,
    action: "llm_execute",
    targetType: "llm_log",
    targetId: log.id,
    meta: { provider, status }
  });

  return NextResponse.json({ status, result, logId: log.id });
}
