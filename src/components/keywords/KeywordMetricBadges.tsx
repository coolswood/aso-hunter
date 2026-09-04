import { Minus, TrendingDown, TrendingUp, Zap } from "lucide-react";
import {
  calculateBestRank,
  calculateEffectiveness,
  calculateRankDelta,
  type RankEntry,
} from "@/lib/keywordMetrics";

export function PopularityBadge({ volume }: { volume: number | null | undefined }) {
  if (typeof volume !== "number") {
    return <span className="text-muted text-xs">—</span>;
  }

  // Color gradient for the mini progress bar
  const barColor = volume >= 60 ? "bg-emerald-500" : volume >= 35 ? "bg-amber-500" : "bg-zinc-500";

  return (
    <div className="inline-flex items-center gap-2" title={`Popularity: ${volume}/100`}>
      <span className="w-5 text-right font-medium text-xs sm:text-sm">{volume}</span>
      <div className="h-1.5 w-10 overflow-hidden rounded-full bg-border/80">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${Math.max(4, volume)}%` }}
        />
      </div>
    </div>
  );
}

export function DifficultyBadge({ difficulty }: { difficulty: number | null | undefined }) {
  if (typeof difficulty !== "number") {
    return <span className="text-muted text-xs">—</span>;
  }

  // Inverse metric: low difficulty is green (easy), high is rose/purple (tough)
  const colorClass =
    difficulty < 35
      ? "text-emerald-400 bg-emerald-950/40 border-emerald-800/50"
      : difficulty < 65
        ? "text-amber-400 bg-amber-950/40 border-amber-800/50"
        : "text-purple-300 bg-purple-950/40 border-purple-800/50";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium ${colorClass}`}
      title={`Difficulty: ${difficulty}/100`}
    >
      <Zap className="h-3 w-3 shrink-0 opacity-70" />
      <span>{difficulty}</span>
    </span>
  );
}

export function EffectivenessBadge({
  volume,
  difficulty,
}: {
  volume: number | null | undefined;
  difficulty: number | null | undefined;
}) {
  const score = calculateEffectiveness(volume, difficulty);
  if (score === null) {
    return <span className="text-muted text-xs">—</span>;
  }

  const badgeStyle =
    score >= 65
      ? "bg-purple-950/60 border-purple-700/60 text-purple-200 shadow-xs"
      : score >= 40
        ? "bg-indigo-950/40 border-indigo-800/50 text-indigo-300"
        : "bg-card border-border text-muted";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold ${badgeStyle}`}
      title={`Effectiveness (KEI): ${score}/100 based on demand vs competition`}
    >
      <Zap className="h-3 w-3 shrink-0 text-purple-400 fill-purple-400/30" />
      <span>{score}</span>
    </span>
  );
}

export function RankBadge({ rank }: { rank: number | null | undefined }) {
  if (typeof rank !== "number" || rank <= 0) {
    return <span className="text-muted text-sm">—</span>;
  }

  if (rank === 1) {
    return (
      <span className="inline-flex min-w-[28px] items-center justify-center rounded-md border border-emerald-500/50 bg-emerald-950/80 px-2 py-0.5 text-xs font-bold text-emerald-300 shadow-xs">
        {rank}
      </span>
    );
  }

  if (rank <= 3) {
    return (
      <span className="inline-flex min-w-[28px] items-center justify-center rounded-md border border-emerald-600/30 bg-emerald-950/60 px-2 py-0.5 text-xs font-semibold text-emerald-400">
        {rank}
      </span>
    );
  }

  if (rank <= 10) {
    return (
      <span className="inline-flex min-w-[28px] items-center justify-center rounded-md border border-border/80 bg-card px-2 py-0.5 text-xs font-medium text-foreground shadow-xs">
        {rank}
      </span>
    );
  }

  return (
    <span className="inline-flex min-w-[28px] items-center justify-center rounded-md bg-border/40 px-1.5 py-0.5 text-xs text-muted">
      {rank}
    </span>
  );
}

export function ChangeDeltaBadge({
  latest,
  previous,
}: {
  latest: number | null | undefined;
  previous: number | null | undefined;
}) {
  const { delta, direction } = calculateRankDelta(latest, previous);

  if (direction === "none" || delta === null) {
    return <span className="text-muted text-xs">—</span>;
  }

  if (direction === "same") {
    return (
      <span className="inline-flex items-center text-xs font-medium text-muted">
        <Minus className="h-3 w-3" />
      </span>
    );
  }

  if (direction === "up") {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-400">
        <TrendingUp className="h-3 w-3" />+{delta}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-rose-400">
      <TrendingDown className="h-3 w-3" />-{delta}
    </span>
  );
}

export function BestRankBadge({ ranks }: { ranks: RankEntry[] }) {
  const { bestRank, deltaFromBest } = calculateBestRank(ranks);

  if (bestRank === null) {
    return <span className="text-muted text-xs">—</span>;
  }

  return (
    <div className="inline-flex items-center gap-1.5 text-xs font-medium">
      <span className="text-foreground">{bestRank}</span>
      {deltaFromBest !== null &&
        (deltaFromBest === 0 ? (
          <span className="text-muted text-[11px]">=</span>
        ) : (
          <span className="text-rose-400 text-[11px] font-semibold">{deltaFromBest}</span>
        ))}
    </div>
  );
}

export function AppsCountBadge({ count }: { count: number | null | undefined }) {
  if (typeof count !== "number") {
    return <span className="text-muted text-xs">—</span>;
  }

  return (
    <span
      className="font-mono text-xs font-medium text-muted-foreground"
      title={`${count} competing apps found`}
    >
      {count}
    </span>
  );
}
