import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

const TRACK_COLOR = "#e8e6e3";

type Props = { usedPercent: number; color: string };

export function DonutChart({ usedPercent, color }: Props) {
  const data = [
    { value: usedPercent },
    { value: Math.max(0, 100 - usedPercent) },
  ];
  return (
    <ResponsiveContainer width={120} height={120}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={38}
          outerRadius={52}
          startAngle={90}
          endAngle={-270}
          dataKey="value"
          strokeWidth={0}
        >
          <Cell fill={usedPercent > 0 ? color : TRACK_COLOR} />
          <Cell fill={TRACK_COLOR} />
        </Pie>
        <Tooltip formatter={(v: number) => [`${v}%`]} />
      </PieChart>
    </ResponsiveContainer>
  );
}
