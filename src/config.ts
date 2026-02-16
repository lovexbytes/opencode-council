import fs from "fs/promises";
import path from "path";
import os from "os";
import { z } from "zod";

const CouncilConfigSchema = z.object({
  members: z.array(z.string()).min(3, "Council requires at least 3 members.").max(10, "Council supports up to 10 members."),
  speaker: z.string().min(1, "Speaker model is required."),
  serverUrl: z.string().min(1, "serverUrl cannot be empty.").optional(),
  discussion: z
    .object({
      maxTurns: z.number().int().min(1).max(12).default(6),
    })
    .optional(),
});

export type CouncilConfig = z.infer<typeof CouncilConfigSchema> & {
  discussion: {
    maxTurns: number;
  };
};

const DEFAULT_CONFIG_BASENAME = "council.json";

export async function loadCouncilConfig(projectDir: string): Promise<CouncilConfig> {
  const envPath = process.env.OPENCODE_COUNCIL_CONFIG;
  const candidatePaths = [
    envPath,
    path.join(projectDir, ".opencode", DEFAULT_CONFIG_BASENAME),
    path.join(os.homedir(), ".config", "opencode", DEFAULT_CONFIG_BASENAME),
  ].filter(Boolean) as string[];

  let raw: string | null = null;
  let usedPath: string | null = null;

  for (const candidate of candidatePaths) {
    try {
      raw = await fs.readFile(candidate, "utf-8");
      usedPath = candidate;
      break;
    } catch {
      // continue
    }
  }

  if (!raw) {
    throw new Error(
      `Council configuration not found. Create ${DEFAULT_CONFIG_BASENAME} in ${path.join(
        projectDir,
        ".opencode",
      )} or ~/.config/opencode/ (or set OPENCODE_COUNCIL_CONFIG).`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Council configuration at ${usedPath ?? "unknown"} is not valid JSON.`);
  }

  const result = CouncilConfigSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => issue.message).join(" ");
    throw new Error(`Council configuration invalid: ${issues}`);
  }

  return {
    ...result.data,
    discussion: {
      maxTurns: result.data.discussion?.maxTurns ?? 6,
    },
  };
}
