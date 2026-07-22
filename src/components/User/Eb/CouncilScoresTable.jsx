import { Badge } from "@/components/ui/badge";
import { clampScore } from "@/pages/User/Eb/Eb.helpers.js";
import { ScoreStars } from "@/components/User/Eb/ScoreStars.jsx";

export function CouncilScoresTable({ memberRows, scoreFields, criterionAverages, councilAverage, scoredCount, activeMemberId }) {
  // Hàm lấy className border + bg theo average
  const getRowBgClass = (average) => {
    if (average < 2.5) return "border-l-4 border-red-400 bg-red-50/40";
    if (average < 3.5) return "border-l-4 border-amber-400 bg-amber-50/40";
    if (average < 4.25) return "border-l-4 border-sky-400 bg-sky-50/40";
    return "border-l-4 border-emerald-400 bg-emerald-50/40";
  };

  // Chỉ hiện những thành viên đã chấm (memberRows có scored === true).
  const scoredMembers = memberRows.filter(r => r.scored === true);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{scoredCount}/{memberRows.length} thành viên đã chấm</p>
      </div>
      <div className="eb-council-table-wrap overflow-x-auto rounded-xl border bg-card">
        <table className="eb-council-table w-full text-sm" style={{ minWidth: "640px" }}>
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <th className="px-3 py-2.5 font-medium">Thành viên HĐ</th>
              {scoreFields.map(f => (
                <th key={f.key} className="px-2 py-2.5 font-medium">{f.hint}</th>
              ))}
              <th className="px-3 py-2.5 text-right font-medium">DTB</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70">
            {scoredMembers.length === 0 ? (
              <tr>
                <td colSpan={scoreFields.length + 2} className="px-3 py-6 text-center text-sm text-muted-foreground italic">
                  Chưa có thành viên nào chấm series này.
                </td>
              </tr>
            ) : scoredMembers.map((row, idx) => {
              const isActive = row.id === activeMemberId;
              const bgClass = getRowBgClass(row.average);
              const finalClass = isActive ? "bg-primary/5" : bgClass;

              return (
                <tr key={row.id ?? idx} className={finalClass}>
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-foreground">{row.name}</p>
                    <p className="text-xs text-muted-foreground">{row.title}</p>
                    {isActive && <Badge variant="outline" className="mt-1 text-[10px]">Đang nhập</Badge>}
                  </td>
                  {scoreFields.map(f => (
                    <td key={f.key} className="px-2 py-2.5 text-center tabular-nums">
                      <span className="inline-flex flex-col items-center gap-0.5">
                        <span className="font-medium">{clampScore(row.scores?.[f.key]).toFixed(1)}</span>
                        <ScoreStars value={row.scores?.[f.key]} />
                      </span>
                    </td>
                  ))}
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                    <span className={row.average >= 2.5 ? "text-emerald-700" : "text-red-600"}>
                      {row.average.toFixed(1)}
                    </span>
                  </td>
                </tr>
              );
            })}
            <tr className="eb-council-table__avg border-t-2 bg-muted/25 font-medium">
              <td className="px-3 py-3">Trung bình Hội đồng</td>
              {scoreFields.map(f => (
                <td key={f.key} className="px-2 py-3 text-center tabular-nums text-foreground">
                  {criterionAverages?.[f.key] != null ? criterionAverages[f.key].toFixed(1) : "—"}
                </td>
              ))}
              <td className="px-3 py-3 text-right text-base font-bold tabular-nums text-primary">
                {councilAverage.toFixed(1)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default CouncilScoresTable;