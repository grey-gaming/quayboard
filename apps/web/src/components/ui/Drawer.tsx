import type { ReactNode } from "react";

import { Button } from "./Button.js";

export const Drawer = ({
  children,
  onClose,
  open,
  title,
}: {
  children: ReactNode;
  onClose: () => void;
  open: boolean;
  title: string;
}) => {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm">
      <div className="absolute inset-y-0 right-0 w-full max-w-xl overflow-y-auto border-l border-border/80 bg-panel px-5 py-5 shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-border/80 pb-3">
          <div>
            <p className="qb-meta-label">Workspace panel</p>
            <p className="mt-1 text-lg font-semibold tracking-[-0.02em]">{title}</p>
          </div>
          <Button onClick={onClose} variant="ghost">
            Close
          </Button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
};
