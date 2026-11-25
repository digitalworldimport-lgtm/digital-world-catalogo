import "../../products.js";
const base="https://digital-world-catalogo.pages.dev/";
const columns=["id","title","description","availability","condition","price","link","image_link","sale_price","additional_image_link"];
const csv=v=>'"'+String(v??"").replace(/"/g,'""')+'"';
export function buildFeed(products,rows){
 const byId=new Map(rows.map(r=>[r.product_id,r]));
 const money=n=>(n/100).toFixed(2)+" USD";
 const valid=n=>Number.isSafeInteger(n)&&n>0;
 const lines=[columns];
 for(const p of products){
  const r=byId.get(p.id);
  if(p.collection||!r||r.active!==1||!valid(r.regular_cents)||!p.image)continue;
  const promo=r.promo_active===1&&valid(r.promo_cents)&&r.promo_cents<r.regular_cents;
  lines.push([p.id,p.name,p.name+" — "+p.category,"in stock","new",money(r.regular_cents),base,new URL(p.image,base).href,promo?money(r.promo_cents):"",(p.images||[]).filter(x=>x!==p.image).slice(0,10).map(x=>new URL(x,base).href).join(",")]);
 }
 return lines.map(line=>line.map(csv).join(",")).join("\r\n")+"\r\n";
}
export async function onRequestGet({env}){
 try{
 const {results}=await env.CATALOG_DB.prepare("SELECT product_id, regular_cents, promo_cents, promo_active, active FROM catalog_prices").all();
 return new Response(buildFeed(globalThis.DW_CATALOG_METADATA.products,results),{headers:{"Content-Type":"text/csv; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
 }catch{return new Response("Feed unavailable",{status:503});}
}
