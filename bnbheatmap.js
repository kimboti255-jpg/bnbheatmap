export default {
  async fetch(request, env) {
    const mbinu = request.method;

    if (mbinu === 'POST') {
      try {
        const data = await request.json();
        const upsertBids = data.upsertBids || [];
        const upsertAsks = data.upsertAsks || [];
        const deleteBids = data.deleteBids || [];
        const deleteAsks = data.deleteAsks || [];
        
        const statements = [];

        // 1. FUTA ODA ZILIZOFUTWA BINANCE
        for (const bid of deleteBids) {
          statements.push(
            env.DB.prepare("DELETE FROM bids WHERE bei = ?1 AND exchange = ?2").bind(bid.bei, bid.exchange)
          );
        }
        for (const ask of deleteAsks) {
          statements.push(
            env.DB.prepare("DELETE FROM asks WHERE bei = ?1 AND exchange = ?2").bind(ask.bei, ask.exchange)
          );
        }

        // 2. INGIZA AU SASISHA ODA KUBWA (Tunatumia REPLACE badala ya ON CONFLICT)
        for (const bid of upsertBids) {
          statements.push(
            env.DB.prepare(`REPLACE INTO bids (bei, kiasi, dola, exchange) VALUES (?1, ?2, ?3, ?4)`).bind(bid.bei, bid.kiasi, bid.dola, bid.exchange)
          );
        }

        for (const ask of upsertAsks) {
          statements.push(
            env.DB.prepare(`REPLACE INTO asks (bei, kiasi, dola, exchange) VALUES (?1, ?2, ?3, ?4)`).bind(ask.bei, ask.kiasi, ask.dola, ask.exchange)
          );
        }

        // 3. UFAGUZI WA KIOTOMATIKI (Sekunde 30)
        statements.push(env.DB.prepare("DELETE FROM bids WHERE muda_kuingizwa < datetime('now', '-30 seconds')"));
        statements.push(env.DB.prepare("DELETE FROM asks WHERE muda_kuingizwa < datetime('now', '-30 seconds')"));

        if (statements.length > 0) {
          await env.DB.batch(statements);
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });

      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 400 });
      }
    }

    // NJIA YA GET: INASOMA DATA KWA AJILI YA WEBSITE YAKO
    try {
      const bidsResult = await env.DB.prepare("SELECT *, ROUND((strftime('%s', 'now') - strftime('%s', muda_kuingizwa)) / 60.0, 1) AS dakika_sokoni FROM bids WHERE muda_kuingizwa >= datetime('now', '-30 seconds') ORDER BY bei DESC").all();
      const asksResult = await env.DB.prepare("SELECT *, ROUND((strftime('%s', 'now') - strftime('%s', muda_kuingizwa)) / 60.0, 1) AS dakika_sokoni FROM asks WHERE muda_kuingizwa >= datetime('now', '-30 seconds') ORDER BY bei ASC").all();

      return new Response(JSON.stringify({ bids: bidsResult.results, asks: asksResult.results }, null, 2), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
  }
};
