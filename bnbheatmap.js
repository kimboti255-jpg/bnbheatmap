export default {

  async fetch(request, env) {

    const mbinu = request.method;
    if (mbinu === 'POST') {

      try {

        const data = await request.json();

        const bids = data.bids || [];

        const asks = data.asks || [];

        const statements = [];
        const exchangeName = "Binance (BTCUSDT)";

        // 1. FUTA DATA ZOTE ZA ZAMANI ZA BINANCE PEKEE KWANZA
        statements.push(
          env.DB.prepare("DELETE FROM bids WHERE exchange = ?1").bind(exchangeName)
        );
        statements.push(
          env.DB.prepare("DELETE FROM asks WHERE exchange = ?1").bind(exchangeName)
        );

        // A: SHUGHULIKIA WANUNUZI (BIDS)
        for (const bid of bids) {

          const bei = parseFloat(bid.bei);

          const kiasi = parseFloat(bid.kiasi);
          
          // Tunaingiza tu oda halali zenye kiasi (Haziitaji ON CONFLICT kwa kuwa tumefuta za zamani)
          if (kiasi > 0) {
            statements.push(
              env.DB.prepare("INSERT INTO bids (bei, kiasi, dola, exchange) VALUES (?1, ?2, ?3, ?4)")
              .bind(bei, kiasi, bid.dola, bid.exchange)
            );
          }

        }
        // B: SHUGHULIKIA WAUZAJI (ASKS)

        for (const ask of asks) {

          const bei = parseFloat(ask.bei);

          const kiasi = parseFloat(ask.kiasi);
          
          if (kiasi > 0) {
            statements.push(
              env.DB.prepare("INSERT INTO asks (bei, kiasi, dola, exchange) VALUES (?1, ?2, ?3, ?4)")
              .bind(bei, kiasi, ask.dola, ask.exchange)
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

        return new Response(JSON.stringify({ error: error.message }), { status: 500 });

      }

    }
    // NJIA YA GET: WEBSITE INAPOSOMA DATA (BILA MAMBO YA MUDA)

    try {

      const bidsResult = await env.DB.prepare(`

        SELECT bei, kiasi, dola, exchange 

        FROM bids 

        WHERE kiasi > 0 

        ORDER BY bei DESC

      `).all();
      const asksResult = await env.DB.prepare(`

        SELECT bei, kiasi, dola, exchange 

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