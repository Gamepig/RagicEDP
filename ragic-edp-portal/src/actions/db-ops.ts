"use server";

import { auth } from "../lib/auth/auth";
import { assertAuthorized } from "../lib/auth/authorize";
import { getRepositories } from "../lib/data/provider";
import type { ResultV0 } from "../lib/data/types";

async function requireAuthorizedSession() {
  const session = await auth();
  assertAuthorized(session);
}

function errorResult(err: unknown): ResultV0<never> {
  const message = err instanceof Error ? err.message : String(err);
  return { ok: false, error: { code: "SERVER_ERROR", message } };
}

export async function getSchema(input: { search?: string }) {
  try {
    await requireAuthorizedSession();
    const repos = getRepositories();
    return await repos.dbops.getSchema(input);
  } catch (err) {
    return errorResult(err);
  }
}

export async function previewData(input: { tableCode: string; page: number; limit: number }) {
  try {
    await requireAuthorizedSession();
    const repos = getRepositories();
    return await repos.dbops.previewData(input);
  } catch (err) {
    return errorResult(err);
  }
}

export async function nlToSql(input: { prompt: string }) {
  try {
    await requireAuthorizedSession();
    const repos = getRepositories();
    return await repos.dbops.nlToSql(input);
  } catch (err) {
    return errorResult(err);
  }
}

export async function executeSql(input: { sql: string }) {
  try {
    await requireAuthorizedSession();
    const repos = getRepositories();
    return await repos.dbops.executeSql(input);
  } catch (err) {
    return errorResult(err);
  }
}

export async function getJoinHealth(input: { joinName: string }) {
  try {
    await requireAuthorizedSession();
    const repos = getRepositories();
    return await repos.dbops.getJoinHealth(input);
  } catch (err) {
    return errorResult(err);
  }
}
