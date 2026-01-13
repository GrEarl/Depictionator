import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiSession, apiError, requireWorkspaceAccess } from "@/lib/api";
import { logAudit } from "@/lib/audit";

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-1.5-flash";

async function callGemini(prompt: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { error: "GEMINI_API_KEY not configured" };
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    }
  );

  if (!response.ok) {
    return { error: `Gemini error ${response.status}` };
  }

  const data = await response.json();
  return { data };
}

async function callCodexCli(prompt: string) {
  const allowlist = (process.env.CODEX_EXEC_ALLOWLIST ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (allowlist.length === 0) {
    return { error: "CODEX_EXEC_ALLOWLIST not configured" };
  }

  const command = allowlist[0];
  return { data: { message: "Codex CLI exec disabled in this environment", command, prompt } };
}

export async function POST(request: Request) {
  let session;
  try {
    session = await requireApiSession();
  } catch {
    return apiError("Unauthorized", 401);
  }

  const form = await request.formData();
  const provider = String(form.get("provider") ?? "gemini");
  const prompt = String(form.get("prompt") ?? "").trim();
  const context = String(form.get("context") ?? "").trim();
  const workspaceId = String(form.get("workspaceId") ?? "").trim();

  if (!prompt) {
    return apiError("Prompt required", 400);
  }

  if (workspaceId) {
    try {
      await requireWorkspaceAccess(session.userId, workspaceId, "viewer");
    } catch {
      return apiError("Forbidden", 403);
    }
  }

  const log = await prisma.llmLog.create({
    data: {
      provider: provider === "codex_cli" ? "codex_cli" : "gemini",
      input: { prompt, context: context || null },
      status: "pending",
      userId: session.userId,
      workspaceId: workspaceId || null
    }
  });

  const fullPrompt = context ? `${prompt}\n\n[Context]\n${context}` : prompt;

  let result;
  if (provider === "codex_cli") {
    result = await callCodexCli(fullPrompt);
  } else {
    result = await callGemini(fullPrompt);
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
