export const Skeleton = ({ className = "" }: { className?: string }) => (
  <div className={["animate-pulse bg-panel-active", className].join(" ")} />
);
