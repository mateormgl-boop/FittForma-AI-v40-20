import http from 'node:http';
import { isIP } from 'node:net';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
// Detect the web root defensively. This works both when files are at repo root
// and when a ZIP was accidentally uploaded with its forma-prototipo folder intact.
const rootCandidates=[
  path.resolve(here,'..'),
  process.cwd(),
  path.resolve(process.cwd(),'forma-prototipo'),
  path.resolve(here,'..','forma-prototipo'),
  path.resolve(process.cwd(),'public')
].filter((candidate,index,items)=>items.indexOf(candidate)===index);
const root=rootCandidates.find(candidate=>existsSync(path.join(candidate,'index.html')))||path.resolve(here,'..');
const rawPort=String(process.env.PORT||'8787');
const port=Number(rawPort);
if(!Number.isInteger(port)||port<0||port>65535)throw new Error(`PORT debe ser un entero entre 0 y 65535; se recibió ${JSON.stringify(rawPort)}.`);
const appVersion='0.40.21';
const apiKey=String(process.env.GEMINI_API_KEY||'').trim(), model=String(process.env.GEMINI_MODEL||'gemini-3.8-flash').trim()||'gemini-3.8-flash';
const trustRenderClientIp=String(process.env.TRUST_RENDER_CLIENT_IP||'').toLowerCase()==='true';
// If the primary model temporarily returns 503, try a lighter official model automatically.
// Override the comma-separated fallback list in Render with GEMINI_FALLBACK_MODELS if needed.
const fallbackModels=(process.env.GEMINI_FALLBACK_MODELS||'gemini-3.5-flash-lite').split(',').map(s=>s.trim()).filter(Boolean).filter((s,i,a)=>s!==model&&a.indexOf(s)===i);
const modelCandidates=[model,...fallbackModels];
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const transientStatus=status=>status===408||status===500||status===502||status===503||status===504;
async function askGemini({system, user, history=[], imageDataUrl=null, maxTokens=900}){
  const contents=[];
  // Gemini conversation history is rebuilt from a small, sanitized window; nothing is stored server-side.
  for(const item of history){
    const role=item.role==='assistant'?'model':'user';
    const text=String(item.text||'').trim().slice(0,500);
    if(text) contents.push({role,parts:[{text}]});
  }
  const parts=[{text:user}];
  if(imageDataUrl){const m=imageDataUrl.match(/^data:image\/(jpeg|png|webp);base64,(.+)$/);if(!m)throw new Error('invalid_image');parts.push({inlineData:{mimeType:`image/${m[1]}`,data:m[2]}});}
  contents.push({role:'user',parts});
  let lastError=null;
  for(let modelIndex=0;modelIndex<modelCandidates.length;modelIndex++){
    const currentModel=modelCandidates[modelIndex];
    const attempts=modelIndex===0?2:1; // retry the selected model once, then use the lighter fallback
    for(let attempt=0;attempt<attempts;attempt++){
      const generationConfig={maxOutputTokens:maxTokens,responseMimeType:'application/json'};
      // Gemini 3.6/3.8 aceptan thinkingLevel. En las familias Gemini 3/4 no enviar
      // parámetros legacy de sampling como temperature; los modelos anteriores sí pueden usarlo.
      if(/^gemini-3\.(6|8)-/.test(currentModel)) generationConfig.thinkingConfig={thinkingLevel:'low'};
      else if(!/^gemini-[34](?:[.-])/.test(currentModel)) generationConfig.temperature=0.3;
      const geminiUrl=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(currentModel)}:generateContent`;
      let response;
      try{response=await fetch(geminiUrl,{method:'POST',signal:AbortSignal.timeout(30000),headers:{'x-goog-api-key':apiKey,'Content-Type':'application/json'},body:JSON.stringify({systemInstruction:{parts:[{text:system}]},contents,generationConfig})});}
      catch(fetchError){
        const e=new Error(fetchError?.name==='TimeoutError'?'gemini_timeout':'gemini_connection');e.status=504;e.details=String(fetchError?.message||'network error');lastError=e;
        console.error(`[Gemini] Error de conexión con ${currentModel}:`,e.details);
        if(attempt<attempts-1){await wait(700);continue;}
        if(modelIndex<modelCandidates.length-1){console.warn(`[Gemini] Se probará el modelo alternativo ${modelCandidates[modelIndex+1]}.`);break;}
        throw e;
      }
      if(!response.ok){
        const details=(await response.text()).slice(0,1600);
        const e=new Error('gemini_upstream');e.status=response.status;e.details=details;lastError=e;
        console.error(`[Gemini] Modelo ${currentModel} respondió HTTP ${response.status}: ${details.slice(0,500)}`);
        // A 429 is a quota/rate-limit response; do not rotate through models to evade a quota.
        if(response.status===429) throw e;
        if(transientStatus(response.status)&&attempt<attempts-1){await wait(700+Math.floor(Math.random()*400));continue;}
        if(transientStatus(response.status)&&modelIndex<modelCandidates.length-1){console.warn(`[Gemini] ${currentModel} no está disponible temporalmente; se probará ${modelCandidates[modelIndex+1]}.`);break;}
        throw e;
      }
      let payload;
      try{payload=await response.json();}catch{const e=new Error('invalid_upstream_json');e.status=502;lastError=e;throw e;}
      const text=payload.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('');
      if(!text){console.error(`[Gemini] ${currentModel} respondió sin texto. finishReason:`,payload.candidates?.[0]?.finishReason||'desconocido');throw new Error('empty_response');}
      try{return JSON.parse(text);}catch(parseError){
        // Some model responses may wrap JSON in Markdown despite JSON mode; safely try the enclosed object.
        const first=text.indexOf('{'),last=text.lastIndexOf('}');
        if(first>=0&&last>first){try{return JSON.parse(text.slice(first,last+1));}catch{}}
        console.error(`[Gemini] ${currentModel} respondió, pero el formato no era JSON válido.`);
        throw new Error('invalid_model_json');
      }
    }
  }
  throw lastError||new Error('gemini_upstream');
}
function sanitizeHistory(items){
  if(!Array.isArray(items)) return [];
  const cleaned=items.slice(-10).map(item=>({role:item?.role==='assistant'?'assistant':'user',text:typeof item?.text==='string'?item.text.trim().slice(0,500):''})).filter(item=>item.text);
  // A history window should begin on a user turn and alternate roles, as expected by Gemini chat contents.
  while(cleaned.length && cleaned[0].role==='assistant') cleaned.shift();
  const alternating=[];
  for(const item of cleaned){
    if(alternating.length && alternating[alternating.length-1].role===item.role){
      alternating[alternating.length-1].text=(alternating[alternating.length-1].text+'\n'+item.text).slice(-700);
    }else alternating.push({...item});
  }
  return alternating.slice(-8);
}
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.ico':'image/x-icon'};
const limits=new Map();
const MAX_TRACKED_CLIENTS=5000;
const PUBLIC_ROOT_FILES=new Set([
  '/index.html','/i18n.js','/community.js','/ads-config.js','/ads.js','/membership-config.js',
  '/manifest.json','/icon.svg','/icon-180.png','/icon-192.png','/icon-512.png',
  '/supabase-config.js','/achievements.js','/sw.js'
]);
const CSP=[
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com",
  "style-src 'self' 'unsafe-inline' https://unpkg.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https:",
  "connect-src 'self' https://generativelanguage.googleapis.com https://world.openfoodfacts.org https://*.supabase.co wss://*.supabase.co",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "frame-src 'none'"
].join('; ');
function applySecurityHeaders(req,res){
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy','camera=(self), geolocation=(self), microphone=()');
  res.setHeader('Cross-Origin-Resource-Policy','same-origin');
  res.setHeader('Cross-Origin-Opener-Policy','same-origin');
  res.setHeader('X-DNS-Prefetch-Control','off');
  res.setHeader('X-Permitted-Cross-Domain-Policies','none');
  res.setHeader('Content-Security-Policy',CSP);
  if(req.socket.encrypted||String(req.headers['x-forwarded-proto']||'').split(',')[0].trim()==='https'){
    res.setHeader('Strict-Transport-Security','max-age=15552000');
  }
}
function send(req,res,status,data,type='application/json; charset=utf-8'){
  applySecurityHeaders(req,res);
  res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store'});
  res.end(req.method==='HEAD'?undefined:(type.startsWith('application/json')?JSON.stringify(data):data));
}
function rateLimitClientKey(req){
  // Trust edge-provided client IPs only when explicitly enabled for the Render deployment.
  // Render exposes CF-Ray and the client address through CF-Connecting-IP / X-Forwarded-For.
  // Local and other deployments default to the socket address to avoid trusting spoofable headers.
  if(trustRenderClientIp&&req.headers['cf-ray']){
    const cloudflareIp=String(req.headers['cf-connecting-ip']||'').trim();
    if(isIP(cloudflareIp))return `ip:${cloudflareIp}`;
    const forwarded=String(req.headers['x-forwarded-for']||'').split(',')[0].trim();
    if(isIP(forwarded))return `ip:${forwarded}`;
  }
  return `socket:${req.socket.remoteAddress||'unknown'}`;
}
function rateLimited(req){
  const key=rateLimitClientKey(req),now=Date.now();
  if(limits.size>1000){for(const [ip,item] of limits){if(now-item.start>120000)limits.delete(ip);}}
  let old=limits.get(key);
  if(!old||now-old.start>60000){
    if(limits.size>=MAX_TRACKED_CLIENTS){const oldest=limits.keys().next().value;if(oldest!==undefined)limits.delete(oldest);}
    limits.set(key,{start:now,count:1});return false;
  }
  old.count++;
  return old.count>12;
}
function isJsonObject(value){return value!==null&&typeof value==='object'&&!Array.isArray(value);}

function validSupabasePublicConfig(rawUrl, rawKey){
  const url=String(rawUrl||'').trim();
  const key=String(rawKey||'').trim();
  let parsed;
  try{parsed=new URL(url);}catch{return null;}
  if(parsed.protocol!=='https:'||!/^[a-z0-9-]+\.supabase\.co$/i.test(parsed.hostname)||parsed.username||parsed.password||parsed.search||parsed.hash||(parsed.pathname!==''&&parsed.pathname!=='/'))return null;
  // Publishable keys are designed for browser use. Legacy anon JWTs are accepted only
  // when their role claim is exactly `anon`; service_role/secret keys are never returned.
  if(!key||/PEGAR_|TU-PROYECTO|service_role|sb_secret_/i.test(key))return null;
  let publicKey=false;
  if(/^sb_publishable_[A-Za-z0-9_-]{20,}$/.test(key))publicKey=true;
  else if(key.startsWith('eyJ')){
    const parts=key.split('.');
    if(parts.length===3){try{const payload=JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'));publicKey=payload?.role==='anon';}catch{publicKey=false;}}
  }
  if(!publicKey)return null;
  return {url:parsed.origin,anonKey:key};
}
function isPublicAssetPath(requested){
  if(PUBLIC_ROOT_FILES.has(requested))return true;
  if(!requested.startsWith('/assets/'))return false;
  const relative=requested.slice('/assets/'.length);
  if(relative.startsWith('exercises/unverified-generated/'))return false;
  if(!relative||relative.split('/').some(part=>!part||part==='.'||part==='..'||part.startsWith('.')))return false;
  return ['.svg','.webp','.png','.jpg','.jpeg','.ico'].includes(path.posix.extname(relative).toLowerCase());
}
async function readBody(req,maxBytes=12000){
  const declared=Number(req.headers['content-length']);
  if(Number.isFinite(declared)&&declared>maxBytes)throw new Error('too_large');
  const chunks=[];let total=0;
  for await(const chunk of req){
    const buffer=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);
    total+=buffer.length;
    if(total>maxBytes)throw new Error('too_large');
    chunks.push(buffer);
  }
  try{return JSON.parse(Buffer.concat(chunks,total).toString('utf8')||'{}');}
  catch{throw new Error('invalid_json');}
}
const prompt=`Sos el entrenador de FittForma AI. Respondé en el idioma seleccionado por la persona, con un estilo claro, cercano y práctico. Usá el perfil, equipamiento, plan, objetivos nutricionales y el resumen reciente de entrenamientos/actividades/peso cuando estén disponibles. Personalizá cada respuesta con esos datos concretos; no inventes registros ausentes. Si el historial muestra constancia, reconocela brevemente; si muestra pausas, poca actividad o cargas/repeticiones estancadas, proponé un paso pequeño y realista, sin culpabilizar. Diferenciá los datos registrados de las inferencias. Adaptá recomendaciones a nivel y tiempo. Para fuerza, sugerí técnica controlada, calentamiento y progresión gradual; no prescribas cargas máximas ni diagnostiques. No sugieras aumentar carga si no hay registros suficientes o si la técnica/dolor es una preocupación. Ante dolor, lesión, mareo o síntomas preocupantes, no recomiendes entrenar a través del síntoma y sugerí orientación profesional. No inventes exactitud nutricional ni prometas resultados físicos. Nunca cambies datos: solo proponé cambios para que la persona los apruebe. Las propuestas deben ser concretas y explicar qué cambiaría y por qué. Devolvé ÚNICAMENTE JSON válido: {"reply":"respuesta útil","proposal":null o {"title":"...","description":"...","kind":"routine|nutrition|recovery|general","days":2|3|4|5 opcional,"duration":20|30|45|60 opcional}}. Solo incluí days/duration si el usuario los pide o si son necesarios para una propuesta de rutina. Si no pide ningún cambio concreto, proposal=null.`;
function sanitizeProposal(x){if(!x||typeof x!=='object')return null;const kinds=['routine','nutrition','recovery','general'],days=Number(x.days),duration=Number(x.duration);return {title:String(x.title||'Propuesta del entrenador').slice(0,100),description:String(x.description||'Revisá esta propuesta antes de aplicarla.').slice(0,1200),kind:kinds.includes(x.kind)?x.kind:'general',...( [2,3,4,5].includes(days)?{days}:{} ),...( [20,30,45,60].includes(duration)?{duration}:{} )};}
function cleanText(value,max=100){return typeof value==='string'?value.replace(/[<>]/g,'').trim().slice(0,max):'';}
function sanitizeTrainingContext(body){
  const sessions=Array.isArray(body.sessions)?body.sessions.slice(0,5).map(s=>({date:cleanText(s?.date,10),title:cleanText(s?.title,80),minutes:Math.max(0,Math.min(600,Number(s?.minutes)||0)),notes:cleanText(s?.notes,180),exercises:Array.isArray(s?.exercises)?s.exercises.slice(0,8).map(e=>({name:cleanText(e?.name,70),entries:Array.isArray(e?.entries)?e.entries.slice(0,6).map(x=>({reps:cleanText(String(x?.reps??''),8),weight:cleanText(String(x?.weight??''),10),done:Boolean(x?.done)})):[]})):[]})):[];
  const activities=Array.isArray(body.activities)?body.activities.slice(0,5).map(a=>({date:cleanText(a?.date,10),type:cleanText(a?.type,30),distance:Math.max(0,Math.min(1000,Number(a?.distance)||0)),minutes:Math.max(0,Math.min(1440,Number(a?.minutes)||0)),pace:cleanText(a?.pace,20)})):[];
  const weights=Array.isArray(body.weights)?body.weights.slice(0,5).map(w=>({date:cleanText(w?.date,10),kg:Math.max(0,Math.min(350,Number(w?.kg??w?.weight)||0))})).filter(w=>w.kg>0):[];
  return {recentSessions:sessions,recentActivities:activities,recentWeights:weights};
}
const server=http.createServer(async(req,res)=>{try{
  const url=new URL(req.url,'http://localhost');
  // Reject browser POSTs from a different origin; requests without Origin (e.g. local health tooling) remain possible.
  if(req.method==='POST'&&req.headers.origin){try{if(new URL(req.headers.origin).host!==String(req.headers.host||''))return send(req,res,403,{error:'Origen no permitido.'});}catch{return send(req,res,403,{error:'Origen no válido.'});}}
  if(!['GET','POST','HEAD'].includes(req.method))return send(req,res,405,{error:'Método no permitido.'});
  if(req.method==='POST'&&String(req.headers['content-type']||'').split(';')[0].trim().toLowerCase()!=='application/json')return send(req,res,415,{error:'El servidor espera JSON.'});
  if(req.method==='GET'&&url.pathname==='/api/public-config'){
    const projectUrl=String(process.env.SUPABASE_URL||'').trim();
    const anonKey=String(process.env.SUPABASE_ANON_KEY||'').trim();
    const publishableKey=String(process.env.SUPABASE_PUBLISHABLE_KEY||'').trim();
    const config=validSupabasePublicConfig(projectUrl,anonKey)||validSupabasePublicConfig(projectUrl,publishableKey);
    // Only public project URL + publishable/anon key may be sent to the browser.
    // Never expose Gemini, service_role, secret keys or arbitrary environment variables.
    const missing=config?[]:[...(projectUrl?[]:['SUPABASE_URL']), 'SUPABASE_ANON_KEY o SUPABASE_PUBLISHABLE_KEY (clave pública publishable/anon; no usar service_role)'];
    let validUrl=false;try{const u=new URL(projectUrl);validUrl=u.protocol==='https:'&&/^[a-z0-9-]+\.supabase\.co$/i.test(u.hostname)&&!u.username&&!u.password&&!u.search&&!u.hash&&(u.pathname===''||u.pathname==='/');}catch{}
    const issue=config?null:(!projectUrl?'missing_project_url':(!validUrl?'invalid_project_url':(!anonKey&&!publishableKey?'missing_public_key':'invalid_public_key')));
    const keyType=config?(String(config.anonKey).startsWith('sb_publishable_')?'publishable':'legacy_anon'):null;
    return send(req,res,200,{version:appVersion,supabase:config?{configured:true,...config,keyType}:{configured:false,url:null,anonKey:null,keyType:null},missing,issue});
  }
  if(req.method==='GET'&&url.pathname==='/api/status')return send(req,res,200,{service:'FittForma AI Coach',version:appVersion,provider:'Gemini',configured:Boolean(apiKey),model:apiKey?model:null,fallbackModels:apiKey?fallbackModels:[],mode:apiKey?'ai':'demo',supabaseConfigured:Boolean(validSupabasePublicConfig(process.env.SUPABASE_URL,process.env.SUPABASE_ANON_KEY)||validSupabasePublicConfig(process.env.SUPABASE_URL,process.env.SUPABASE_PUBLISHABLE_KEY)),frontendAvailable:existsSync(path.join(root,'index.html'))});
  if(req.method==='GET'&&url.pathname==='/healthz')return send(req,res,200,{ok:true,service:'fittforma-ai',version:appVersion});
  if(req.method==='POST'&&url.pathname==='/api/meal-photo'){
    if(rateLimited(req)){res.setHeader('Retry-After','60');return send(req,res,429,{error:'Demasiadas solicitudes. Esperá un minuto.'});}
    let body;try{body=await readBody(req,4_000_000);}catch(e){return send(req,res,e.message==='too_large'?413:400,{error:e.message==='too_large'?'La imagen es demasiado grande. Elegí una foto más liviana.':'Solicitud de imagen inválida.'});}
    if(!isJsonObject(body))return send(req,res,400,{error:'La solicitud de imagen debe ser un objeto JSON.'});
    if(!apiKey)return send(req,res,503,{error:'La estimación por foto necesita configurar GEMINI_API_KEY en el servidor.'});
    if(typeof body.image!=='string'||body.image.length>3_600_000||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(body.image))return send(req,res,400,{error:'La imagen debe ser JPG, PNG o WebP y pesar menos de aproximadamente 2,5 MB después de comprimir.'});
    const localeNames={es:'español',en:'English',pt:'portugués',fr:'francés',it:'italiano',de:'alemán'};
    const responseLanguage=localeNames[['es','en','pt','fr','it','de'].includes(body.language)?body.language:'es'];
    const photoPrompt=`Analizá esta foto de una comida para una app de registro nutricional. Estimá el plato visible, ingredientes probables, porción comestible, calorías totales, gramos de proteína, carbohidratos y grasas totales. Los campos textuales name y notes deben estar en ${responseLanguage}. No afirmes precisión: si no se puede inferir una porción, elegí una estimación prudente y explicá la incertidumbre. No des consejos médicos. Devolvé únicamente JSON válido con este formato: {"name":"nombre breve del plato y porción estimada","calories":número entero,"protein":número decimal,"carbs":número decimal,"fat":número decimal,"notes":"una frase corta con incertidumbres y factores como aceite/salsas"}. Los números deben ser finitos y no negativos.`;
    let result;try{result=await askGemini({system:photoPrompt,user:`Estimá los valores de la comida de esta imagen. No guardes nada; solo devolvé una estimación. Idioma de salida: ${responseLanguage}.`,imageDataUrl:body.image,maxTokens:450});}catch(e){console.error('[Gemini meal-photo] Falló la solicitud:',e.status||'',e.message||'error',e.details||'');if(e.message==='invalid_image')return send(req,res,400,{error:'Formato de imagen inválido.'});return send(req,res,e.status===429?429:502,{error:e.status===429?'Gemini alcanzó su límite gratuito o de solicitudes. Probá más tarde.':'Gemini no pudo analizar la foto. Revisá los Logs de Render para conocer la causa.'});}
    const calories=Number(result.calories),protein=Number(result.protein),carbs=Number(result.carbs),fat=Number(result.fat);if(typeof result.name!=='string'||!Number.isFinite(calories)||!Number.isFinite(protein)||calories<0||calories>5000||protein<0||protein>300||!Number.isFinite(carbs)||carbs<0||carbs>1000||!Number.isFinite(fat)||fat<0||fat>500)return send(req,res,502,{error:'La estimación de la IA no pasó la validación. Probá otra foto o cargá los datos manualmente.'});
    return send(req,res,200,{name:result.name.slice(0,80),calories:Math.round(calories),protein:Number(protein.toFixed(1)),carbs:Number(carbs.toFixed(1)),fat:Number(fat.toFixed(1)),notes:typeof result.notes==='string'?result.notes.slice(0,350):'Valores aproximados; pueden variar según porción e ingredientes.'});
  }
  if(req.method==='POST'&&url.pathname==='/api/coach'){
    if(rateLimited(req)){res.setHeader('Retry-After','60');return send(req,res,429,{error:'Demasiadas solicitudes. Esperá un minuto.'});}
    let body;try{body=await readBody(req);}catch(e){return send(req,res,e.message==='too_large'?413:400,{error:e.message==='too_large'?'Solicitud demasiado grande.':'JSON inválido.'});}
    if(!isJsonObject(body))return send(req,res,400,{error:'La solicitud debe ser un objeto JSON.'});
    if(typeof body.message!=='string'||!body.message.trim()||body.message.length>500)return send(req,res,400,{error:'El mensaje debe tener entre 1 y 500 caracteres.'});
    if(!apiKey)return send(req,res,503,{error:'Falta configurar GEMINI_API_KEY en el servidor.'});
    const training=sanitizeTrainingContext(body);
    const context={profile:body.profile&&typeof body.profile==='object'?body.profile:{},goals:body.goals&&typeof body.goals==='object'?body.goals:{},plan:body.plan&&typeof body.plan==='object'?body.plan:null,...training,availableEquipment:body.profile?.equipment||'gym',note:'La rutina se genera desde una biblioteca local curada; proponé cambios realistas y respetá el equipamiento indicado. El historial recibido es solo contexto enviado por el usuario; no lo guardes ni asumas que está completo.'};
    const history=sanitizeHistory(body.history);
    const localeNames={es:'español rioplatense/uruguayo',en:'English',pt:'portugués',fr:'francés',it:'italiano',de:'alemán'};
    const responseLanguage=localeNames[['es','en','pt','fr','it','de'].includes(body.language)?body.language:'es'];
    const languagePrompt=prompt+`\nIDIOMA OBLIGATORIO DE RESPUESTA: ${responseLanguage}. Escribí reply, title y description de cualquier propuesta exclusivamente en ese idioma. No cambies de idioma salvo que la persona lo solicite expresamente.`;
    let result;try{result=await askGemini({system:languagePrompt,history,user:`Contexto actual del usuario: ${JSON.stringify(context).slice(0,6000)}\nMensaje actual: ${body.message}`,maxTokens:900});}catch(e){
      console.error('[Gemini coach] Falló la solicitud:',e.status||'',e.message||'error',e.details||'');
      if(e.status===429)return send(req,res,429,{error:'Google informó que se alcanzó un límite de uso de Gemini. Esperá y probá más tarde; el nivel gratuito tiene cuotas.'});
      if(e.status===401||e.status===403)return send(req,res,502,{error:'Google rechazó la clave o el acceso al proyecto. Revisá GEMINI_API_KEY en Render y que la clave pertenezca a Google AI Studio y tenga acceso a Gemini API.'});
      if(e.status===404)return send(req,res,502,{error:`Google no encuentra el modelo configurado o sus alternativas (${model}). Revisá GEMINI_MODEL en Render.`});
      if(e.status===400)return send(req,res,502,{error:'Google rechazó el formato de la solicitud. La causa detallada quedó en Render → Logs.'});
      if(e.message==='invalid_model_json'||e.message==='empty_response')return send(req,res,502,{error:'Gemini respondió, pero FittForma no pudo interpretar la respuesta. Probá otra vez; la causa está en Render → Logs.'});
      if(e.status===503||e.status===504||e.status===500||e.status===502)return send(req,res,502,{error:'Gemini sigue temporalmente sin disponibilidad incluso tras reintentar y probar un modelo alternativo. Esperá un poco y probá de nuevo; revisá Render → Logs si persiste.'});
      return send(req,res,502,{error:'Gemini falló por un error de API o conexión. Abrí Render → Logs y buscá [Gemini coach] para ver el código real.'});
    }
    return send(req,res,200,{reply:typeof result.reply==='string'?result.reply.slice(0,1800):'Contame un poco más para ayudarte.',proposal:sanitizeProposal(result.proposal)});
  }
  if(['GET','HEAD'].includes(req.method)&&(url.pathname==='/'||!url.pathname.startsWith('/api/'))){
    let decodedPath;
    try{decodedPath=decodeURIComponent(url.pathname);}catch{return send(req,res,400,{error:'Ruta inválida.'});}
    if(decodedPath.includes('\\')||decodedPath.includes('\0'))return send(req,res,404,{error:'No encontrado.'});
    const rawSegments=decodedPath.split('/');
    if(rawSegments.some(part=>part==='.'||part==='..'||(part.startsWith('.')&&part!=='')))return send(req,res,404,{error:'No encontrado.'});
    const requested=decodedPath==='/'?'/index.html':decodedPath;
    if(!isPublicAssetPath(requested))return send(req,res,404,{error:'No encontrado.'});
    const file=path.resolve(root,'.'+requested);
    if(!file.startsWith(root+path.sep))return send(req,res,404,{error:'No encontrado.'});
    try{
      const data=await readFile(file),ext=path.extname(file);
      applySecurityHeaders(req,res);
      const cacheControl=['.html','.js','.mjs','.json','.webmanifest'].includes(ext)?'no-cache':'public, max-age=3600';
      res.writeHead(200,{'Content-Type':mime[ext]||'application/octet-stream','Cache-Control':cacheControl});
      if(req.method==='HEAD')return res.end();
      return res.end(data);
    }catch{return send(req,res,404,{error:'No encontrado. Revisá que el archivo exista en el repositorio conectado a este servicio.'});}
  }
  return send(req,res,404,{error:'No encontrado.'});
}catch(err){if(err?.name==='TimeoutError'||err?.name==='AbortError')return send(req,res,504,{error:'La IA tardó demasiado en responder. Probá de nuevo.'});return send(req,res,500,{error:'Error interno.'});}});
server.requestTimeout=30_000;
server.headersTimeout=15_000;
server.keepAliveTimeout=5_000;
server.maxHeadersCount=100;
server.listen(port,'0.0.0.0',()=>console.log(`FittForma AI disponible en http://0.0.0.0:${port}`));
