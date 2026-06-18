export default {
  async fetch(request, env) {
    const mbinu = request.method;

    // 1. NJIA YA POST: Inapokea data kutoka Hugging Face (Binance pekee)
    if (mbinu === 'POST') {
      try {
        const data = await request.json();
        const bids = data.bids || [];
        const asks = data.asks || [];
        
        const statements = [];

        // Chakata Bids
        for (const bid of bids) {
          if (parseFloat(bid.kiasi) === 0) {
            // REKEBISHO: Kama kiasi ni 0, ifute kabisa kwenye database
            statements.push(
              env.DB.prepare(`DELETE FROM bids WHERE bei = ?1 AND exchange = ?2`).bind(bid.bei, bid.exchange)
            );
          } else {
            // Kama kiasi kipo, iingize au kuisasisha
            statements.push(
              env.DB.prepare(`
                INSERT INTO bids (bei, kiasi, dola, exchange) VALUES (?1, ?2, ?3, ?4)
                ON CONFLICT(bei, exchange) DO UPDATE SET kiasi = EXCLUDED.kiasi, dola = EXCLUDED.dola, muda_kusasishwa = CURRENT_TIMESTAMP
              `).bind(bid.bei, bid.kiasi, bid.dola, bid.exchange)
            );
          }
        }

        // Chakata Asks
        for (const ask of asks) {
          if (parseFloat(ask.kiasi) === 0) {
            // REKEBISHO: Kama kiasi ni 0, ifute kabisa kwenye database
            statements.push(
              env.DB.prepare(`DELETE FROM asks WHERE bei = ?1 AND exchange = ?2`).bind(ask.bei, ask.exchange)
            );
          } else {
            // Kama kiasi kipo, iingize au kuisasisha
            statements.push(
              env.DB.prepare(`
                INSERT INTO asks (bei, kiasi, dola, exchange) VALUES (?1, ?2, ?3, ?4)
                ON CONFLICT(bei, exchange) DO UPDATE SET kiasi = EXCLUDED.kiasi, dola = EXCLUDED.dola, muda_kusasishwa = CURRENT_TIMESTAMP
              `).bind(ask.bei, ask.kiasi, ask.dola, ask.exchange)
            );
          }
        }

        // Sukuma mabadiliko yote kwa mkupuo (Batch) kwenye D1
        if (statements.length > 0) {
          await env.DB.batch(statements);
        }

        return new Response(JSON.stringify({ success: true, kutoka: "Binance D1 Worker" }), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });

      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
    }

    return new Response("Hapa ni mlango wa POST wa Binance tu!", { status: 400 });
  }
};
