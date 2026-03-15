import { NavLink } from "react-router-dom";

const linkClassName = ({ isActive }: { isActive: boolean }) =>
  [
    "rounded-lg px-3 py-2 text-sm transition",
    isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted",
  ].join(" ");

export const PrimaryBar = () => (
  <aside className="w-full max-w-56 space-y-6 rounded-[calc(var(--radius)+6px)] border border-border/70 bg-card/80 p-4">
    <div>
      <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
        Quayboard
      </p>
      <p className="mt-2 font-display text-2xl">Harbor Night</p>
    </div>
    <nav className="grid gap-2">
      <NavLink className={linkClassName} to="/">
        Home
      </NavLink>
      <NavLink className={linkClassName} to="/setup/instance">
        Instance Readiness
      </NavLink>
      <NavLink className={linkClassName} to="/projects/new">
        New Project
      </NavLink>
      <NavLink className={linkClassName} to="/docs">
        Docs
      </NavLink>
    </nav>
  </aside>
);
