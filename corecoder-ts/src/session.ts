import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ChatMessage } from "./types.js";

export type SessionRecord = {
  id: string;
  model: string;
  savedAt: string;
  messages: ChatMessage[];
};

export type SessionSummary = {
  id: string;
  model: string;
  savedAt: string;
  preview: string;
};

let sessionDirOverride: string | undefined;

export function setSessionDirForTests(path: string | undefined): void {
  sessionDirOverride = path;
}

function sessionDir(): string {
  return sessionDirOverride ?? join(homedir(), ".corecoder", "sessions");
}

export function sanitizeSessionId(id: string): string {
  const pathless = id.split(/[\\/]+/).filter(Boolean).at(-1) ?? id;
  const cleaned = pathless.replace(/[^a-zA-Z0-9._-]+/g, "-");
  return cleaned.replace(/^[.-]+|[.-]+$/g, "") || "session";
}

export async function saveSession(
  messages: ChatMessage[],
  model: string,
  id = new Date().toISOString().replaceAll(":", "-").replace(/\.\d+Z$/, "Z")
): Promise<string> {
  const safeId = sanitizeSessionId(id);
  await mkdir(sessionDir(), { recursive: true });
  const record: SessionRecord = {
    id: safeId,
    model,
    savedAt: new Date().toISOString(),
    messages
  };
  await writeFile(join(sessionDir(), `${safeId}.json`), JSON.stringify(record, null, 2), "utf8");
  return safeId;
}

export async function loadSession(id: string): Promise<[ChatMessage[], string] | undefined> {
  const safeId = sanitizeSessionId(id);
  try {
    const raw = await readFile(join(sessionDir(), `${safeId}.json`), "utf8");
    const record = JSON.parse(raw) as SessionRecord;
    return [record.messages, record.model];
  } catch {
    return undefined;
  }
}

export async function listSessions(): Promise<SessionSummary[]> {
  let names: string[];
  try {
    names = await readdir(sessionDir());
  } catch {
    return [];
  }

  const summaries: SessionSummary[] = [];
  for (const name of names.filter((entry) => entry.endsWith(".json"))) {
    try {
      const raw = await readFile(join(sessionDir(), name), "utf8");
      const record = JSON.parse(raw) as SessionRecord;
      const firstUser = record.messages.find((message) => message.role === "user");
      summaries.push({
        id: record.id,
        model: record.model,
        savedAt: record.savedAt,
        preview: firstUser?.content.slice(0, 80) ?? ""
      });
    } catch {
      continue;
    }
  }
  return summaries.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}
