import { createOpencodeClient } from "@opencode-ai/sdk"
import fs from "fs"

// Debug logger
const log = (msg: string) => {
  try {
    fs.appendFileSync(`/tmp/council-tui-debug.log`, `${new Date().toISOString()} [COUNCIL]: ${msg}\n`)
  } catch {}
}

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

  log(`Starting council for question: ${question.slice(0, 50)}...`)
  log(`Models: ${models.length} (${models.map(m => m.label || m.model).join(", ")})`)

  // Connect to the running OpenCode server
  let client: ReturnType<typeof createOpencodeClient>
  try {
    const baseUrl = `http://127.0.0.1:${process.env.OPENCODE_PORT || "4096"}`
    log(`Creating OpenCode client at ${baseUrl}`)
    
    client = createOpencodeClient({
      baseUrl,
    })
    log("Client created successfully")
  } catch (e: any) {
    log(`Failed to create client: ${e.message}`)
    onError(`SDK init failed: ${e.message}`)
    return
  }

  onUpdate({ status: "running" })

  // Run all models in parallel with timeout
  const timeoutMs = timeout * 1000
  log(`Running ${models.length} models with ${timeout}s timeout`)

  const results = await Promise.allSettled(
    models.map(async (model, index) => {
      const label = model.label || model.model
      log(`[Model ${index}] Starting ${label}...`)

      // Update status to running
      onUpdate({
        models: [{ index, status: "running" } as any],
      })

      try {
        // Create a sub-session for each model
        log(`[Model ${index}] Creating session...`)
        const session = await client.session.create({
          body: { title: `Council: ${label}` },
        })

        if (!session.data) {
          throw new Error("Failed to create session - no data returned")
        }
        log(`[Model ${index}] Session created: ${session.data.id}`)

        // Send the question with a specific model
        log(`[Model ${index}] Sending prompt...`)
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
        log(`[Model ${index}] Got response`)

        // Extract text from response parts
        const responseText = extractText(result)
        log(`[Model ${index}] Extracted ${responseText.length} chars`)

        onUpdate({
          models: [{ index, status: "done", response: responseText } as any],
        })

        // Clean up sub-session
        await client.session.delete({ path: { id: session.data.id } }).catch((e) => {
          log(`[Model ${index}] Cleanup error: ${e.message}`)
        })

        log(`[Model ${index}] Complete`)
        return { label, response: responseText, model }
      } catch (e: any) {
        log(`[Model ${index}] Error: ${e.message}`)
        onUpdate({
          models: [{ index, status: "error", response: `Error: ${e.message}` } as any],
        })
        throw e
      }
    })
  )

  log(`All models finished. Results: ${results.filter(r => r.status === "fulfilled").length}/${results.length} successful`)

  // Synthesize if enabled
  if (synthesize) {
    onUpdate({ status: "synthesizing" })
    log("Starting synthesis...")

    try {
      const successfulResults = results
        .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled")
        .map(r => r.value)

      if (successfulResults.length > 0) {
        log(`Synthesizing ${successfulResults.length} responses...`)
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
          log(`Synthesis complete: ${synthesisText.slice(0, 100)}...`)
          onUpdate({ synthesis: synthesisText })

          await client.session.delete({
            path: { id: synthesisSession.data.id },
          }).catch(() => {})
        }
      } else {
        log("No successful results to synthesize")
        onUpdate({ synthesis: "No models completed successfully" })
      }
    } catch (e: any) {
      log(`Synthesis error: ${e.message}`)
      onUpdate({ synthesis: `Synthesis failed: ${e.message}` })
    }
  }

  log("Council complete")
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

  return [
    `You are ${myLabel}, participating in a council of AI models.`,
    "",
    `Other council members: ${otherModels || "none (solo deliberation)"}`,
    "",
    "The user asks:",
    `"${question}"`,
    "",
    "Provide your analysis:",
    "1. Your recommendation or answer",
    "2. Key reasoning and trade-offs considered",
    "3. Confidence level (1-10)",
    "",
    "Be concise but thorough. ~300 words. Your perspective will be combined with other models.",
  ].join("\n")
}

function buildSynthesisPrompt(
  question: string,
  results: Array<{ label: string; response: string }>
): string {
  const responsesSection = results
    .map((r, i) => `## ${r.label}\n${r.response}\n`)
    .join("\n")

  return [
    "You are the Council Speaker. Synthesize these AI model responses into a unified answer.",
    "",
    "Question:",
    `"${question}"`,
    "",
    "Council responses:",
    responsesSection,
    "",
    "Provide:",
    "1. Summary of each council member's position",
    "2. Areas of agreement and disagreement",
    "3. The most well-supported conclusion",
    "4. Key dissenting perspectives to consider",
    "",
    "Format as a clear, actionable recommendation.",
  ].join("\n")
}

function extractText(result: any): string {
  if (!result || !result.data || !result.data.parts) {
    return "(no response)"
  }
  
  return result.data.parts
    .filter((p: any) => p.type === "text")
    .map((p: any) => p.text)
    .join("\n")
    .trim() || "(empty response)"
}
