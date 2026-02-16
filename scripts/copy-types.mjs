import { copyFileSync, existsSync } from "fs";

const source = "dist/index.d.ts";
const target = "dist/plugin.d.ts";

if (!existsSync(source)) {
  throw new Error(`Missing ${source}. Run tsc before copying types.`);
}

copyFileSync(source, target);

const sourceMap = "dist/index.d.ts.map";
const targetMap = "dist/plugin.d.ts.map";
if (existsSync(sourceMap)) {
  copyFileSync(sourceMap, targetMap);
}
