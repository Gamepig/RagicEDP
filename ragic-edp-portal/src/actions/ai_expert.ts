"use server";

import { auth } from "../lib/auth/auth";
import { assertAuthorized } from "../lib/auth/authorize";
import { getRepositories } from "../lib/data/provider";

async function requireAuthorizedSession() {
  const session = await auth();
  assertAuthorized(session);
}

export async function runAiExpert(input: {
  sessionId: string;
  userId: string;
  prompt: string;
  modelId: string;
  selectedChartId?: string;
}) {
  await requireAuthorizedSession();
  const repos = getRepositories();
  return repos.aiExpert.run(input);
}
