export default {
  async fetch(request, env) {
    const mbinu = request.method;

    if (mbinu === 'POST') {
      try {
        const data = await request.json();
        const bids = data.bids || [];
        const asks = data.asks || [];
        
        const statements = [];

        // Bids Processing
        for (const bid of bids) {
          if (parseFloat(bid.kiasi) === 0) {
            // Futa kabisa na usiruhusu kuingia upya
            statements.push(
              env.DB.prepare(`DELETE FROM bids WHERE bei = ?1 AND exchange = ?2`).bind(bid.bei, bid.exchange)
            );
          } else {
            // Ingiza oda halisi tu ya kuanzia $1M+
            statements.push(
              env.DB.prepare(`
                INSERT INTO bids (bei, kiasi, dola, exchange) VALUES (?1, ?2, ?3, ?4)
                ON CONFLICT(bei, exchange) DO UPDATE SET kiasi = EXCLUDED.kiasi, dola = EXCLUDED.dola, muda_kusasishwa = CURRENT_TIMESTAMP
              `).bind(bid.bei, bid.kiasi, bid.dola, bid.exchange)
            );
          }
        }

        // Asks Processing
        for (const ask of asks) {
          if (parseFloat(ask.kiasi) === 0) {
            // Futa kabisa na usiruhusu kuingia upya
            statements.push(
              env.DB.prepare(`DELETE FROM asks WHERE bei = ?1 AND exchange = ?2`).bind(ask.bei, ask.exchange)
            );
          } else {
            // Ingiza oda halisi tu ya kuanzia $1M+
            statements.push(
              env.DB.prepare(`
                INSERT INTO asks (bei, kiasi, dola, exchange) VALUES (?1, ?2, ?3, ?4)
                ON CONFLICT(bei, exchange) DO UPDATE SET kiasi = EXCLUDED.kiasi, dola = EXCLUDED.dola, muda_kusasishwa = CURRENT_TIMESTAMP
              `).bind(ask.bei, ask.kiasi, ask.dola, ask.exchange)
            );
          }
        }

        if (statements.length > 0) {
          await env.DB.batch(statements);
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });

      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
    }

    // GET Request (Mtu akifungua browser kuona data zilizobaki)
    try {
      const bidsResult = await env.DB.prepare("SELECT * FROM bids WHERE exchange = 'Binance (BTCUSDT)' ORDER BY bei DESC").all();
      const asksResult = await env.DB.prepare("SELECT * FROM asks WHERE exchange = 'Binance (BTCUSDT)' ORDER BY bei ASC").all();

      return new Response(JSON.stringify({ bids: bidsResult.results, asks: asksResult.results }, null, 2), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
  }
};
