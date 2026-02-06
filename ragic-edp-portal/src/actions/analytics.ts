"use server";

import { getRepositories } from "../lib/data/provider";

export async function getDashboardStats(input: { dateRange: { from: string; to: string } }) {
  const repos = getRepositories();
  return repos.analytics.getDashboardStats(input);
}

export async function getChartData(input: { chartId: string; filters: { dateRange: { from: string; to: string }; channel?: string } }) {
  const repos = getRepositories();
  return repos.analytics.getChartData(input);
}

export async function pinWidget(input: { userId: string; chartId: string }) {
  const repos = getRepositories();
  return repos.analytics.pinWidget(input);
}

export async function unpinWidget(input: { userId: string; chartId: string }) {
  const repos = getRepositories();
  return repos.analytics.unpinWidget(input);
}
