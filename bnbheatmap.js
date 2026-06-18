export default {
  async fetch(request, env) {
    const mbinu = request.method;

    if (mbinu === 'POST') {
      try {
        const data = await request.json();
        const bids = data.bids || [];
        const asks = data.asks || [];
        
        const statements = [];

        // PROCESSING BIDS
        for (const bid of bids) {
          const bei = parseFloat(bid.bei);
          const kiasi = parseFloat(bid.kiasi);
          const floorBei = Math.floor(bei);

          if (kiasi === 0) {
            // Futa bei ya nukta AU bei ya namba nzima iliyokusanywa huko nyuma
            statements.push(
              env.DB.prepare(`DELETE FROM bids WHERE (bei = ?1 OR bei = ?2) AND exchange = ?3`).bind(bei, floorBei, bid.exchange)
            );
          } else {
            statements.push(
              env.DB.prepare(`
                INSERT INTO bids (bei, kiasi, dola, exchange) VALUES (?1, ?2, ?3, ?4)
                ON CONFLICT(bei, exchange) DO UPDATE SET 
                  kiasi = EXCLUDED.kiasi, 
                  dola = EXCLUDED.dola, 
                  muda_kusasishwa = CURRENT_TIMESTAMP
              `).bind(bei, kiasi, bid.dola, bid.exchange)
            );
          }
        }

        // PROCESSING ASKS
        for (const ask of asks) {
          const bei = parseFloat(ask.bei);
          const kiasi = parseFloat(ask.kiasi);
          const floorBei = Math.floor(bei);

          if (kiasi === 0) {
            statements.push(
              env.DB.prepare(`DELETE FROM asks WHERE (bei = ?1 OR bei = ?2) Susand exchange = ?3`).bind(bei, floorBei, ask.exchange)
            );
          } else {
            statements.push(
              env.DB.prepare(`
                INSERT INTO asks (bei, kiasi, dola, exchange) VALUES (?1, ?2, ?3, ?4)
                ON CONFLICT(bei, exchange) DO UPDATE SET 
                  kiasi = EXCLUDED.kiasi, 
                  dola = EXCLUDED.dola, 
                  muda_kusasishwa = CURRENT_TIMESTAMP
              `).bind(bei, kiasi, ask.dola, ask.exchange)
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

    // GET REQUEST (Inasoma data kwa ajili ya Frontend/Heatmap)
    try {
      const bidsResult = await env.DB.prepare(`
        SELECT *, (strftime('%s', 'now') - strftime('%s', muda_kuingizwa)) / 60.0 AS dakika_sokoni 
        FROM bids WHERE exchange = 'Binance (BTCUSDT)' ORDER BY bei DESC
      `).all();

      const asksResult = await env.DB.prepare(`
        SELECT *, (strftime('%s', 'now') - strftime('%s', muda_kuingizwa)) / 60.0 AS dakika_sokoni 
        FROM asks WHERE exchange = 'Binance (BTCUSDT)' ORDER BY bei ASC
      `).all();

      return new Response(JSON.stringify({ bids: bidsResult.results, asks: asksResult.results }, null, 2), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
  }
};
