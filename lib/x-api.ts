import type { AccountProfile, InvestigationCoverage } from "./types.ts";

interface XPublicMetrics {
  followers_count?: number;
  following_count?: number;
  tweet_count?: number;
  listed_count?: number;
}

interface XUser {
  id: string;
  name: string;
  username: string;
  created_at?: string;
  description?: string;
  protected?: boolean;
  verified?: boolean;
  public_metrics?: XPublicMetrics;
}

interface XReferencedPost {
  type: "retweeted" | "quoted" | "replied_to" | string;
  id: string;
}

interface XPost {
  id: string;
  text: string;
  created_at?: string;
  conversation_id?: string;
  lang?: string;
  referenced_tweets?: XReferencedPost[];
  public_metrics?: {
    retweet_count?: number;
    reply_count?: number;
    like_count?: number;
    quote_count?: number;
    bookmark_count?: number;
    impression_count?: number;
  };
}

interface XUserResponse {
  data?: XUser;
  errors?: Array<{ title?: string; detail?: string }>;
}

interface XTimelineResponse {
  data?: XPost[];
  meta?: {
    result_count?: number;
    next_token?: string;
  };
  errors?: Array<{ title?: string; detail?: string }>;
}

export interface XAccountSamplePost {
  id: string;
  url: string;
  text: string;
  createdAt: string;
  kind: "reply" | "quote" | "original";
  conversationId?: string;
  lang?: string;
  metrics?: XPost["public_metrics"];
}

export interface XAccountSample {
  profile: AccountProfile;
  coverage: InvestigationCoverage;
  posts: XAccountSamplePost[];
  rawPostsRetrieved: number;
  account: {
    id: string;
    username: string;
    createdAt?: string;
    protected: boolean;
    verified: boolean;
    followers: number;
    following: number;
    totalPosts: number;
    listed: number;
  };
  sampleStats: {
    replies: number;
    quotes: number;
    originals: number;
    distinctDays: number;
  };
}

function bearerToken(): string {
  const token = process.env.X_BEARER_TOKEN?.trim();
  if (!token) throw new Error("X_BEARER_TOKEN is not configured.");
  return token;
}

