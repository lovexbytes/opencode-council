import type { Hooks, Plugin, PluginInput } from "@opencode-ai/plugin";
import { tool } from "@opencode-ai/plugin";
import { runCouncil } from "./council";

const CouncilPlugin: Plugin = async (input: PluginInput): Promise<Hooks> => {
  return {
    tool: {
      council: tool({
        description: "Run a multi-model council discussion with a speaker synthesis.",
        args: {
          message: tool.schema.string().describe("The user request to send to the council."),
        },
        async execute(args, context) {
          context.metadata({ title: "Council" });
          return runCouncil(input, context, args.message);
        },
      }),
    },
    "command.execute.before": async (payload, output) => {
      if (payload.command !== "council") return;
      const args = payload.arguments.trim();
      if (!args) return;

      output.parts = output.parts.map((part) => {
        if (part.type !== "text") return part;
        if (!part.text.includes("{message}")) return part;

        const replaced = part.text.replaceAll("{message}", args);
        const trailing = new RegExp(`\\n\\n${args.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}$`);
        return {
          ...part,
          text: replaced.replace(trailing, ""),
        };
      });
    },
  };
};

export default CouncilPlugin;
