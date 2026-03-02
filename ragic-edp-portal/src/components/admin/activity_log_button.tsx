"use client";

import { useState } from "react";
import { UserActivityPanel } from "./user_activity_panel";

export function ActivityLogButton({
  userId,
  email,
}: {
  userId: string;
  email: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-8 items-center rounded-md border px-2 text-xs hover:bg-muted/40"
      >
        查看記錄
      </button>
      {open && (
        <UserActivityPanel
          userId={userId}
          email={email}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
