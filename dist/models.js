export function parseModelRef(model) {
    const [providerID, ...rest] = model.split("/");
    const modelID = rest.join("/");
    if (!providerID || !modelID) {
        throw new Error(`Invalid model format: "${model}". Expected "provider/model".`);
    }
    return { providerID, modelID };
}
//# sourceMappingURL=models.js.map