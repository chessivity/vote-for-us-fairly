import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  castVote,
  getResults,
  NATALI_HEAD_START,
  type Candidate,
  type VoteResults,
} from "@/lib/votes.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Xareba vs Natali — Anonymous Vote" },
      {
        name: "description",
        content:
          "Cast one anonymous vote for Xareba or Natali. One vote per person, no names, no sign-up.",
      },
      { property: "og:title", content: "Xareba vs Natali — Anonymous Vote" },
      {
        property: "og:description",
        content: "One anonymous vote per person. Pick your candidate and see the live result.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VotePage,
});

const CANDIDATES: { key: Candidate; name: string; blurb: string; tone: string }[] = [
  {
    key: "xareba",
    name: "Xareba",
    blurb: "Candidate one",
    tone: "bg-[var(--xareba)]",
  },
  {
    key: "natali",
    name: "Natali",
    blurb: "Candidate two",
    tone: "bg-[var(--natali)]",
  },
];

function pct(value: number, total: number) {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
}

function VotePage() {
  const fetchResults = useServerFn(getResults);
  const sendVote = useServerFn(castVote);
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);

  const { data, isLoading } = useQuery<VoteResults>({
    queryKey: ["results"],
    queryFn: () => fetchResults(),
  });

  const mutation = useMutation({
    mutationFn: (candidate: Candidate) => sendVote({ data: { candidate } }),
    onSuccess: (result) => {
      queryClient.setQueryData(["results"], result);
      setMessage(
        result.changed
          ? "Your vote was changed. Only your latest choice counts."
          : "Your vote was recorded anonymously. You can change it any time.",
      );
    },
    onError: () => setMessage("Something went wrong. Please try again."),
  });

  const results = data;
  const total = results?.total ?? 0;
  const myVote = results?.myVote ?? null;

  return (
    <main className="min-h-screen bg-background px-5 py-14">
      <div className="mx-auto w-full max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">
          Anonymous ballot
        </p>
        <h1 className="mt-4 text-5xl font-extrabold leading-tight text-foreground sm:text-6xl">
          Xareba <span className="text-muted-foreground">vs</span> Natali
        </h1>
        <p className="mt-4 max-w-xl text-base text-muted-foreground">
          Pick one candidate. Your choice is stored without your name — only a scrambled
          fingerprint of your connection is kept, so each visitor has one vote they can change.
        </p>

        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {CANDIDATES.map((c) => {
            const count = results ? results[c.key] : 0;
            const share = pct(count, total);
            const isMine = myVote === c.key;
            return (
              <div
                key={c.key}
                className="rounded-3xl border border-border bg-card p-6 shadow-lg shadow-black/20"
              >
                <div className="flex items-baseline justify-between">
                  <h2 className="text-3xl font-bold text-card-foreground">{c.name}</h2>
                  <span className="text-sm text-muted-foreground">{c.blurb}</span>
                </div>

                <div className="mt-6 h-3 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${c.tone}`}
                    style={{ width: `${share}%` }}
                  />
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-card-foreground">{share}%</span>
                  <span className="text-sm text-muted-foreground">
                    {isLoading ? "counting…" : `${count} vote${count === 1 ? "" : "s"}`}
                  </span>
                </div>
                {c.key === "natali" && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Includes a {NATALI_HEAD_START}-vote head start
                  </p>
                )}

                <button
                  type="button"
                  disabled={isMine || mutation.isPending}
                  onClick={() => mutation.mutate(c.key)}
                  className="mt-6 w-full rounded-full bg-primary px-5 py-3 text-sm font-semibold uppercase tracking-wide text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isMine
                    ? "Your vote"
                    : myVote
                      ? `Change to ${c.name}`
                      : `Vote ${c.name}`}
                </button>
              </div>
            );
          })}
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-6 py-4">
          <span className="text-sm text-muted-foreground">Total votes cast</span>
          <span className="text-2xl font-bold text-card-foreground">{total}</span>
        </div>

        {message && (
          <p className="mt-6 rounded-2xl border border-border bg-secondary px-5 py-4 text-sm text-foreground">
            {message}
          </p>
        )}

        <p className="mt-10 text-xs leading-relaxed text-muted-foreground">
          No accounts, no emails, no names. People sharing the same network may count as one
          voter.
        </p>
      </div>
    </main>
  );
}
