import type { AccountProfile, InvestigationCoverage } from "./types.ts";
import {
  readCachedXIdentity,
  writeCachedXIdentity,
  type CachedXIdentity,
} from "./storage.ts";

interface XPublicMetrics {
  followers_count?: number;
  following_count?: number;
  post_count?: number;
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
  referenced_posts?: XReferencedPost[];
  public_metrics?: {
    repost_count?: number;
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
  identityCacheHit: boolean;
  estimatedXReadCostUsd: number;
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

const ANALYSIS_DAYS = 180;
const POSTS_PER_SCAN = 5;
const POST_READ_COST_USD = 0.005;
const USER_READ_COST_USD = 0.01;

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
  const types = new Set((post.referenced_posts ?? []).map((item) => item.type));
  if (types.has("replied_to")) return "reply";
  if (types.has("quoted")) return "quote";
  return "original";
}

function daysObserved(posts: XAccountSamplePost[]): number {
  return new Set(posts.map((post) => post.createdAt.slice(0, 10))).size;
}

function buildCoverage(posts: XAccountSamplePost[]): InvestigationCoverage {
  const distinctDays = daysObserved(posts);
  if (posts.length < POSTS_PER_SCAN) {
    return {
      profileResolved: true,
      postsObserved: posts.length,
      distinctDaysObserved: distinctDays,
      sufficiency: "insufficient",
      note: `The X API resolved the profile but returned only ${posts.length} authored posts in the last ${ANALYSIS_DAYS} days.`,
    };
  }

  if (distinctDays < 3) {
    return {
      profileResolved: true,
      postsObserved: posts.length,
      distinctDaysObserved: distinctDays,
      sufficiency: "limited",
      note: `The five-post quick sample is concentrated into only ${distinctDays} distinct day${distinctDays === 1 ? "" : "s"}; confidence is capped.`,
    };
  }

  return {
    profileResolved: true,
    postsObserved: posts.length,
    distinctDaysObserved: distinctDays,
    sufficiency: "sufficient",
    note: `Cost-bounded quick scan using five authored posts across ${distinctDays} distinct days plus public account metadata.`,
  };
}

function identityFromUser(user: XUser): CachedXIdentity {
  const metrics = user.public_metrics ?? {};
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    createdAt: user.created_at,
    description: user.description,
    protected: Boolean(user.protected),
    verified: Boolean(user.verified),
    followers: metrics.followers_count ?? 0,
    following: metrics.following_count ?? 0,
    totalPosts: metrics.post_count ?? 0,
    listed: metrics.listed_count ?? 0,
    resolvedAt: new Date().toISOString(),
  };
}

async function resolveIdentity(handle: string): Promise<{ identity: CachedXIdentity; cacheHit: boolean }> {
  const cached = await readCachedXIdentity(handle);
  if (cached) return { identity: cached, cacheHit: true };

  const userUrl = new URL(`https://api.x.com/2/users/by/username/${encodeURIComponent(handle)}`);
  userUrl.searchParams.set("user.fields", "created_at,description,protected,public_metrics,verified");
  const payload = await xGet<XUserResponse>(userUrl);
  if (!payload.data) throw new Error(`X API could not resolve @${handle}.`);

  const identity = identityFromUser(payload.data);
  await writeCachedXIdentity(handle, identity).catch((error) => {
    console.error("VouchGuard X identity cache write failed", error);
  });
  return { identity, cacheHit: false };
}

export async function fetchXAccountSample(handle: string): Promise<XAccountSample> {
  const { identity, cacheHit } = await resolveIdentity(handle);
  if (identity.protected) {
    throw new Error(`@${identity.username} is protected; VouchGuard only analyzes public X activity.`);
  }

  const timelineUrl = new URL(`https://api.x.com/2/users/${identity.id}/tweets`);
  timelineUrl.searchParams.set("max_results", String(POSTS_PER_SCAN));
  timelineUrl.searchParams.set(
    "start_time",
    new Date(Date.now() - ANALYSIS_DAYS * 24 * 60 * 60 * 1000).toISOString(),
  );
  timelineUrl.searchParams.set("exclude", "retweets");
  timelineUrl.searchParams.set(
    "post.fields",
    "created_at,conversation_id,lang,public_metrics,referenced_posts",
  );

  const timeline = await xGet<XTimelineResponse>(timelineUrl);
  const posts = (timeline.data ?? [])
    .filter((post) => Boolean(post.created_at && post.text))
    .map<XAccountSamplePost>((post) => ({
      id: post.id,
      url: `https://x.com/${identity.username}/status/${post.id}`,
      text: post.text,
      createdAt: post.created_at!,
      kind: postKind(post),
      conversationId: post.conversation_id,
      lang: post.lang,
      metrics: post.public_metrics,
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const coverage = buildCoverage(posts);
  const createdLabel = identity.createdAt
    ? new Date(identity.createdAt).toISOString().slice(0, 10)
    : "unknown";
  const estimatedXReadCostUsd =
    posts.length * POST_READ_COST_USD + (cacheHit ? 0 : USER_READ_COST_USD);

  return {
    profile: {
      handle: identity.username,
      displayName: identity.name,
      bioSummary: identity.description || "No public X bio supplied.",
      accountHistory: `X account created ${createdLabel}. ${identity.followers} followers, ${identity.following} following, ${identity.totalPosts} lifetime posts.`,
      activitySummary: `${posts.length} recent authored posts retrieved from the last ${ANALYSIS_DAYS} days. Identity resolution ${cacheHit ? "reused the 24-hour cache" : "was refreshed from X"}.`,
    },
    coverage,
    posts,
    rawPostsRetrieved: posts.length,
    identityCacheHit: cacheHit,
    estimatedXReadCostUsd,
    account: {
      id: identity.id,
      username: identity.username,
      createdAt: identity.createdAt,
      protected: identity.protected,
      verified: identity.verified,
      followers: identity.followers,
      following: identity.following,
      totalPosts: identity.totalPosts,
      listed: identity.listed,
    },
    sampleStats: {
      replies: posts.filter((post) => post.kind === "reply").length,
      quotes: posts.filter((post) => post.kind === "quote").length,
      originals: posts.filter((post) => post.kind === "original").length,
      distinctDays: daysObserved(posts),
    },
  };
}
