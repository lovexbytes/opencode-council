import type { Hooks, Plugin, PluginInput } from "@opencode-ai/plugin";
import { tool } from "@opencode-ai/plugin";
import { runCouncil } from "./council";

const CouncilPlugin: Plugin = async (input: PluginInput): Promise<Hooks> => {
  return {
    tool: {
      council: tool({
        description: "Get multiple AI opinions. Args: {query: string}",
        args: {
          query: tool.schema.string(),
        },
        async execute(args, context) {
          context.metadata({ title: "Council" });
          return runCouncil(input, context, args.query as string);
        },
      }),
    },
  };
};

export default CouncilPlugin;
