export type EnvConfigV0 = {
  gcpProjectId: string;
  bigQueryDataset: string;
  bigQueryLocation: string;

  googleVertexProject?: string;
  googleVertexLocation?: string;

  portalAdminEmails: string[];
  dataProviderMode: "mock" | "real";
};

function splitEmails(v: string | undefined): string[] {
  if (!v) return [];
  return v
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function loadEnvConfigV0(): EnvConfigV0 {
  const gcpProjectId = process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
  if (!gcpProjectId) throw new Error("Missing env: GCP_PROJECT_ID (or GOOGLE_CLOUD_PROJECT)");

  const bigQueryDataset = process.env.BIGQUERY_DATASET;
  if (!bigQueryDataset) throw new Error("Missing env: BIGQUERY_DATASET");

  const bigQueryLocation = process.env.BIGQUERY_LOCATION || "asia-east1";

  const portalAdminEmails = splitEmails(process.env.PORTAL_ADMIN_EMAILS);
  const dataProviderMode = process.env.PORTAL_DATA_PROVIDER_MODE === "real" ? "real" : "mock";

  return {
    gcpProjectId,
    bigQueryDataset,
    bigQueryLocation,
    googleVertexProject: process.env.GOOGLE_VERTEX_PROJECT,
    googleVertexLocation: process.env.GOOGLE_VERTEX_LOCATION,
    portalAdminEmails,
    dataProviderMode,
  };
}
