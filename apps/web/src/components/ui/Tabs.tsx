import type { ReactNode } from "react";

type TabsProps<T extends string> = {
  activeValue: T;
  items: Array<{
    disabled?: boolean;
    label: ReactNode;
    value: T;
  }>;
  onChange: (value: T) => void;
};

export const Tabs = <T extends string>({ activeValue, items, onChange }: TabsProps<T>) => (
  <div className="flex flex-wrap gap-2">
    {items.map((item) => {
      const isActive = item.value === activeValue;

      return (
        <button
          key={item.value}
          className={[
            "qb-nav-cell",
            isActive
              ? "border-accent/55 bg-accent/12 text-foreground"
              : "border-border/70 bg-panel text-secondary hover:border-border-strong hover:text-foreground",
            item.disabled ? "cursor-not-allowed opacity-60" : "",
          ].join(" ")}
          disabled={item.disabled}
          onClick={() => {
            if (!item.disabled) {
              onChange(item.value);
            }
          }}
          type="button"
        >
          {item.label}
        </button>
      );
    })}
  </div>
);
