export type EnvConfigV0 = {
  gcpProjectId: string;
  bigQueryDataset: string;
  bigQueryLocation: string;

  googleClientId: string;
  googleClientSecret: string;
  nextAuthSecret: string;

  googleVertexProject?: string;
  googleVertexLocation?: string;

  portalAdminEmails: string[];
  dataProviderMode: "mock" | "real";
};

export type AuthEnvConfigV0 = {
  googleClientId: string;
  googleClientSecret: string;
  nextAuthSecret: string;
  portalAdminEmails: string[];
  portalDevBypassAuth: boolean;
};

function splitEmails(v: string | undefined): string[] {
  if (!v) return [];
  return v
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function readRequiredEnv(name: string, allowEmptyInBuild = false): string {
  const value = process.env[name];
  if (value) return value;
  if (allowEmptyInBuild && process.env.NEXT_PHASE === "phase-production-build") return "";
  throw new Error(`Missing env: ${name}`);
}

export function loadAuthEnvConfigV0(): AuthEnvConfigV0 {
  const portalDevBypassAuth = process.env.PORTAL_DEV_BYPASS_AUTH === "true";
  const isDevBypassAuth = portalDevBypassAuth && process.env.NODE_ENV === "development";

  const googleClientId = isDevBypassAuth
    ? process.env.GOOGLE_CLIENT_ID || "dev-bypass-google-client-id"
    : readRequiredEnv("GOOGLE_CLIENT_ID", true);
  const googleClientSecret = isDevBypassAuth
    ? process.env.GOOGLE_CLIENT_SECRET || "dev-bypass-google-client-secret"
    : readRequiredEnv("GOOGLE_CLIENT_SECRET", true);
  const nextAuthSecret = isDevBypassAuth
    ? process.env.NEXTAUTH_SECRET || "dev-bypass-nextauth-secret"
    : readRequiredEnv("NEXTAUTH_SECRET", true);

  const portalAdminEmails = splitEmails(process.env.PORTAL_ADMIN_EMAILS);

  return {
    googleClientId,
    googleClientSecret,
    nextAuthSecret,
    portalAdminEmails,
    portalDevBypassAuth,
  };
}

export function loadEnvConfigV0(): EnvConfigV0 {
  const gcpProjectId = process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
  if (!gcpProjectId) throw new Error("Missing env: GCP_PROJECT_ID (or GOOGLE_CLOUD_PROJECT)");

  const bigQueryDataset = process.env.BIGQUERY_DATASET;
  if (!bigQueryDataset) throw new Error("Missing env: BIGQUERY_DATASET");

  const bigQueryLocation = process.env.BIGQUERY_LOCATION || "asia-east1";

  const authEnv = loadAuthEnvConfigV0();
  const dataProviderMode = process.env.PORTAL_DATA_PROVIDER_MODE === "real" ? "real" : "mock";

  return {
    gcpProjectId,
    bigQueryDataset,
    bigQueryLocation,
    googleClientId: authEnv.googleClientId,
    googleClientSecret: authEnv.googleClientSecret,
    nextAuthSecret: authEnv.nextAuthSecret,
    googleVertexProject: process.env.GOOGLE_VERTEX_PROJECT,
    googleVertexLocation: process.env.GOOGLE_VERTEX_LOCATION,
    portalAdminEmails: authEnv.portalAdminEmails,
    dataProviderMode,
  };
}
