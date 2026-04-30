import { Activity, Radio, Cpu, Network } from "lucide-react";
import { cn } from "../lib/utils";

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  icon: "activity" | "radio" | "cpu" | "network";
  trend?: {
    value: number;
    isPositive: boolean;
  };
  glowColor?: "blue" | "purple" | "green" | "red";
}

export function MetricCard({ title, value, unit, icon, trend, glowColor = "blue" }: MetricCardProps) {
  const IconComponent = {
    activity: Activity,
    radio: Radio,
    cpu: Cpu,
    network: Network,
  }[icon];

  const glowClass = {
    blue: "glow-blue border-neon-blue/30",
    purple: "glow-purple border-neon-purple/30",
    green: "border-neon-green/30",
    red: "border-neon-red/30",
  }[glowColor];

  return (
    <div className={cn("bg-card rounded-lg p-6 border relative overflow-hidden transition-all duration-300 hover:-translate-y-1", glowClass)}>
      {/* Decorative background glow */}
      <div className={cn(
        "absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-10 blur-2xl",
        glowColor === "blue" ? "bg-neon-blue" : 
        glowColor === "purple" ? "bg-neon-purple" : 
        glowColor === "green" ? "bg-neon-green" : "bg-neon-red"
      )} />
      
      <div className="flex items-center justify-between mb-4 relative z-10">
        <h3 className="text-sm font-medium text-foreground/60 uppercase tracking-wider">{title}</h3>
        <div className={cn(
          "p-2 rounded-md bg-background/50 border",
          glowColor === "blue" ? "text-neon-blue border-neon-blue/20" : 
          glowColor === "purple" ? "text-neon-purple border-neon-purple/20" : 
          glowColor === "green" ? "text-neon-green border-neon-green/20" : "text-neon-red border-neon-red/20"
        )}>
          <IconComponent size={18} />
        </div>
      </div>
      
      <div className="flex items-baseline gap-2 relative z-10">
        <span className="text-3xl font-bold font-mono tracking-tight">{value}</span>
        {unit && <span className="text-sm text-foreground/40">{unit}</span>}
      </div>
      
      {trend && (
        <div className="mt-4 flex items-center gap-1 text-xs relative z-10">
          <span className={cn(
            "font-mono",
            trend.isPositive ? "text-neon-green" : "text-neon-red"
          )}>
            {trend.isPositive ? "↑" : "↓"} {Math.abs(trend.value)}%
          </span>
          <span className="text-foreground/40">son adımdan bu yana</span>
        </div>
      )}
    </div>
  );
}
