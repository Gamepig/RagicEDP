import { PinnedWidgetV0, RFC3339String } from "../data/types";

export type FirestoreUserV0 = {
  schemaVersion: "v0";
  email: string;
  displayName?: string;
  theme?: "light" | "dark" | "system";
  lastLoginAt?: RFC3339String;
  createdAt: RFC3339String;
};

export type FirestoreAllowlistUserV0 = {
  schemaVersion: "v0";
  email: string;
  status: "allowed" | "revoked";
  createdAt: RFC3339String;
  createdBy: string;
  updatedAt?: RFC3339String;
  updatedBy?: string;
};

export type FirestoreDashboardConfigV0 = {
  schemaVersion: "v0";
  pinnedWidgets: PinnedWidgetV0[];
  updatedAt: RFC3339String;
};

export type FirestoreChatSessionV0 = {
  schemaVersion: "v0";
  userId: string;
  title?: string;
  selectedModelId: string;
  createdAt: RFC3339String;
  updatedAt: RFC3339String;
  contextSnapshot?: {
    filters?: unknown;
  };
};

export type FirestoreChatMessageV0 = {
  schemaVersion: "v0";
  role: "user" | "assistant";
  contentMarkdown: string;
  createdAt: RFC3339String;
  aiOutput?: { schemaVersion: "v0" };
};
