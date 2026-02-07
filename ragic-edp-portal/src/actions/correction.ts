"use server";

import { auth } from "../lib/auth/auth";
import { assertAuthorized } from "../lib/auth/authorize";
import { getRepositories } from "../lib/data/provider";

async function requireAuthorizedSession() {
  const session = await auth();
  assertAuthorized(session);
}

export async function getPendingRecords(input: { tableCode?: string; page: number; limit: number }) {
  await requireAuthorizedSession();
  const repos = getRepositories();
  return repos.correction.getPendingRecords(input);
}

export async function getRecordDetail(input: { recordId: string }) {
  await requireAuthorizedSession();
  const repos = getRepositories();
  return repos.correction.getRecordDetail(input);
}

export async function submitCorrection(input: { recordId: string; tableCode: string; values: Record<string, unknown> }) {
  await requireAuthorizedSession();
  const repos = getRepositories();
  return repos.correction.submitCorrection(input);
}

export async function ignoreCorrection(input: { recordId: string; tableCode: string }) {
  await requireAuthorizedSession();
  const repos = getRepositories();
  return repos.correction.ignoreCorrection(input);
}

export async function getHistory(input: { recordId?: string; tableCode?: string; page: number; limit: number }) {
  await requireAuthorizedSession();
  const repos = getRepositories();
  return repos.correction.getHistory(input);
}
