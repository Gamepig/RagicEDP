"use server";

import { getRepositories } from "../lib/data/provider";

export async function runAiExpert(input: {
  sessionId: string;
  userId: string;
  prompt: string;
  modelId: string;
  selectedChartId?: string;
}) {
  const repos = getRepositories();
  return repos.aiExpert.run(input);
}
