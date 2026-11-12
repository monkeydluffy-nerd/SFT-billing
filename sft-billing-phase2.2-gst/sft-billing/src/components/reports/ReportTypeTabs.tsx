import { REPORT_DEFINITIONS, type ReportId } from "@/lib/reports";
import { Segmented } from "@/components/ui/kit";

interface ReportTypeTabsProps {
  active: ReportId;
  onSelect: (id: ReportId) => void;
}

/** Report type switcher: one segmented control, the active report gets the raised pill. */
export function ReportTypeTabs({ active, onSelect }: ReportTypeTabsProps) {
  return (
    <div className="max-w-full overflow-x-auto" aria-label="Report type">
      <Segmented
        value={active}
        onChange={onSelect}
        options={REPORT_DEFINITIONS.map((report) => ({ value: report.id, label: report.title }))}
      />
    </div>
  );
}
