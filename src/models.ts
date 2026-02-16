export type ModelRef = {
  providerID: string;
  modelID: string;
};

export function parseModelRef(model: string): ModelRef {
  const [providerID, ...rest] = model.split("/");
  const modelID = rest.join("/");
  if (!providerID || !modelID) {
    throw new Error(`Invalid model format: "${model}". Expected "provider/model".`);
  }
  return { providerID, modelID };
}
