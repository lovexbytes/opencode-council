import fs from "fs/promises";
import type { Dirent } from "fs";
import os from "os";
import path from "path";

export type TranscriptFile = {
  filename: string;
  filePath: string;
  updatedAt: number;
};

function getProjectTranscriptDir(projectDir?: string): string | null {
  if (!projectDir) return null;
  if (projectDir.trim().length === 0) return null;
  return path.join(projectDir, ".opencode", "council-transcripts");
}

function getHomeTranscriptDir(): string {
  return path.join(os.homedir(), ".config", "opencode", "council-transcripts");
}

export async function resolveTranscriptDirectory(projectDir?: string): Promise<string> {
  const projectPath = getProjectTranscriptDir(projectDir);
  const homePath = getHomeTranscriptDir();
  const candidates = projectPath ? [projectPath, homePath] : [homePath];

  for (const candidate of candidates) {
    try {
      await fs.mkdir(candidate, { recursive: true });
      return candidate;
    } catch {
      // try next
    }
  }

  return homePath;
}

export async function saveCouncilTranscript(input: {
  projectDir?: string;
  sessionID: string;
  content: string;
}): Promise<{ filePath: string; filename: string }> {
  const dir = await resolveTranscriptDirectory(input.projectDir);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `council-${timestamp}-${input.sessionID}.md`;
  const filePath = path.join(dir, filename);
  await fs.writeFile(filePath, input.content, "utf-8");
  return { filePath, filename };
}

export async function listCouncilTranscripts(projectDir?: string): Promise<TranscriptFile[]> {
  const dir = await resolveTranscriptDirectory(projectDir);
  let entries: Dirent[] = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const files = await Promise.all(
    entries
      .filter((entry) => entry.isFile())
      .map(async (entry) => {
        const filePath = path.join(dir, entry.name);
        try {
          const stat = await fs.stat(filePath);
          return {
            filename: entry.name,
            filePath,
            updatedAt: stat.mtimeMs,
          };
        } catch {
          return null;
        }
      }),
  );

  return files
    .filter((file): file is TranscriptFile => Boolean(file))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function readCouncilTranscript(input: {
  projectDir?: string;
  file: string;
}): Promise<{ filePath: string; content: string }> {
  const dir = await resolveTranscriptDirectory(input.projectDir);
  const candidate = path.isAbsolute(input.file)
    ? input.file
    : path.join(dir, path.basename(input.file));
  const resolvedDir = path.resolve(dir) + path.sep;
  const resolvedFile = path.resolve(candidate);

  if (!resolvedFile.startsWith(resolvedDir)) {
    throw new Error("Transcript file must be inside the council transcripts directory.");
  }

  const content = await fs.readFile(resolvedFile, "utf-8");
  return { filePath: resolvedFile, content };
}
