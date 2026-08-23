import { ResultPanel } from "@/components/ResultPanel";
import { readCachedScan } from "@/lib/storage";
import { appOrigin, normalizeHandle } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PublicResultPage({ params }: { params: Promise<{ handle: string }> }) {
  const rawHandle = (await params).handle;
  let handle: string;
  try { handle = normalizeHandle(rawHandle); } catch { handle = rawHandle; }
  const result = await readCachedScan(handle);

  return (
    <main>
      <header className="site-header page-width"><a className="brand" href="/"><span className="brand-mark">V</span><span>VouchGuard <em>AI</em></span></a><nav><a href="/">New scan</a><a href="/methodology">Methodology</a></nav></header>
      <section className="page-width public-result-page">
        {result ? <ResultPanel result={{ ...result, permalink: `${appOrigin()}/u/${handle}` }} standalone /> : <div className="empty-public"><p className="eyebrow">NO CACHED RESULT</p><h1>@{handle}</h1><p>This public result is not available. Scan the account to create or refresh an assessment.</p><a className="primary-button" href={`/?handle=${encodeURIComponent(handle)}`}>Scan account</a></div>}
      </section>
    </main>
  );
}
