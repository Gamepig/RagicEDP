"use server";

import { getRepositories } from "../lib/data/provider";

export async function getPendingRecords(input: { tableCode?: string; page: number; limit: number }) {
  const repos = getRepositories();
  return repos.correction.getPendingRecords(input);
}

export async function getRecordDetail(input: { recordId: string }) {
  const repos = getRepositories();
  return repos.correction.getRecordDetail(input);
}

export async function submitCorrection(input: { recordId: string; tableCode: string; values: Record<string, unknown> }) {
  const repos = getRepositories();
  return repos.correction.submitCorrection(input);
}

export async function ignoreCorrection(input: { recordId: string; tableCode: string }) {
  const repos = getRepositories();
  return repos.correction.ignoreCorrection(input);
}

export async function getHistory(input: { recordId?: string; tableCode?: string; page: number; limit: number }) {
  const repos = getRepositories();
  return repos.correction.getHistory(input);
}
