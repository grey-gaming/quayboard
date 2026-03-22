import { Card } from "../ui/Card.js";

export const ReviewPanel = () => (
  <Card surface="rail">
    <div className="grid gap-2">
      <div>
        <p className="qb-meta-label">Review</p>
        <p className="mt-1 text-lg font-semibold tracking-[-0.02em]">Review Panel</p>
      </div>
      <p className="text-sm text-secondary">
        Structured review findings arrive in Milestone 6. This tab already reserves the review
        surface so the editor layout does not change when review items are introduced.
      </p>
    </div>
  </Card>
);
