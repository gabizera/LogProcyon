import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const PRIMARY      = 'var(--ink)';
const GRID_COLOR   = 'var(--line)';
const AXIS_COLOR   = 'var(--line)';
const LABEL_COLOR  = 'var(--ink-muted)';

const tooltipStyle: React.CSSProperties = {
  background: 'var(--cream)',
  border: '1px solid var(--line)',
  borderRadius: 8,
  fontFamily: 'var(--font-text)',
  fontSize: 12,
  color: 'var(--ink)',
  boxShadow: 'var(--shadow-soft)',
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
          tick={{ fill: LABEL_COLOR, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          stroke={AXIS_COLOR}
          tick={{ fill: LABEL_COLOR, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={36}
        />
        <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: 'var(--line-strong)', strokeWidth: 1 }} />
        <Area
          type="monotone"
          dataKey={yKey}
          stroke={color}
          strokeWidth={2}
          fill="url(#areaGrad)"
          dot={false}
          activeDot={{ r: 4, fill: color, stroke: 'var(--cream)', strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
