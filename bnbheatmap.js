export default {
  async fetch(request, env) {
    const mbinu = request.method;

    if (mbinu === 'POST') {
      try {
        const data = await request.json();
        const bids = data.bids || [];
        const asks = data.asks || [];
        
        const statements = [];

        // A: SHUGHULIKIA WANUNUZI (BIDS)
        for (const bid of bids) {
          const bei = parseFloat(bid.bei);
          const kiasi = parseFloat(bid.kiasi);

          if (kiasi === 0) {
            // Futa kwa kutumia mbinu ya masafa kuzuia floating point error
            statements.push(
              env.DB.prepare("DELETE FROM bids WHERE ABS(bei - ?1) < 0.0001 AND exchange = ?2").bind(bei, bid.exchange)
            );
          } else {
            statements.push(
              env.DB.prepare(`
                INSERT INTO bids (bei, kiasi, dola, exchange) VALUES (?1, ?2, ?3, ?4)
                ON CONFLICT(bei, exchange) DO UPDATE SET 
                  kiasi = EXCLUDED.kiasi, 
                  dola = EXCLUDED.dola,
                  muda_kuingizwa = CURRENT_TIMESTAMP
              `).bind(bei, kiasi, bid.dola, bid.exchange)
            );
          }
        }

        // B: SHUGHULIKIA WAUZAJI (ASKS)
        for (const ask of asks) {
          const bei = parseFloat(ask.bei);
          const kiasi = parseFloat(ask.kiasi);

          if (kiasi === 0) {
            statements.push(
              env.DB.prepare("DELETE FROM asks WHERE ABS(bei - ?1) < 0.0001 AND exchange = ?2").bind(bei, ask.exchange)
            );
          } else {
            statements.push(
              env.DB.prepare(`
                INSERT INTO asks (bei, kiasi, dola, exchange) VALUES (?1, ?2, ?3, ?4)
                ON CONFLICT(bei, exchange) DO UPDATE SET 
                  kiasi = EXCLUDED.kiasi, 
                  dola = EXCLUDED.dola,
                  muda_kuingizwa = CURRENT_TIMESTAMP
              `).bind(bei, kiasi, ask.dola, ask.exchange)
            );
          }
        }

        // UFAGUZI WA USALAMA: Futa kabisa oda zote zilizobaki na kiasi cha 0 kimakosa
        statements.push(env.DB.prepare("DELETE FROM bids WHERE kiasi <= 0"));
        statements.push(env.DB.prepare("DELETE FROM asks WHERE kiasi <= 0"));

        if (statements.length > 0) {
          await env.DB.batch(statements);
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });

      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
      }
    }

    // NJIA YA GET: WEBSITE INAPOSOMA DATA (HAPA TUNACHUJA TU ZENYE KIASI KIKUBWA KULIKO 0)
    try {
      const bidsResult = await env.DB.prepare(`
        SELECT bei, kiasi, dola, exchange, muda_kuingizwa,
        ROUND((strftime('%s', 'now') - strftime('%s', muda_kuingizwa)) / 60.0, 1) AS dakika_sokoni 
        FROM bids 
        WHERE kiasi > 0 
        ORDER BY bei DESC
      `).all();

      const asksResult = await env.DB.prepare(`
        SELECT bei, kiasi, dola, exchange, muda_kuingizwa,
        ROUND((strftime('%s', 'now') - strftime('%s', muda_kuingizwa)) / 60.0, 1) AS dakika_sokoni 
        FROM asks 
        WHERE kiasi > 0 
        ORDER BY bei ASC
      `).all();

      return new Response(JSON.stringify({ bids: bidsResult.results, asks: asksResult.results }, null, 2), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
  }
};
