import { createOpencodeClient } from "@opencode-ai/sdk"

interface ModelConfig {
  provider: string
  model: string
  label?: string
}

export interface ModelState {
  provider: string
  model: string
  label: string
  status: "pending" | "running" | "done" | "error"
  response: string
  streaming: string
}

export interface CouncilState {
  status: "starting" | "running" | "synthesizing" | "complete" | "error"
  models: ModelState[]
  synthesis: string | null
  error: string | null
}

interface RunCouncilOptions {
  question: string
  models: ModelConfig[]
  timeout: number
  synthesize: boolean
  onUpdate: (partial: Partial<CouncilState>) => void
  onComplete: () => void
  onError: (error: string) => void
}

export async function runCouncil(opts: RunCouncilOptions) {
  const { question, models, timeout, synthesize, onUpdate, onComplete, onError } = opts

  // Connect to the running OpenCode server
  // OpenCode server is already running (we're a child of it via plugin)
  // Default port 4096
  const client = createOpencodeClient({
    baseUrl: `http://127.0.0.1:${process.env.OPENCODE_PORT || "4096"}`,
  })

  onUpdate({ status: "running" })

  // Run all models in parallel
  const results = await Promise.allSettled(
    models.map(async (model, index) => {
      const label = model.label || model.model

      // Update status to running
      onUpdate({
        models: [{ index, status: "running" } as any],
      })

      try {
        // Create a sub-session for each model
        const session = await client.session.create({
          body: { title: `Council: ${label}` },
        })

        if (!session.data) throw new Error("Failed to create session")

        // Send the question with a specific model
        const result = await client.session.prompt({
          path: { id: session.data.id },
          body: {
            model: { providerID: model.provider, modelID: model.model },
            parts: [{
              type: "text",
              text: buildModelPrompt(question, label, models),
            }],
          },
        })

        // Extract text from response parts
        const responseText = extractText(result)

        onUpdate({
          models: [{ index, status: "done", response: responseText } as any],
        })

        // Clean up sub-session
        await client.session.delete({ path: { id: session.data.id } }).catch(() => {})

        return { label, response: responseText, model }
      } catch (e: any) {
        onUpdate({
          models: [{ index, status: "error", response: `Error: ${e.message}` } as any],
        })
        throw e
      }
    })
  )

  // Synthesize if enabled
  if (synthesize) {
    onUpdate({ status: "synthesizing" })

    try {
      const successfulResults = results
        .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled")
        .map(r => r.value)

      if (successfulResults.length > 0) {
        const synthesisSession = await client.session.create({
          body: { title: "Council Synthesis" },
        })

        if (synthesisSession.data) {
          const synthesisResult = await client.session.prompt({
            path: { id: synthesisSession.data.id },
            body: {
              parts: [{
                type: "text",
                text: buildSynthesisPrompt(question, successfulResults),
              }],
            },
          })

          const synthesisText = extractText(synthesisResult)
          onUpdate({ synthesis: synthesisText })

          await client.session.delete({
            path: { id: synthesisSession.data.id },
          }).catch(() => {})
        }
      }
    } catch (e: any) {
      onUpdate({ synthesis: `Synthesis failed: ${e.message}` })
    }
  }

  onUpdate({ status: "complete" })
  onComplete()
}

// ---------- Helpers ----------

function buildModelPrompt(
  question: string,
  myLabel: string,
  allModels: ModelConfig[]
): string {
  const otherModels = allModels
    .filter(m => (m.label || m.model) !== myLabel)
    .map(m => m.label || m.model)
    .join(", ")

  return (
    `You are participating in a council deliberation as "${myLabel}".\n` +
    `Other council members: ${otherModels}.\n\n` +
    `The question for deliberation:\n"${question}"\n\n` +
    `Provide your perspective. Be concise but thorough. ` +
    `Highlight your unique strengths on this topic. ` +
    `If you have a strong opinion, state it clearly with reasoning.\n\n` +
    `Respond in 200-400 words.`
  )
}

function buildSynthesisPrompt(
  question: string,
  results: Array<{ label: string; response: string }>
): string {
  const responses = results
    .map(r => `### ${r.label}\n${r.response}`)
    .join("\n\n")

  return (
    `You are synthesizing a council deliberation.\n\n` +
    `**Question:** ${question}\n\n` +
    `**Council Responses:**\n\n${responses}\n\n` +
    `Provide a synthesis that:\n` +
    `1. Identifies points of agreement\n` +
    `2. Highlights key disagreements\n` +
    `3. Gives a clear recommendation with reasoning\n` +
    `4. Notes any important caveats\n\n` +
    `Be concise (200-300 words).`
  )
}

function extractText(result: any): string {
  try {
    const parts = result?.data?.parts || result?.parts || []
    return parts
      .filter((p: any) => p.type === "text")
      .map((p: any) => p.text)
      .join("\n") || "No response"
  } catch {
    return "Failed to extract response"
  }
}
