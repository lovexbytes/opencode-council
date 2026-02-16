import type { Hooks, Plugin, PluginInput } from "@opencode-ai/plugin";
import { tool } from "@opencode-ai/plugin";
import { runCouncil } from "./council";

const CouncilPlugin: Plugin = async (input: PluginInput): Promise<Hooks> => {
  return {
    tool: {
      council: tool({
        description: "Consult multiple AI models on a question. Provide the question as the message argument.",
        args: {
          message: tool.schema.string().describe("The question or topic for the council."),
        },
        async execute(args, context) {
          context.metadata({ title: "Council" });
          const message = args.message as string;
          return runCouncil(input, context, message);
        },
      }),
    },
  };
};

export default CouncilPlugin;
