"use server";

import { auth } from "../lib/auth/auth";
import { assertAuthorized } from "../lib/auth/authorize";
import { getRepositories } from "../lib/data/provider";

async function requireAuthorizedSession() {
  const session = await auth();
  assertAuthorized(session);
}

// ── Data ──

export async function getTables() {
  await requireAuthorizedSession();
  const repos = getRepositories();
  return repos.correction.getTables();
}

export async function getStatistics() {
  await requireAuthorizedSession();
  const repos = getRepositories();
  return repos.correction.getStatistics();
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

// ── Corrections ──

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

export async function getHistory(input: { recordId?: string; tableCode?: string; dateFrom?: string; dateTo?: string; page: number; limit: number }) {
  await requireAuthorizedSession();
  const repos = getRepositories();
  return repos.correction.getHistory(input);
}

// ── Star Schema ──

export async function getSchemaMermaid(input: { level: "overview" | "detailed" }) {
  await requireAuthorizedSession();
  const repos = getRepositories();
  return repos.correction.getSchemaMermaid(input);
}

export async function getSchemaStats() {
  await requireAuthorizedSession();
  const repos = getRepositories();
  return repos.correction.getSchemaStats();
}

export async function refreshSchema() {
  await requireAuthorizedSession();
  const repos = getRepositories();
  return repos.correction.refreshSchema();
}

// ── Backup Logs ──

export async function getBackupList(input: { dateFrom?: string; dateTo?: string; page: number; limit: number }) {
  await requireAuthorizedSession();
  const repos = getRepositories();
  return repos.correction.getBackupList(input);
}

export async function getBackupDetail(input: { date: string; recordsPage?: number; recordsLimit?: number }) {
  await requireAuthorizedSession();
  const repos = getRepositories();
  return repos.correction.getBackupDetail(input);
}
