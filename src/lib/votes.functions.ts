import { createServerFn } from "@tanstack/react-start";
import { getRequestIP, getRequestHeader } from "@tanstack/react-start/server";

export type Candidate = "xareba" | "natali";

export type VoteResults = {
  xareba: number;
  natali: number;
  total: number;
  hasVoted: boolean;
};

async function voterHash() {
  const ip =
    getRequestIP({ xForwardedFor: true }) ??
    getRequestHeader("cf-connecting-ip") ??
    getRequestHeader("x-real-ip") ??
    "unknown";
  const salt = process.env["VOTE_IP_SALT"] ?? "fallback-salt";
  const bytes = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function tally(hash: string): Promise<VoteResults> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: rows }, { data: mine }] = await Promise.all([
    supabaseAdmin.from("votes").select("candidate"),
    supabaseAdmin.from("votes").select("id").eq("voter_hash", hash).maybeSingle(),
  ]);
  const list = rows ?? [];
  const xareba = list.filter((r) => r.candidate === "xareba").length;
  const natali = list.filter((r) => r.candidate === "natali").length;
  return { xareba, natali, total: xareba + natali, hasVoted: Boolean(mine) };
}

export const getResults = createServerFn({ method: "GET" }).handler(async () => {
  return tally(await voterHash());
});

export const castVote = createServerFn({ method: "POST" })
  .inputValidator((input: { candidate: Candidate }) => {
    if (input?.candidate !== "xareba" && input?.candidate !== "natali") {
      throw new Error("Invalid candidate");
    }
    return { candidate: input.candidate };
  })
  .handler(async ({ data }) => {
    const hash = await voterHash();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("votes")
      .insert({ candidate: data.candidate, voter_hash: hash });

    const alreadyVoted = Boolean(error && error.code === "23505");
    if (error && !alreadyVoted) throw new Error("Could not record your vote.");

    return { ...(await tally(hash)), alreadyVoted };
  });
