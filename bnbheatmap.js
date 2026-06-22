export default {
  async fetch(request, env, ctx) {
    // Kuruhusu maombi kutoka Render (CORS)
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    if (request.method !== "POST") {
      return new Response("Njia inayoruhusiwa ni POST pekee", { status: 405 });
    }

    try {
      // Kusoma data inayokuja kutoka kwenye msimbo wa Render
      const body = await request.json();
      const { bids, asks } = body;

      // Hakikisha Database ya D1 imeunganishwa (Inaitwa DB kwenye wrangler.toml)
      if (!env.DB) {
        return new Response("Hitilafu: Database ya D1 haijapatikana.", { status: 500 });
      }

      let oparesheni_za_sql = [];

      // 1. CHAKATA BIDS (BUY ORDERS)
      if (bids && bids.length > 0) {
        for (const bid of bids) {
          // Kama kiasi kimekuwa 0, maana yake oda imefutwa (Canceled/Filled) kwenye Binance
          if (bid.kiasi === 0 && bid.exchange === "Binance") {
            oparesheni_za_sql.push(
              env.DB.prepare("DELETE FROM bids WHERE bei = ? AND exchange = ?")
                    .bind(bid.bei, "Binance")
            );
          } else if (bid.kiasi > 0) {
            // Kama ipo: Sasisha kiasi na dola tu, muda wa kuingizwa ubaki ule ule.
            // Kama haipo: Ingiza kama oda mpya.
            oparesheni_za_sql.push(
              env.DB.prepare(`
                INSERT INTO bids (bei, kiasi, dola, exchange) 
                VALUES (?, ?, ?, ?)
                ON CONFLICT(bei, exchange) DO UPDATE SET
                  kiasi = excluded.kiasi,
                  dola = excluded.dola,
                  muda_kusasishwa = CURRENT_TIMESTAMP
              `).bind(bid.bei, bid.kiasi, bid.dola, bid.exchange)
            );
          }
        }
      }

      // 2. CHAKATA ASKS (SELL ORDERS)
      if (asks && asks.length > 0) {
        for (const ask of asks) {
          // Kama kiasi kimekuwa 0, maana yake oda imefutwa (Canceled/Filled) kwenye Binance
          if (ask.kiasi === 0 && ask.exchange === "Binance") {
            oparesheni_za_sql.push(
              env.DB.prepare("DELETE FROM asks WHERE bei = ? AND exchange = ?")
                    .bind(ask.bei, "Binance")
            );
          } else if (ask.kiasi > 0) {
            // Kama ipo: Sasisha kiasi na dola tu, muda wa kuingizwa ubaki ule ule.
            // Kama haipo: Ingiza kama oda mpya.
            oparesheni_za_sql.push(
              env.DB.prepare(`
                INSERT INTO asks (bei, kiasi, dola, exchange) 
                VALUES (?, ?, ?, ?)
                ON CONFLICT(bei, exchange) DO UPDATE SET
                  kiasi = excluded.kiasi,
                  dola = excluded.dola,
                  muda_kusasishwa = CURRENT_TIMESTAMP
              `).bind(ask.bei, ask.kiasi, ask.dola, ask.exchange)
            );
          }
        }
      }

      // Run SQL zote kwa mpigo mmoja (Batch execution) ili kuokoa muda na spidi ya worker
      if (oparesheni_za_sql.length > 0) {
        await env.DB.batch(oparesheni_za_sql);
      }

      return new Response(JSON.stringify({ status: "success", ujumbe: "Data imechakatwa kikamilifu" }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });

    } catch (error) {
      return new Response(JSON.stringify({ status: "error", kosa: error.message }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }
  },
};