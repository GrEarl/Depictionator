import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

export type LlmProvider = "gemini_ai" | "gemini_vertex" | "codex_cli";

export type LlmRequest = {
  provider: LlmProvider;
  prompt: string;
  model?: string;
  apiKey?: string;
  vertexProject?: string;
  vertexLocation?: string;
  codexAuthBase64?: string;
  timeoutMs?: number;
};

const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-1.5-flash";
const DEFAULT_VERTEX_MODEL = process.env.VERTEX_GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL;
const CODEX_MODEL = "gpt-5.2";
const CODEX_CLI_PATH = process.env.CODEX_CLI_PATH ?? "codex";
const CODEX_TIMEOUT_MS = Number(process.env.CODEX_EXEC_TIMEOUT_MS ?? "120000");

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
    Array.isArray(candidates) && candidates.length > 0 && isRecord(candidates[0])
      ? candidates[0]
      : null;
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

async function generateGemini(
  prompt: string,
  options: { apiKey?: string; model?: string; source: "ai_studio" | "vertex"; vertexProject?: string; vertexLocation?: string }
): Promise<string> {
  const apiKey = options.apiKey?.trim() ||
    (options.source === "vertex" ? process.env.VERTEX_GEMINI_API_KEY : process.env.GEMINI_API_KEY);
  if (!apiKey) {
    throw new Error("Gemini API key not configured");
  }
  let url = "";
  if (options.source === "vertex") {
    const project = options.vertexProject?.trim() || process.env.VERTEX_GEMINI_PROJECT;
    const location = options.vertexLocation?.trim() || process.env.VERTEX_GEMINI_LOCATION;
    if (!project || !location) {
      throw new Error("Vertex project/location not configured");
    }
    const model = options.model || DEFAULT_VERTEX_MODEL;
    url = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  } else {
    const model = options.model || DEFAULT_GEMINI_MODEL;
    url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  }

  const body: Record<string, unknown> = {
    contents: [{ parts: [{ text: prompt }] }]
  };
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gemini error ${response.status}: ${text}`);
  }
  const data = (await response.json()) as unknown;
  const text = extractGeminiText(data);
  if (!text) throw new Error("Gemini returned empty response");
  return text;
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

function parseCodexOutput(output: string): string {
  const lines = output.split("\n");
  let result = "";
  let errorMessage: string | null = null;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const event = JSON.parse(trimmed);
      if (isRecord(event)) {
        if (event.type === "error" || event.type === "turn.failed") {
          const errMessage =
            isRecord(event.error) && typeof event.error.message === "string"
              ? event.error.message
              : undefined;
          errorMessage = extractTextFromContent(event.message ?? errMessage);
          continue;
        }
        if (event.type === "message" || event.type === "thread.message") {
          const msg = event.message ?? event;
          if (isRecord(msg) && msg.role === "assistant") {
            const content = extractTextFromContent(msg.content ?? msg.text);
            if (content) result += content;
            continue;
          }
        }
        if (event.type === "text_delta" || event.type === "content_block_delta" || event.type === "delta") {
          const text = extractTextFromContent(event.text ?? event.delta ?? event.output_text);
          if (text) result += text;
          continue;
        }
      }
    } catch {
      result += trimmed + "\n";
    }
  }
  if (errorMessage) {
    throw new Error(errorMessage);
  }
  return result.trim();
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

async function generateCodex(prompt: string, authBase64?: string, timeoutMs?: number): Promise<string> {
  let authDir: string | null = null;
  const env = { ...process.env } as NodeJS.ProcessEnv;
  if (authBase64?.trim()) {
    let decoded = "";
    try {
      decoded = Buffer.from(authBase64.trim(), "base64").toString("utf8");
      JSON.parse(decoded);
    } catch {
      throw new Error("Invalid codex auth base64 (expected JSON)");
    }
    authDir = await fs.mkdtemp(path.join(os.tmpdir(), "codex-auth-"));
    await fs.writeFile(path.join(authDir, "auth.json"), decoded, "utf8");
    env.CODEX_HOME = authDir;
  }

  const args = ["exec", "--json", "--model", CODEX_MODEL, "--sandbox", "read-only", "-"];
  let child: ChildProcessWithoutNullStreams;
  try {
    child = spawn(CODEX_CLI_PATH, args, { env });
  } catch (error) {
    const message =
      isRecord(error) && error.code === "ENOENT"
        ? "Codex CLI not installed or not on PATH"
        : (error as Error).message;
    throw new Error(message);
  }

  const spawnError = await waitForSpawn(child);
  if (spawnError) {
    const message =
      isRecord(spawnError) && spawnError.code === "ENOENT"
        ? "Codex CLI not installed or not on PATH"
        : spawnError.message;
    throw new Error(message);
  }
  if (!child.stdin || !child.stdout) {
    throw new Error("Codex CLI stdio not available");
  }

  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });

  child.stdin.write(`${prompt}\n`);
  child.stdin.end();

  const timeout = timeoutMs ?? CODEX_TIMEOUT_MS;
  const timer = setTimeout(() => {
    child.kill("SIGKILL");
  }, timeout);

  const exitCode = await new Promise<number | null>((resolve, reject) => {
    const onError = (error: Error) => {
      reject(error);
    };
    child.once("error", onError);
    child.once("close", (code) => {
      child.off("error", onError);
      resolve(code);
    });
  }).finally(() => clearTimeout(timer));

  if (authDir) {
    try {
      await fs.rm(authDir, { recursive: true, force: true });
    } catch {}
  }

  if (exitCode !== 0 && exitCode !== null) {
    throw new Error(stderr.trim() || `Codex CLI exited with code ${exitCode}`);
  }

  const text = parseCodexOutput(stdout);
  if (!text) {
    throw new Error("Codex CLI returned empty response");
  }
  return text;
}

export async function generateText(request: LlmRequest): Promise<string> {
  if (request.provider === "gemini_ai") {
    return generateGemini(request.prompt, {
      source: "ai_studio",
      apiKey: request.apiKey,
      model: request.model
    });
  }
  if (request.provider === "gemini_vertex") {
    return generateGemini(request.prompt, {
      source: "vertex",
      apiKey: request.apiKey,
      model: request.model,
      vertexProject: request.vertexProject,
      vertexLocation: request.vertexLocation
    });
  }
  return generateCodex(request.prompt, request.codexAuthBase64, request.timeoutMs);
}
