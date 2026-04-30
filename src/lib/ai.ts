import "server-only";

import { createAzure } from "@ai-sdk/azure";

let cached: ReturnType<typeof createModel> | null = null;

function createModel() {
  const endpoint = process.env.AZURE_AI_ENDPOINT;
  const apiKey = process.env.AZURE_AI_API_KEY;
  const apiVersion = process.env.AZURE_AI_API_VERSION ?? "2024-04-01-preview";

  if (!endpoint) {
    throw new Error("AZURE_AI_ENDPOINT is not set.");
  }
  if (!apiKey) {
    throw new Error("AZURE_AI_API_KEY is not set.");
  }

  const azure = createAzure({
    apiKey,
    apiVersion,
    baseURL: `${endpoint.replace(/\/$/, "")}/openai`,
  });

  return azure(process.env.AZURE_AI_DEPLOYMENT ?? "gpt-5.4-pro");
}

export function getChatModel() {
  if (!cached) cached = createModel();
  return cached;
}
