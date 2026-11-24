export async function onRequestGet({env}) {
 const headers={"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"};
 try {
  const {results}=await env.CATALOG_DB.prepare("SELECT product_id, regular_cents, promo_cents, promo_active, active FROM catalog_prices ORDER BY product_id").all();
  return new Response(JSON.stringify({products:results}),{headers});
 } catch {
  return new Response(JSON.stringify({error:"Catálogo temporalmente no disponible"}),{status:503,headers});
 }
}
