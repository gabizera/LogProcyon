import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const PRIMARY      = '#3b82f6';
const MONO         = "'JetBrains Mono', monospace";
const GRID_COLOR   = 'rgba(148,163,184,0.06)';
const AXIS_COLOR   = 'rgba(148,163,184,0.12)';
const LABEL_COLOR  = '#64748b';

const tooltipStyle: React.CSSProperties = {
  background: '#0f172a',
  border: '1px solid rgba(148,163,184,0.12)',
  borderRadius: 8,
  fontFamily: MONO,
  fontSize: 11,
  color: '#e2e8f0',
  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
  padding: '8px 12px',
};

interface AreaChartProps {
  data: Record<string, unknown>[];
  height?: number;
  xKey: string;
  yKey: string;
  color?: string;
}

export function VolumeLineChart({ data, xKey, yKey, height = 260, color = PRIMARY }: AreaChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={color} stopOpacity={0.2}  />
            <stop offset="100%" stopColor={color} stopOpacity={0.01} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID_COLOR} strokeDasharray="none" vertical={false} />
        <XAxis
          dataKey={xKey}
          stroke={AXIS_COLOR}
          tick={{ fill: LABEL_COLOR, fontSize: 10, fontFamily: MONO }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          stroke={AXIS_COLOR}
          tick={{ fill: LABEL_COLOR, fontSize: 10, fontFamily: MONO }}
          axisLine={false}
          tickLine={false}
          width={36}
        />
        <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: 'rgba(59,130,246,0.15)', strokeWidth: 1 }} />
        <Area
          type="monotone"
          dataKey={yKey}
          stroke={color}
          strokeWidth={2}
          fill="url(#areaGrad)"
          dot={false}
          activeDot={{ r: 4, fill: color, stroke: '#0f172a', strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
