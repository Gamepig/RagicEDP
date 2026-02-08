"use client";

import { Brain, Sparkles, Zap } from "lucide-react";

export type AiMode = "auto" | "simple" | "deep_research";

type ModeSelectorProps = {
  value: AiMode;
  onChange: (mode: AiMode) => void;
  disabled?: boolean;
};

export function ModeSelector({ value, onChange, disabled }: ModeSelectorProps) {
  const modes: { id: AiMode; label: string; icon: React.ReactNode }[] = [
    {
      id: "auto",
      label: "一般",
      icon: <Sparkles className="h-3.5 w-3.5" />,
    },
    {
      id: "simple",
      label: "簡單問答",
      icon: <Zap className="h-3.5 w-3.5" />,
    },
    {
      id: "deep_research",
      label: "深度研究",
      icon: <Brain className="h-3.5 w-3.5" />,
    },
  ];

  return (
    <div className="flex items-center gap-1 rounded-lg border bg-background/50 p-1 shadow-sm backdrop-blur-sm">
      {modes.map((mode) => {
        const isActive = value === mode.id;
        return (
          <button
            key={mode.id}
            type="button"
            onClick={() => onChange(mode.id)}
            disabled={disabled}
            className={`
              flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all
              ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}
              ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }
            `}
          >
            {mode.icon}
            <span>{mode.label}</span>
          </button>
        );
      })}
    </div>
  );
}
