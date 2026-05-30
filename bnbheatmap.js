export default {
  // 1. CRON TRIGGER: Inaiamsha seva ya PHP kila dakika 1
  async scheduled(event, env, ctx) {
    const profreehost_url = "https://bnheatmap.onrender.com";
    ctx.waitUntil(
      fetch(profreehost_url, { headers: { "User-Agent": "Cloudflare-Cron-Trigger" } })
    );
  },
  //===≠====XXXXXXXXX
  
  async fetch(request, env) {
    const mbinu = request.method;

    // 1. NJIA YA POST: Inapokea data kutoka RENDER (Binance pekee)
    if (mbinu === 'POST') {
      try {
        const data = await request.json();
        const bids = data.bids || [];
        const asks = data.asks || [];
        
        const statements = [];

        // Inserter ya Bids za Binance
        for (const bid of bids) {
          statements.push(
            env.DB.prepare(`
              INSERT INTO bids (bei, kiasi, dola, exchange) VALUES (?1, ?2, ?3, ?4)
              ON CONFLICT(bei, exchange) DO UPDATE SET kiasi = EXCLUDED.kiasi, dola = EXCLUDED.dola, muda_kusasishwa = CURRENT_TIMESTAMP
            `).bind(bid.bei, bid.kiasi, bid.dola, bid.exchange)
          );
        }

        // Inserter ya Asks za Binance
        for (const ask of asks) {
          statements.push(
            env.DB.prepare(`
              INSERT INTO asks (bei, kiasi, dola, exchange) VALUES (?1, ?2, ?3, ?4)
              ON CONFLICT(bei, exchange) DO UPDATE SET kiasi = EXCLUDED.kiasi, dola = EXCLUDED.dola, muda_kusasishwa = CURRENT_TIMESTAMP
            `).bind(ask.bei, ask.kiasi, ask.dola, ask.exchange)
          );
        }

        // Sukuma kwenye D1 Database
        if (statements.length > 0) {
          await env.DB.batch(statements);
        }

        // Fagio maalum la Binance (Inafuta tu oda za Binance zilizozidi dakika 2)
        await env.DB.batch([
          env.DB.prepare("DELETE FROM bids WHERE exchange = 'Binance' AND muda_kusasishwa < datetime('now', '-2 minute')"),
          env.DB.prepare("DELETE FROM asks WHERE exchange = 'Binance' AND muda_kusasishwa < datetime('now', '-2 minute')")
        ]);

        return new Response(JSON.stringify({ success: true, kutoka: "Binance Worker" }), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });

      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
    }

    // Kama mtu akaifungua kwa bahati mbaya kwenye browser
    return new Response("Hapa ni mlango wa POST wa Binance tu!", { status: 400 });
  }
};