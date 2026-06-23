export default {
  async fetch(request, env) {
    const mbinu = request.method;

    if (mbinu === 'POST') {
      try {
        const data = await request.json();
        const bids = data.bids || [];
        const asks = data.asks || [];
        
        const statements = [];

        // HATUA YA KWANZA: Futa oda zote za zamani za Binance zilizopo kwenye database
        statements.push(env.DB.prepare("DELETE FROM bids WHERE exchange = 'Binance (BTCUSDT)'"));
        statements.push(env.DB.prepare("DELETE FROM asks WHERE exchange = 'Binance (BTCUSDT)'"));

        // HATUA YA PILI: Ingiza oda kubwa pekee zilizopo hai sasa hivi (Zote zina kiasi > 0)
        for (const bid of bids) {
          if (bid.kiasi > 0) {
            statements.push(
              env.DB.prepare(`INSERT INTO bids (bei, kiasi, dola, exchange) VALUES (?1, ?2, ?3, ?4)`)
              .bind(bid.bei, bid.kiasi, bid.dola, bid.exchange)
            );
          }
        }

        for (const ask of asks) {
          if (ask.kiasi > 0) {
            statements.push(
              env.DB.prepare(`INSERT INTO asks (bei, kiasi, dola, exchange) VALUES (?1, ?2, ?3, ?4)`)
              .bind(ask.bei, ask.kiasi, ask.dola, ask.exchange)
            );
          }
        }

        // Tekeleza zote kwa mkupuo mmoja (Batch transactional processing)
        if (statements.length > 0) {
          await env.DB.batch(statements);
        }

        return new Response(JSON.stringify({ success: true, message: "Database imesafishwa na kusasishwa!" }), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });

      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
      }
    }

    // NJIA YA GET: INASOMA DATA KWA AJILI YA WEBSITE YAKO
    try {
      const bidsResult = await env.DB.prepare("SELECT * FROM bids ORDER BY bei DESC").all();
      const asksResult = await env.DB.prepare("SELECT * FROM asks ORDER BY bei ASC").all();

      return new Response(JSON.stringify({ bids: bidsResult.results, asks: asksResult.results }, null, 2), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
  }
};
