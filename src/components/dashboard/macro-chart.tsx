"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";

export interface DailyMacroPoint {
  day: string;
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export function WeeklyMacroChart({
  data,
  calorieGoal,
}: {
  data: DailyMacroPoint[];
  calorieGoal: number;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="h-[260px] w-full rounded-xl bg-muted/30 animate-pulse flex items-center justify-center text-xs text-muted-foreground">
        Loading weekly nutrition chart...
      </div>
    );
  }

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="day"
            tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            yAxisId="kcal"
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            yAxisId="protein"
            orientation="right"
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              borderColor: "hsl(var(--border))",
              borderRadius: "0.75rem",
              fontSize: "12px",
              color: "hsl(var(--foreground))",
            }}
          />
          <ReferenceLine
            yAxisId="kcal"
            y={calorieGoal}
            stroke="#27c6a5"
            strokeDasharray="4 4"
            label={{
              value: `Goal ${calorieGoal}`,
              position: "insideTopRight",
              fill: "#27c6a5",
              fontSize: 10,
            }}
          />
          <Bar
            yAxisId="kcal"
            dataKey="calories"
            name="Calories (kcal)"
            fill="#6d5dfc"
            radius={[6, 6, 0, 0]}
          />
          <Bar
            yAxisId="protein"
            dataKey="protein"
            name="Protein (g)"
            fill="#27c6a5"
            radius={[6, 6, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
