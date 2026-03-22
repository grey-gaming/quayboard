import type { InputHTMLAttributes } from "react";

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
};

export const Checkbox = ({ checked, className = "", label, ...props }: CheckboxProps) => (
  <label className={`flex items-center gap-2 text-sm text-secondary ${className}`.trim()}>
    <input
      checked={checked}
      className="h-4 w-4 rounded border border-border bg-panel accent-[var(--color-accent)]"
      type="checkbox"
      {...props}
    />
    <span>{label}</span>
  </label>
);
