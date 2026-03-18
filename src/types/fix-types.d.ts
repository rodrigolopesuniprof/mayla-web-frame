/* eslint-disable @typescript-eslint/no-explicit-any */

// Fix recharts JSX component types with @types/react@18.3.x
declare module "recharts" {
  import type { ComponentType } from "react";

  export interface LegendProps {
    payload?: Array<{ value: string; type?: string; id?: string; color?: string; dataKey?: string }>;
    verticalAlign?: "top" | "middle" | "bottom";
    [key: string]: any;
  }

  export const LineChart: ComponentType<any>;
  export const Line: ComponentType<any>;
  export const BarChart: ComponentType<any>;
  export const Bar: ComponentType<any>;
  export const XAxis: ComponentType<any>;
  export const YAxis: ComponentType<any>;
  export const Tooltip: ComponentType<any>;
  export const ResponsiveContainer: ComponentType<any>;
  export const CartesianGrid: ComponentType<any>;
  export const Legend: ComponentType<any>;
  export const Area: ComponentType<any>;
  export const AreaChart: ComponentType<any>;
  export const PieChart: ComponentType<any>;
  export const Pie: ComponentType<any>;
  export const Cell: ComponentType<any>;
  export const RadarChart: ComponentType<any>;
  export const Radar: ComponentType<any>;
  export const PolarGrid: ComponentType<any>;
  export const PolarAngleAxis: ComponentType<any>;
  export const PolarRadiusAxis: ComponentType<any>;
}
