"use server";

import { auth } from "../lib/auth/auth";
import { assertAuthorized } from "../lib/auth/authorize";
import { getRepositories } from "../lib/data/provider";

async function requireAuthorizedSession() {
  const session = await auth();
  assertAuthorized(session);
}

export async function getSchema(input: { search?: string }) {
  await requireAuthorizedSession();
  const repos = getRepositories();
  return repos.dbops.getSchema(input);
}

export async function previewData(input: { tableCode: string; page: number; limit: number }) {
  await requireAuthorizedSession();
  const repos = getRepositories();
  return repos.dbops.previewData(input);
}

export async function nlToSql(input: { prompt: string }) {
  await requireAuthorizedSession();
  const repos = getRepositories();
  return repos.dbops.nlToSql(input);
}

export async function executeSql(input: { sql: string }) {
  await requireAuthorizedSession();
  const repos = getRepositories();
  return repos.dbops.executeSql(input);
}

export async function getJoinHealth(input: { joinName: string }) {
  await requireAuthorizedSession();
  const repos = getRepositories();
  return repos.dbops.getJoinHealth(input);
}
