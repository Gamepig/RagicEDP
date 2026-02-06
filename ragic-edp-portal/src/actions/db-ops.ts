"use server";

import { getRepositories } from "../lib/data/provider";

export async function getSchema(input: { search?: string }) {
  const repos = getRepositories();
  return repos.dbops.getSchema(input);
}

export async function previewData(input: { tableCode: string; page: number; limit: number }) {
  const repos = getRepositories();
  return repos.dbops.previewData(input);
}

export async function nlToSql(input: { prompt: string }) {
  const repos = getRepositories();
  return repos.dbops.nlToSql(input);
}

export async function executeSql(input: { sql: string }) {
  const repos = getRepositories();
  return repos.dbops.executeSql(input);
}

export async function getJoinHealth(input: { joinName: string }) {
  const repos = getRepositories();
  return repos.dbops.getJoinHealth(input);
}