async function xGet<T>(url: URL): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${bearerToken()}` },
      cache: "no-store",
      signal: controller.signal,
    });
    const payload = (await response.json()) as T & { errors?: Array<{ title?: string; detail?: string }> };
    if (!response.ok) {
      const detail = payload.errors?.map((error) => error.detail || error.title).filter(Boolean).join("; ");
      throw new Error(detail || `X API request failed with HTTP ${response.status}.`);
    }
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

function postKind(post: XPost): XAccountSamplePost["kind"] {
  const types = new Set((post.referenced_tweets ?? []).map((item) => item.type));
  if (types.has("replied_to")) return "reply";
  if (types.has("quoted")) return "quote";
  return "original";
}

function evenSample<T>(items: T[], limit: number): T[] {
  if (items.length <= limit) return [...items];
  if (limit <= 1) return [items[0]!];
  const picked: T[] = [];
  const used = new Set<number>();
  for (let i = 0; i < limit; i++) {
    const index = Math.round((i * (items.length - 1)) / (limit - 1));
    if (!used.has(index)) {
      used.add(index);
      picked.push(items[index]!);
    }
  }
  return picked;
}

function daysObserved(posts: XAccountSamplePost[]): number {
  return new Set(posts.map((post) => post.createdAt.slice(0, 10))).size;
}

function buildCoverage(posts: XAccountSamplePost[]): InvestigationCoverage {
  const distinctDays = daysObserved(posts);
  if (posts.length < 5) {
    return {
      profileResolved: true,
      postsObserved: posts.length,
      distinctDaysObserved: distinctDays,
      sufficiency: "insufficient",
      note: `The X API resolved the profile but only ${posts.length} authored posts were available to the analysis sample.`,
    };
  }
  if (posts.length < 15 || distinctDays < 4) {
    return {
      profileResolved: true,
      postsObserved: posts.length,
      distinctDaysObserved: distinctDays,
      sufficiency: "limited",
      note: `The X API supplied ${posts.length} authored posts across ${distinctDays} distinct days; the result should be interpreted conservatively.`,
    };
  }
  return {
    profileResolved: true,
    postsObserved: posts.length,
    distinctDaysObserved: distinctDays,
    sufficiency: "sufficient",
    note: `The X API supplied a representative sample of ${posts.length} authored posts across ${distinctDays} distinct days.`,
  };
}

export async function fetchXAccountSample(handle: string): Promise<XAccountSample> {
  const userUrl = new URL(`https://api.x.com/2/users/by/username/${encodeURIComponent(handle)}`);
  userUrl.searchParams.set("user.fields", "created_at,description,protected,public_metrics,verified");
  const userPayload = await xGet<XUserResponse>(userUrl);
  const user = userPayload.data;
  if (!user) throw new Error(`X API could not resolve @${handle}.`);
  if (user.protected) throw new Error(`@${user.username} is protected; VouchGuard only analyzes public X activity.`);

  const start = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
  const allPosts: XPost[] = [];
  let paginationToken: string | undefined;

  for (let page = 0; page < 3; page++) {
    const timelineUrl = new URL(`https://api.x.com/2/users/${user.id}/tweets`);
    timelineUrl.searchParams.set("max_results", "100");
    timelineUrl.searchParams.set("start_time", start);
    timelineUrl.searchParams.set("exclude", "retweets");
    timelineUrl.searchParams.set(
      "tweet.fields",
      "created_at,conversation_id,lang,public_metrics,referenced_tweets",
    );
    if (paginationToken) timelineUrl.searchParams.set("pagination_token", paginationToken);

    const pagePayload = await xGet<XTimelineResponse>(timelineUrl);
    allPosts.push(...(pagePayload.data ?? []));
    paginationToken = pagePayload.meta?.next_token;
    if (!paginationToken || allPosts.length >= 300) break;
  }

  const normalized = allPosts
    .filter((post) => Boolean(post.created_at && post.text))
    .map<XAccountSamplePost>((post) => ({
      id: post.id,
      url: `https://x.com/${user.username}/status/${post.id}`,
      text: post.text,
      createdAt: post.created_at!,
      kind: postKind(post),
      conversationId: post.conversation_id,
      lang: post.lang,
      metrics: post.public_metrics,
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const posts = evenSample(normalized, 30);
  const coverage = buildCoverage(posts);
  const metrics = user.public_metrics ?? {};
  const createdLabel = user.created_at ? new Date(user.created_at).toISOString().slice(0, 10) : "unknown";

  return {
    profile: {
      handle: user.username,
      displayName: user.name,
      bioSummary: user.description || "No public X bio supplied.",
      accountHistory: `X account created ${createdLabel}. ${metrics.followers_count ?? 0} followers, ${metrics.following_count ?? 0} following, ${metrics.tweet_count ?? 0} lifetime posts.`,
      activitySummary: `${posts.length} authored posts sampled from ${normalized.length} retrieved posts in the last 180 days.`,
    },
    coverage,
    posts,
    rawPostsRetrieved: normalized.length,
    account: {
      id: user.id,
      username: user.username,
      createdAt: user.created_at,
      protected: Boolean(user.protected),
      verified: Boolean(user.verified),
      followers: metrics.followers_count ?? 0,
      following: metrics.following_count ?? 0,
      totalPosts: metrics.tweet_count ?? 0,
      listed: metrics.listed_count ?? 0,
    },
    sampleStats: {
      replies: posts.filter((post) => post.kind === "reply").length,
      quotes: posts.filter((post) => post.kind === "quote").length,
      originals: posts.filter((post) => post.kind === "original").length,
      distinctDays: daysObserved(posts),
    },
  };
}
