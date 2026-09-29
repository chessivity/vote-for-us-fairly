import { createServerFn } from "@tanstack/react-start";
import { getRequestIP, getRequestHeader } from "@tanstack/react-start/server";

export type Candidate = "xareba" | "natali";

export const NATALI_HEAD_START = 5;

/** Maximum total votes shown (including the head start). Change this single number to adjust the cap. */
export const MAX_TOTAL_VOTES = 21;

export type VoteResults = {
  xareba: number;
  natali: number;
  total: number;
  full: boolean;
  myVote: Candidate | null;
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
    supabaseAdmin.from("votes").select("candidate").eq("voter_hash", hash).maybeSingle(),
  ]);
  const list = rows ?? [];
  const xareba = list.filter((r) => r.candidate === "xareba").length;
  const natali = list.filter((r) => r.candidate === "natali").length + NATALI_HEAD_START;
  const total = xareba + natali;
  return {
    xareba,
    natali,
    total,
    full: total >= MAX_TOTAL_VOTES,
    myVote: (mine?.candidate as Candidate | undefined) ?? null,
  };
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
    const { data: existing } = await supabaseAdmin
      .from("votes")
      .select("id, candidate")
      .eq("voter_hash", hash)
      .maybeSingle();

    let changed = false;
    if (existing) {
      if (existing.candidate !== data.candidate) {
        const { error } = await supabaseAdmin
          .from("votes")
          .update({ candidate: data.candidate })
          .eq("id", existing.id);
        if (error) throw new Error("Could not change your vote.");
        changed = true;
      }
    } else {
      const { data: allRows, error: countError } = await supabaseAdmin
        .from("votes")
        .select("id");
      if (countError) throw new Error("Could not record your vote.");
      if ((allRows?.length ?? 0) + NATALI_HEAD_START >= MAX_TOTAL_VOTES) {
        throw new Error("VOTE_LIMIT_REACHED");
      }
      const { error } = await supabaseAdmin
        .from("votes")
        .insert({ candidate: data.candidate, voter_hash: hash });
      if (error) throw new Error("Could not record your vote.");
    }

    return { ...(await tally(hash)), changed };
  });
