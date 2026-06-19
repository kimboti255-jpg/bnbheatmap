export default {
  async fetch(request, env) {
    const mbinu = request.method;

    if (mbinu === 'POST') {
      try {
        const data = await request.json();
        const bids = data.bids || [];
        const asks = data.asks || [];
        
        const statements = [];

        // 1. CHAKATA BIDS
        for (const bid of bids) {
          const bei = parseFloat(bid.bei);
          const kiasi = parseFloat(bid.kiasi);

          if (kiasi === 0) {
            // LOGIC: Ikitokea bei ileile imetumwa ina kiasi 0, ifutwe kabisa kwenye database!
            statements.push(
              env.DB.prepare(`DELETE FROM bids WHERE bei = ?1 AND exchange = ?2`).bind(bei, bid.exchange)
            );
          } else {
            // LOGIC: Kama ipo isasishe kiasi, kama haipo iingize na ilinde muda_kuingizwa
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

        // 2. CHAKATA ASKS
        for (const ask of asks) {
          const bei = parseFloat(ask.bei);
          const kiasi = parseFloat(ask.kiasi);

          if (kiasi === 0) {
            statements.push(
              env.DB.prepare(`DELETE FROM asks WHERE bei = ?1 AND exchange = ?2`).bind(bei, ask.exchange)
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

        // Tekeleza mabadiliko yote kwa mkupuo
        if (statements.length > 0) {
          await env.DB.batch(statements);
        }

        // UFAGUZI WA KIOTOMATIKI (Kama ule wa PHP yako):
        // Futa oda yoyote ya zamani ambayo haikupata sasisho ndani ya sekunde 30 zilizopita
        const cleanStatements = [
          env.DB.prepare("DELETE FROM bids WHERE muda_kusasishwa < datetime('now', '-30 seconds')"),
          env.DB.prepare("DELETE FROM asks WHERE muda_kusasishwa < datetime('now', '-30 seconds')")
        ];
        await env.DB.batch(cleanStatements);

        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });

      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
      }
    }

    // NJIA YA GET: INASOMA DATA KWA AJILI YA HTML FRONTEND YAKO
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
