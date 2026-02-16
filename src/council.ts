import type { PluginInput, ToolContext } from "@opencode-ai/plugin";
import { loadCouncilConfig, type CouncilConfig } from "./config";
import { parseModelRef, type ModelRef } from "./models";

const STAGES = [
  "🏛 Council — Initial discussions...",
  "🏛 Council — Refining solutions...",
  "🏛 Council — Voting phase...",
  "🏛 Council — Synthesizing winner...",
];

type CouncilMember = {
  name: string;
  model: string;
  ref: ModelRef;
};

type TranscriptEntry = {
  phase: string;
  speaker: string;
  content: string;
};

type Part = {
  type: string;
  text?: string;
};

function extractText(parts: Part[]): string {
  return parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

function memberLabel(member: CouncilMember, index?: number): string {
  const modelName = member.model?.split("/").pop() ?? member.model ?? member.name;
  // Use seat number for display with model name
  if (index !== undefined) {
    return `Seat ${index + 1} (${modelName})`;
  }
  // Fallback: extract seat number from member name if it follows "Member N" pattern
  const seatMatch = member.name.match(/Member\s+(\d+)/);
  if (seatMatch) {
    return `Seat ${seatMatch[1]} (${modelName})`;
  }
  return `${member.name} (${modelName})`;
}

function indentText(text: string, prefix = "  "): string {
  return text
    .split("\n")
    .map((line) => `${prefix}${line}`)
    .join("\n");
}

function formatTranscript(entries: TranscriptEntry[]): string {
  return entries
    .map((entry) => `${entry.speaker} (${entry.phase})\n${entry.content}`)
    .join("\n\n-----\n\n");
}

function pickJson(text: string): unknown {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function ensureSpeaker(model: string): ModelRef {
  return parseModelRef(model);
}

function buildMembers(config: CouncilConfig): CouncilMember[] {
  return config.members.map((model, index) => ({
    name: `Member ${index + 1}`,
    model,
    ref: parseModelRef(model),
  }));
}

async function createDiscussionSession(input: PluginInput, context: ToolContext) {
  const created = await input.client.session.create({
    body: { parentID: context.sessionID, title: "Council deliberation" },
    query: { directory: context.directory },
  });
  const sessionID = created.data?.id;
  if (!sessionID) {
    throw new Error("Unable to create council discussion session.");
  }
  return sessionID;
}

async function promptModel(input: {
  client: PluginInput["client"];
  sessionID: string;
  model: ModelRef;
  prompt: string;
  system?: string;
  label: string;
  directory: string;
}): Promise<string> {
  const response = await input.client.session.prompt({
    path: { id: input.sessionID },
    query: { directory: input.directory },
    body: {
      model: input.model,
      system: input.system,
      parts: [{ type: "text", text: input.prompt }],
    },
  });

  const text = extractText(response.data?.parts ?? []);
  if (!text) {
    throw new Error(`Council ${input.label} response was empty.`);
  }
  return text;
}


export async function runCouncil(
  input: PluginInput,
  context: ToolContext,
  query: string,
): Promise<string> {
  // Fallback for undefined context.directory - use current working directory
  const projectDir = context.directory || process.cwd();

  const config = await loadCouncilConfig(projectDir);
  const members = buildMembers(config);
  const speakerRef = ensureSpeaker(config.speaker);
  const transcript: TranscriptEntry[] = [];

  const resolvedServerUrl =
    input.serverUrl?.toString?.() ??
    config.serverUrl ??
    process.env.OPENCODE_SERVER_URL ??
    process.env.OPENCODE_URL ??
    "http://localhost:4096";
  // Progress logging (simplified)
  const postProgress = (text: string) => {
    console.log("[Council]", text.substring(0, 100));
  };


  // State to track the content of each phase for the final result
  const streamState = {
    initial: members.map(() => null as null | { name: string; content: string }),
    discussion: [] as string[],
    votes: members.map(() => null as null | { voter: string; choice: string }),
    winner: null as null | { name: string; votes: number },
  };

  const renderProgress = () => {
    const lines: string[] = ["🏛 Council Discussion in Progress"];

    // Phase 1: Initial Responses
    lines.push("", "== 📋 Initial Responses ==");
    const initialComplete = streamState.initial.every((e) => e !== null);
    if (!initialComplete) {
      lines.push("⏳ Collecting initial responses from council members...");
    }
    for (const entry of streamState.initial) {
      if (entry) {
        const indentedContent = indentText(entry.content);
        lines.push(`✅ ${entry.name}:\n${indentedContent}`);
      }
    }

    // Phase 2: Discussion
    if (streamState.discussion.length > 0) {
      lines.push("", "== 💬 Discussion ==");
      for (const entry of streamState.discussion) {
        lines.push(entry);
      }
    }

    // Phase 3: Voting
    const votesComplete = streamState.votes.every((v) => v !== null);
    if (votesComplete || streamState.votes.some((v) => v !== null)) {
      lines.push("", "== 🗳️ Voting ==");
      if (!votesComplete) {
        lines.push("⏳ Collecting votes...");
      }
      for (const vote of streamState.votes) {
        if (vote) {
          lines.push(`🗳️ ${vote.voter} votes for: ${vote.choice}`);
        }
      }
    }

    // Phase 4: Winner
    if (streamState.winner) {
      lines.push(
        "",
        "== 🏆 Winner ==",
        `${streamState.winner.name} (${streamState.winner.votes} vote${streamState.winner.votes === 1 ? "" : "s"})`
      );
    }

    return lines.join("\n");
  };

  // Send initial progress message
  await postProgress("🏛 Council Discussion starting...");

  const councilSessionID = await createDiscussionSession(input, context);

  try {
    // Phase 1: Initial Responses
    await postProgress(STAGES[0]);

    const initialPrompt = `You are a council member. Provide your best response to the user request.\n\nDeliverables:\n- Key considerations\n- Risks or blind spots\n- Recommended approach\n\nUser request:\n${query}`;

    const initialResponses = await Promise.all(
      members.map(async (member, index) => {
        const text = await promptModel({
          client: input.client,
          sessionID: councilSessionID,
          model: member.ref,
          prompt: initialPrompt,
          system: `You are ${member.name} in a multi-model council. Be direct and honest.`,
          label: `${member.name} initial`,
          directory: context.directory,
        });
        transcript.push({ phase: "Initial", speaker: member.name, content: text });
        streamState.initial[index] = { name: memberLabel(member, index), content: text };
        // Send progress update after each response
        await postProgress(renderProgress());
        return { member, text };
      }),
    );

    let needsUserInput: string | null = null;

    // Phase 2: Discussion
    await postProgress(STAGES[1]);

    for (let turn = 0; turn < config.discussion.maxTurns; turn++) {
      const discussionPrompt = `You are the Council Speaker. Review the discussion so far and decide the next action.\n\nAvailable actions:\n- ask_member: ask one member a clarifying question\n- ask_user: request missing info from the user\n- end: finish discussion and move to voting\n\nReturn ONLY valid JSON with this shape:\n{ "action": "ask_member" | "ask_user" | "end", "target": number, "question": string, "summary": string }\n\nContext:\nUser request: ${query}\n\nInitial responses:\n${initialResponses
        .map((entry) => `${entry.member.name}: ${entry.text}`)
        .join("\n\n")}\n\nTranscript so far:\n${transcript.map((entry) => `${entry.speaker} (${entry.phase}): ${entry.content}`).join("\n\n")}`;

      const speakerDecisionText = await promptModel({
        client: input.client,
        sessionID: councilSessionID,
        model: speakerRef,
        prompt: discussionPrompt,
        system: "You coordinate a council discussion. Be decisive and structured.",
        label: "speaker decision",
        directory: context.directory,
      });

      transcript.push({
        phase: "Speaker decision",
        speaker: "Speaker",
        content: speakerDecisionText,
      });

      const decision = pickJson(speakerDecisionText) as
        | { action?: string; target?: number; question?: string }
        | null;

      if (!decision || !decision.action) {
        break;
      }

      if (decision.action === "ask_user") {
        const question = decision.question ?? "The Speaker needs more details.";
        needsUserInput = question;
        streamState.discussion.push(`🎤 Speaker: ${question}`);
        await postProgress(renderProgress());
        break;
      }

      if (decision.action === "end") {
        streamState.discussion.push(`✅ Speaker: Discussion complete, moving to voting.`);
        await postProgress(renderProgress());
        break;
      }

      if (decision.action === "ask_member") {
        const targetIndex = typeof decision.target === "number" ? decision.target - 1 : 0;
        const member = members[targetIndex] ?? members[0];
        const question = decision.question ?? "Please clarify your recommendation.";
        streamState.discussion.push(`🎤 Speaker -> ${memberLabel(member, targetIndex)}: ${question}`);
        await postProgress(renderProgress());

        const memberAnswer = await promptModel({
          client: input.client,
          sessionID: councilSessionID,
          model: member.ref,
          prompt: `Speaker question: ${question}\n\nRespond honestly and concisely.`,
          system: `You are ${member.name}. Answer the Speaker's question honestly.`,
          label: `${member.name} clarification`,
          directory: context.directory,
        });

        transcript.push({ phase: "Clarification", speaker: member.name, content: memberAnswer });
        streamState.discussion.push(`💬 ${memberLabel(member, targetIndex)}:\n${indentText(memberAnswer)}`);
        await postProgress(renderProgress());
      }
    }

    // Phase 3: Voting
    await postProgress(STAGES[2]);

    const votingPrompt = `You are in the voting phase. Review the council discussion and select the strongest solution.\n\nReturn ONLY valid JSON with this shape:\n{ "vote": number, "reason": string }\n\nVote must be the member number (1-${members.length}).\n\nInitial responses:\n${initialResponses
      .map((entry) => `${entry.member.name}: ${entry.text}`)
      .join("\n\n")}\n\nTranscript:\n${transcript.map((entry) => `${entry.speaker} (${entry.phase}): ${entry.content}`).join("\n\n")}`;

    const votes = await Promise.all(
      members.map(async (member, index) => {
        const response = await promptModel({
          client: input.client,
          sessionID: councilSessionID,
          model: member.ref,
          prompt: votingPrompt,
          system: `You are ${member.name}. Vote for the best solution using the required JSON format.`,
          label: `${member.name} vote`,
          directory: context.directory,
        });

        const parsed = pickJson(response) as { vote?: number; reason?: string } | null;
        const voteIndex = parsed?.vote ? Number(parsed.vote) : NaN;
        const normalizedVote = Number.isFinite(voteIndex) ? voteIndex : 1;
        const vote = Math.min(Math.max(normalizedVote, 1), members.length);
        // Show "Seat N's solution" instead of model name for clarity
        const choiceLabel = `Seat ${vote}'s solution`;

        streamState.votes[index] = {
          voter: memberLabel(member, index),
          choice: choiceLabel,
        };

        await postProgress(renderProgress());

        return {
          voter: member.name,
          vote,
          reason: parsed?.reason ?? response,
        };
      }),
    );

    const voteCounts = new Map<number, number>();
    for (const vote of votes) {
      voteCounts.set(vote.vote, (voteCounts.get(vote.vote) ?? 0) + 1);
    }

    const sortedVotes = Array.from(voteCounts.entries()).sort((a, b) => b[1] - a[1]);
    const topScore = sortedVotes[0]?.[1] ?? 0;
    const tied = sortedVotes.filter(([, count]) => count === topScore).map(([index]) => index);
    const winnerIndex = tied[0] ?? 1;
    const winner = members[winnerIndex - 1];

    // Phase 4: Winner
    const winnerVotes = voteCounts.get(winnerIndex) ?? 0;
    streamState.winner = {
      name: memberLabel(winner, winnerIndex - 1),
      votes: winnerVotes,
    };

    await postProgress(STAGES[3]);

    const speakerPrompt = `You are the Council Speaker. Produce the final response for the user.\n\nUser request:\n${query}\n\nWinning member: ${winner.name} (Member ${winnerIndex})\n\nInitial responses:\n${initialResponses
      .map((entry) => `${entry.member.name}: ${entry.text}`)
      .join("\n\n")}\n\nDiscussion transcript:\n${transcript.map((entry) => `${entry.speaker} (${entry.phase}): ${entry.content}`).join("\n\n")}\n\nVoting summary:\n${votes.map((vote) => `${vote.voter} voted for Member ${vote.vote} (${vote.reason})`).join("\n")}\n\nDeliver a clear, actionable final response. If critical details are missing, state them explicitly.`;

    const speakerText = await promptModel({
      client: input.client,
      sessionID: councilSessionID,
      model: speakerRef,
      prompt: speakerPrompt,
      system: "You are the Council Speaker. Produce the winning synthesis in a direct, actionable tone.",
      label: "speaker synthesis",
      directory: context.directory,
    });

    await postProgress(renderProgress());

    const voteSummary = votes
      .map((vote) => `- ${vote.voter} → Member ${vote.vote}`)
      .join("\n");

    const output = [
      STAGES.join("\n"),
      needsUserInput
        ? `\nSpeaker needs more input: ${needsUserInput}\n\nPlease reply with the missing details and run the council tool again.`
        : "",
      "\n== 🏆 Winning solution ==",
      speakerText,
      "\n== 🗳️ Votes ==",
      voteSummary || "- (no votes parsed)",
      "\n== 📜 Full council transcript ==\n" + formatTranscript(transcript),
    ]
      .filter(Boolean)
      .join("\n");

    return output;
  } finally {
    await input.client.session.delete({
      path: { id: councilSessionID },
      query: { directory: context.directory },
    }).catch(() => null);
  }
}
