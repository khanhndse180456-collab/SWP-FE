import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { PASS_THRESHOLD } from "@/pages/User/Eb/Eb.helpers.js";

export function ThresholdTable() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-border/50">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <span className="font-medium uppercase tracking-wider">Bảng ngưỡng xếp loại</span>
        {open ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
      </button>
      {open && (
        <div className="border-t px-3 pb-3 pt-2 space-y-1.5 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Dưới {PASS_THRESHOLD.toFixed(1)} điểm</span>
            <span className="font-medium text-red-700">KHÔNG ĐẠT</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Từ {PASS_THRESHOLD.toFixed(1)} đến 10.0 điểm</span>
            <span className="font-medium text-emerald-700">ĐẠT</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default ThresholdTable;