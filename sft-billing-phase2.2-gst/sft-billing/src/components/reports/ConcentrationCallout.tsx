import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/cn";

interface ConcentrationCalloutProps {
  clientName: string;
  percentage: number;
  amount: number;
  totalOutstanding: number;
}

export function ConcentrationCallout({ clientName, percentage, amount, totalOutstanding }: ConcentrationCalloutProps) {
  if (percentage < 40) return null;

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-4 rounded-lg border",
        "bg-amber-50 border-amber-200 text-amber-900 dark:bg-caution-bg dark:border-caution/30 dark:text-caution"
      )}
      role="alert"
    >
      <div className="flex-shrink-0 p-2 bg-amber-100 rounded-lg dark:bg-caution-bg">
        <span className="text-2xl">⚠</span>
      </div>
      <div className="flex-1">
        <p className="font-medium text-sm">
          Concentration risk: <span className="font-semibold">{clientName}</span> accounts for <span className="font-semibold">{percentage.toFixed(0)}%</span> of total outstanding
        </p>
        <p className="mt-1 text-sm">
          <span className="font-tabular font-medium">{formatCurrency(amount)}</span> of <span className="font-tabular">{formatCurrency(totalOutstanding)}</span> outstanding
        </p>
        <p className="mt-2 text-xs text-amber-700 dark:text-caution">
          Consider diversifying client base or following up on collection.
        </p>
      </div>
    </div>
  );
}