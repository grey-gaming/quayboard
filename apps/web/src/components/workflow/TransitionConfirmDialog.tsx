import { Button } from "../ui/Button.js";
import { Card } from "../ui/Card.js";

type TransitionConfirmDialogProps = {
  confirmLabel: string;
  isPending?: boolean;
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
};

export const TransitionConfirmDialog = ({
  confirmLabel,
  isPending = false,
  isOpen,
  onCancel,
  onConfirm,
  title,
}: TransitionConfirmDialogProps) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 px-4">
      <Card className="w-full max-w-lg">
        <p className="qb-meta-label">Confirm transition</p>
        <p className="mt-2 text-xl font-semibold tracking-[-0.02em]">{title}</p>
        <p className="mt-3 text-sm text-secondary">
          This approval is intended for the current canonical specification revision after review has
          completed.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button disabled={isPending} onClick={onCancel} variant="ghost">
            Cancel
          </Button>
          <Button
            disabled={isPending}
            onClick={onConfirm}
            variant="secondary"
          >
            {isPending ? "Approving..." : confirmLabel}
          </Button>
        </div>
      </Card>
    </div>
  );
};
