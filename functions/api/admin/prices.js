const headers={"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"};
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
async function authorized(request,env){
 if(typeof env.CATALOG_ADMIN_TOKEN!=="string"||env.CATALOG_ADMIN_TOKEN.length<32)return false;
 const value=request.headers.get("Authorization")||"";
 const expected="Bearer "+env.CATALOG_ADMIN_TOKEN;
 const enc=new TextEncoder();
 const a=await crypto.subtle.digest("SHA-256",enc.encode(value)),b=await crypto.subtle.digest("SHA-256",enc.encode(expected));
 const x=new Uint8Array(a),y=new Uint8Array(b);let diff=0;for(let i=0;i<x.length;i++)diff|=x[i]^y[i];return diff===0;
}
export async function onRequestGet({request,env}){
 if(!await authorized(request,env))return reply({error:"Acceso no autorizado"},401);
 try{const {results}=await env.CATALOG_DB.prepare("SELECT product_id, regular_cents, promo_cents, wholesale_cents, wholesale_min_qty, promo_active, active, updated_at FROM catalog_prices ORDER BY product_id").all();return reply({products:results})}catch{return reply({error:"Servicio no disponible"},503)}
}
export async function onRequestPut({request,env}){
 if(!await authorized(request,env))return reply({error:"Acceso no autorizado"},401);
 if(!request.headers.get("Content-Type")?.startsWith("application/json"))return reply({error:"Formato inválido"},415);
 try{
 const raw=await request.text();if(raw.length>4096)return reply({error:"Solicitud demasiado grande"},413);
 const p=JSON.parse(raw);const cents=v=>v===null||(Number.isSafeInteger(v)&&v>=0&&v<=100000000);
 if(!p||typeof p.product_id!=="string"||!/^DW-(SON|JUG|REB|REA)-[0-9]{3,6}$/.test(p.product_id)||![p.regular_cents,p.promo_cents,p.wholesale_cents].every(cents)||!(p.wholesale_min_qty===null||(Number.isSafeInteger(p.wholesale_min_qty)&&p.wholesale_min_qty>=1&&p.wholesale_min_qty<=100000))||![0,1].includes(p.active)||![0,1].includes(p.promo_active)|| (p.promo_active===1&&(p.regular_cents===null||p.promo_cents===null||p.promo_cents>=p.regular_cents)))return reply({error:"Datos inválidos"},400);
 const r=await env.CATALOG_DB.prepare("UPDATE catalog_prices SET regular_cents=?,promo_cents=?,wholesale_cents=?,wholesale_min_qty=?,promo_active=?,active=?,updated_at=CURRENT_TIMESTAMP WHERE product_id=?").bind(p.regular_cents,p.promo_cents,p.wholesale_cents,p.wholesale_min_qty,p.promo_active,p.active,p.product_id).run();
 return r.meta.changes===1?reply({ok:true}):reply({error:"Producto no encontrado"},404);
 }catch{return reply({error:"No se pudo guardar"},400)}
}
