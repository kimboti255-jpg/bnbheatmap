export default {
  async fetch(request, env) {
    const mbinu = request.method;

    // NJIA YA POST: INAPOKEA DATA NA KUIWEKA AU KUIFUTA KWENYE DATABASE
    if (mbinu === 'POST') {
      try {
        const data = await request.json();
        const bids = data.bids || [];
        const asks = data.asks || [];
        
        const statements = [];

        // SHUGHULIKIA WANUNUZI (BIDS)
        for (const bid of bids) {
          if (bid.kiasi === 0) {
            // A: Oda ya 0 imekuja? Futa kabisa kwenye Database!
            statements.push(
              env.DB.prepare(`DELETE FROM bids WHERE bei = ?1 AND exchange = ?2`).bind(bid.bei, bid.exchange)
            );
          } else {
            // B: Ni Nyangumi mzima? Ingiza au Sasisha kiasi na dola kikiwa kimebadilika
            statements.push(
              env.DB.prepare(`
                INSERT INTO bids (bei, kiasi, dola, exchange) VALUES (?1, ?2, ?3, ?4)
                ON CONFLICT(bei, exchange) DO UPDATE SET 
                  kiasi = EXCLUDED.kiasi, 
                  dola = EXCLUDED.dola, 
                  muda_kusasishwa = CURRENT_TIMESTAMP
              `).bind(bid.bei, bid.kiasi, bid.dola, bid.exchange)
            );
          }
        }

        // SHUGHULIKIA WAUZAJI (ASKS)
        for (const ask of asks) {
          if (ask.kiasi === 0) {
            // Futa kabisa kwenye Database!
            statements.push(
              env.DB.prepare(`DELETE FROM asks WHERE bei = ?1 AND exchange = ?2`).bind(ask.bei, ask.exchange)
            );
          } else {
            // Ingiza au Sasisha kiasi na dola
            statements.push(
              env.DB.prepare(`
                INSERT INTO asks (bei, kiasi, dola, exchange) VALUES (?1, ?2, ?3, ?4)
                ON CONFLICT(bei, exchange) DO UPDATE SET 
                  kiasi = EXCLUDED.kiasi, 
                  dola = EXCLUDED.dola, 
                  muda_kusasishwa = CURRENT_TIMESTAMP
              `).bind(ask.bei, ask.kiasi, ask.dola, ask.exchange)
            );
          }
        }

        // Tekeleza zote kwa mkupuo (Batch)
        if (statements.length > 0) {
          await env.DB.batch(statements);
        }

        return new Response(JSON.stringify({ success: true, message: "Imesasishwa!" }), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });

      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
      }
    }

    // NJIA YA GET: INASOMA DATA KWA AJILI YA FRONTEND/WEBSITE YAKO
    try {
      const bidsResult = await env.DB.prepare(`
        SELECT *, ROUND((strftime('%s', 'now') - strftime('%s', muda_kuingizwa)) / 60.0, 1) AS dakika_sokoni 
        FROM bids ORDER BY bei DESC
      `).all();

      const asksResult = await env.DB.prepare(`
        SELECT *, ROUND((strftime('%s', 'now') - strftime('%s', muda_kuingizwa)) / 60.0, 1) AS dakika_sokoni 
        FROM asks ORDER BY bei ASC
      `).all();

      return new Response(JSON.stringify({ bids: bidsResult.results, asks: asksResult.results }, null, 2), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
  }
};
