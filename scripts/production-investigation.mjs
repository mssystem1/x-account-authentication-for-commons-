const base='https://vouchguard-ai.vercel.app';
const handles=['cryptokaai','elminselimov5','carlitoswa_y'];
for (const handle of handles) {
  const response=await fetch(`${base}/api/scan`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({handle,refresh:true})});
  const text=await response.text();
  console.log(`\n===== ${handle} HTTP ${response.status} =====`);
  if(!response.ok){console.log(text);continue;}
  const r=JSON.parse(text);
  const vouchers=(r.supporters||[]).filter(x=>x.action==='vouch');
  const slashers=(r.supporters||[]).filter(x=>x.action==='slash');
  console.log(JSON.stringify({
    handle:r.handle, commons:r.commons, metrics:r.metrics, stats:r.stats, report:r.report,
    topVouchers:vouchers.slice(0,12).map(x=>({h:x.handle,p:x.points,rank:x.commonsRank,incoming:x.uniqueIncomingActors,recip:x.reciprocatedByTarget,iv:x.internalVouchLinks,is:x.internalSlashLinks,loaded:x.graphLoaded})),
    topSlashers:slashers.slice(0,20).map(x=>({h:x.handle,p:x.points,rank:x.commonsRank,incoming:x.uniqueIncomingActors,recip:x.reciprocatedByTarget,iv:x.internalVouchLinks,is:x.internalSlashLinks,loaded:x.graphLoaded})),
    recentEvents:(r.sourceEntries||[]).slice(0,25).map(x=>({kind:x.kind,author:x.authorHandle,points:x.points,at:x.createdAt,url:x.tweetUrl}))
  },null,2));
}
