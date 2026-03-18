import { useEffect, useState } from "react";

import { Button } from "../ui/Button.js";
import { Textarea } from "../ui/Textarea.js";
import { MarkdownDocument } from "./MarkdownDocument.js";

type EditableMarkdownDocumentProps = {
  disabled?: boolean;
  editLabel?: string;
  isSaving?: boolean;
  markdown: string;
  onSave: (markdown: string) => Promise<unknown>;
  saveLabel?: string;
};

export const EditableMarkdownDocument = ({
  disabled = false,
  editLabel = "Edit Markdown",
  isSaving = false,
  markdown,
  onSave,
  saveLabel = "Save Changes",
}: EditableMarkdownDocumentProps) => {
  const [draft, setDraft] = useState(markdown);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!isEditing) {
      setDraft(markdown);
    }
  }, [isEditing, markdown]);

  const trimmedDraft = draft.trim();
  const hasChanges = draft !== markdown;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {isEditing ? (
          <>
            <Button
              disabled={isSaving}
              onClick={() => {
                setDraft(markdown);
                setIsEditing(false);
              }}
              type="button"
              variant="ghost"
            >
              Cancel
            </Button>
            <Button
              disabled={disabled || isSaving || !trimmedDraft || !hasChanges}
              onClick={() => {
                void onSave(trimmedDraft).then(() => {
                  setIsEditing(false);
                });
              }}
              type="button"
            >
              {isSaving ? "Saving..." : saveLabel}
            </Button>
          </>
        ) : (
          <Button
            disabled={disabled || isSaving}
            onClick={() => {
              setDraft(markdown);
              setIsEditing(true);
            }}
            type="button"
            variant="secondary"
          >
            {editLabel}
          </Button>
        )}
      </div>

      {isEditing ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="grid gap-2">
            <p className="qb-meta-label">Markdown</p>
            <Textarea
              className="min-h-[26rem] font-mono text-[13px]"
              onChange={(event) => {
                setDraft(event.target.value);
              }}
              value={draft}
            />
          </div>
          <div className="grid gap-2">
            <p className="qb-meta-label">Preview</p>
            <div className="border border-border/80 bg-panel px-4 py-4">
              <MarkdownDocument markdown={trimmedDraft || "_Add markdown to preview it here._"} />
            </div>
          </div>
        </div>
      ) : (
        <MarkdownDocument markdown={markdown} />
      )}
    </div>
  );
};
