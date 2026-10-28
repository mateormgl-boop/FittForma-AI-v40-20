/* FittForma AI v53 — comunidad de deportistas: Todos (directorio), Ranking, Amigos, perfil completo, comparación,
 * publicaciones dentro del perfil (sin feed general), mensajes, privacidad, bloqueos y moderación.
 * Requiere supabase/community.sql y las migraciones (v53: estadísticas deportivas, rankings y comparación).
 * Todo lo que se muestra sale de la base (RLS): no hay seguidores, publicaciones ni mensajes simulados. */
(()=>{
  'use strict';
  const $=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let client=null,user=null,searchTerm='',loading=false,connectionMessage='',currentSubView='world',ownTab='posts',ownProfile=null,chatPoll=null,lastTab='world';
  // null = sin comprobar; false = el proyecto todavía no aplicó la migración v41 (solo transformaciones).
  const SCHEMA_KEY='fittforma-community-schema-v41';
  let schemaV41=(()=>{try{return sessionStorage.getItem(SCHEMA_KEY)==='0'?false:null;}catch{return null;}})(),ownVisibility='private',postKind='text';
  // v49: columnas y funciones nuevas (guardadas, destacadas, entrenamiento vinculado). false = migración v49 sin aplicar.
  let schemaV49=null,savedEnabled=true;
  const markLegacySchema=()=>{schemaV41=false;try{sessionStorage.setItem(SCHEMA_KEY,'0');}catch{}};
  const V41_COLS=',post_kind,image_path,achievement,updated_at';
  const MIGRATION_HINT='Para publicar texto o logros, aplicá en Supabase supabase/migrations/2026-10-17_v41_posts_achievements_unread.sql.';
  const isMissingColumn=error=>String(error?.code||'')==='42703'||/column .* does not exist|could not find the .* column/i.test(String(error?.message||''));
  const isMissingFunction=error=>/PGRST202|42883/.test(String(error?.code||''))||/could not find the function|function .* does not exist/i.test(String(error?.message||''));
  const messageAttempts=[];
  const bucket='community-media';
  const localDateKey=(date=new Date())=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const setStatus=(id,msg)=>{const el=$(id);if(el)el.textContent=msg;};
  const initials=name=>String(name||'FF').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase()||'FF';
  const dateLabel=value=>{if(!value)return '';const d=new Date(value+'T12:00:00');return Number.isNaN(d.getTime())?value:d.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'});};
  // Antigüedad corta («hace 3 h»); después de una semana, la fecha.
  function timeAgo(iso){const t=Date.parse(iso||'');if(!Number.isFinite(t))return '';const m=Math.max(0,Math.round((Date.now()-t)/60000));if(m<1)return 'ahora';if(m<60)return `hace ${m} min`;const h=Math.round(m/60);if(h<24)return `hace ${h} h`;const d=Math.round(h/24);if(d<7)return `hace ${d} d`;return dateLabel(String(iso).slice(0,10));}
  function status(message){const target={world:'communityWorldStatus',ranking:'rankingStatus',friends:'communityFriendsStatus',user:'communityWorldStatus',compare:'communityWorldStatus'}[currentSubView]||(currentSubView==='publish'?'communityComposeStatus':currentSubView==='messages'?'communityChatStatus':currentSubView==='profile'?'communityProfileStatus':'communityWorldStatus');setStatus(target,message);}
  // Si la conexión está bien, el aviso se oculta (queda el texto para lectores de pantalla); si hay un problema, se muestra con el botón para comprobar.
  function connectionStatus(message){const el=$('communityConnectionStatus');if(!el)return;el.removeAttribute('data-state');setStatus('communityConnectionStatus',message);const ok=/correctamente|Conexión correcta/.test(String(message));el.closest('.community-connection-row')?.classList.toggle('is-ok',ok);}
  // Sin configuración: mensaje claro para quien usa la app y el detalle técnico plegado para quien la administra.
  function configIssueStatus(detail){const el=$('communityConnectionStatus');if(!el)return;el.closest('.community-connection-row')?.classList.remove('is-ok');el.dataset.state='warn';el.textContent='';const p=document.createElement('span');p.textContent='La comunidad en línea no está disponible ahora. El resto de la app funciona normal y tus datos siguen en este dispositivo.';el.append(p);if(detail){const d=document.createElement('details'),s=document.createElement('summary'),t=document.createElement('p');s.textContent='Detalle técnico';t.textContent=detail;d.append(s,t);el.append(d);console.warn('Comunidad:',detail);}}
  function authReady(){return !!client&&!!user;}
  function authHint(){return client?'Iniciá sesión desde Perfil para publicar, comentar o seguir personas.':(connectionMessage?'La comunidad en línea no está disponible ahora. El detalle está en el aviso de conexión de arriba.':'No se conectó Supabase. Tocá “Comprobar conexión” para revisar la configuración.');}
  function friendlySupabaseError(error,context='la comunidad'){const code=String(error?.code||''),message=String(error?.message||'Error desconocido');if(code==='PGRST201'||/more than one relationship was found/i.test(message))return `Supabase encontró más de una relación posible al ${context}. Esta versión identifica la clave foránea explícita; si el error continúa, revisá el nombre de la relación en los detalles. Detalle: ${message}`;if(code==='PGRST202'||/could not find the function|function .* does not exist|schema cache.*function/i.test(message))return `Comunidad se está actualizando y todavía no se puede ${context}. Para quien administra la app: falta aplicar supabase/APLICAR_MIGRACIONES.sql en Supabase (SQL Editor). Detalle: ${message}`;if(code==='42P01'||code==='PGRST205'||/relation .* does not exist|could not find the table/i.test(message))return `Supabase respondió, pero falta una tabla necesaria para ${context}. Revisá que community.sql se haya ejecutado completamente en este mismo proyecto. Detalle: ${message}`;if(code==='42501'||/row-level security|permission denied|not allowed/i.test(message))return `Supabase está conectado, pero las políticas/permisos RLS impiden ${context}. No vuelvas a ejecutar SQL a ciegas; revisá el código ${code||'de permisos'} y el detalle: ${message}`;if(/failed to fetch|network|fetcherror|load failed/i.test(message))return `No se pudo llegar a Supabase desde el navegador. Revisá conexión, URL del proyecto y consola del navegador. Detalle: ${message}`;return `No se pudo completar ${context}.${code?` Código ${code}.`:''} Detalle: ${message}`;}
  // Los textos de confirm/prompt/alert/avisos no pasan por el DOM: se traducen acá al idioma elegido.
  const tr=text=>{try{return window.FittFormaI18n?.translate?.(text)||text;}catch{return text;}};
  const toast=msg=>{try{window.toast?.(tr(msg));}catch{}};
  function setControls(){
    const ready=!!client,logged=!!user;
    ['communityProfileForm','communityPostForm'].forEach(id=>{const form=$(id);if(form)form.querySelectorAll('input,textarea,select,button').forEach(el=>{if(id==='communityPostForm'&&el.id==='communityPublish')el.disabled=!logged;});});
    if($('communityGoogleLogin'))$('communityGoogleLogin').disabled=!ready||logged;
    if($('communitySignOut'))$('communitySignOut').hidden=!logged;
    if($('communityEmailAuthForm'))$('communityEmailAuthForm').hidden=logged;
    if($('communityEditProfileToggle'))$('communityEditProfileToggle').hidden=!logged;
    // Sin sesión se muestra el acceso (correo o Google); con sesión, el perfil social y el editor plegado.
    if($('communityOwnProfile'))$('communityOwnProfile').hidden=!logged;
    if(!logged)$('communityProfileEditor')?.classList.add('is-open');
    if($('communityAvatarLabel'))$('communityAvatarLabel').hidden=!logged||schemaV49===false;
    if(!ready){status(authHint());setStatus('communityProfileStatus',authHint());}
    else if(!logged){setStatus('communityProfileStatus','Iniciá sesión por correo en Perfil o usá Google para crear tu perfil comunitario.');}
    else setStatus('communityProfileStatus','Sesión online: '+(user.email||'cuenta conectada')+'.');
  }

  // ---------- Imágenes: URLs firmadas de corta duración, en lote ----------
  const SIGN_TTL=600,signedCache=new Map();
  async function signed(path){if(!path)return '';const {data,error}=await client.storage.from(bucket).createSignedUrl(path,SIGN_TTL);if(error){console.warn('No se pudo abrir una imagen de comunidad:',error.message);return '';}return data?.signedUrl||'';}
  async function signedMany(paths){
    const now=Date.now(),need=[...new Set((paths||[]).filter(Boolean))].filter(p=>!(signedCache.get(p)?.exp>now));
    if(need.length&&client){
      let done=false;
      try{const {data,error}=await client.storage.from(bucket).createSignedUrls(need,SIGN_TTL);if(!error&&Array.isArray(data)){data.forEach((row,i)=>{if(row?.signedUrl)signedCache.set(row.path||need[i],{url:row.signedUrl,exp:now+(SIGN_TTL-60)*1000});});done=true;}}catch{}
      if(!done)await Promise.all(need.map(async p=>{const url=await signed(p);if(url)signedCache.set(p,{url,exp:now+(SIGN_TTL-60)*1000});}));
    }
    return p=>signedCache.get(p)?.url||'';
  }
  function avatarHtml(profile,urlOf,size=''){const name=profile?.display_name||profile?.username||'Usuario',url=profile?.avatar_path&&urlOf?urlOf(profile.avatar_path):'';return `<span class="community-avatar${size?' community-avatar-'+size:''}${url?' has-photo':''}">${url?`<img src="${esc(url)}" alt="" loading="lazy" onerror="this.parentElement.classList.remove('has-photo');this.remove()">`:''}<span aria-hidden="true">${esc(initials(name))}</span></span>`;}
  // v62: las insignias se pueden tocar: ficha con qué es, nivel, marca, fecha y cómo se registró.
  // Si es tuya, «Ver en mis insignias» lleva a tu galería. Se guarda cada insignia mostrada para abrir su ficha.
  const badgeRegistry=new Map();let badgeSeq=0;
  function badgeKey(b){const k='b'+(++badgeSeq);badgeRegistry.set(k,b||{});if(badgeRegistry.size>400){const first=badgeRegistry.keys().next().value;badgeRegistry.delete(first);}return k;}
  const MEASURE_UNIT={reps:['repetición','repeticiones'],seconds:['segundo','segundos'],minutes:['minuto','minutos'],km:['km','km'],days:['día','días'],sessions:['entrenamiento','entrenamientos'],streak:['día seguido','días seguidos'],bw:['× tu peso corporal','× peso corporal']};
  function showBadgeInfo(b,own){
    const E=BE(),dlg=$('communityBadgeInfo');if(!E||!dlg||!b)return;
    const level=Math.min(15,Math.max(1,Number(b.level)||1)),rank=E.rankForLevel(level-1);
    const core=(E.CORE_EXERCISES||[]).find(x=>x.id===b.exerciseId),need=core?.thresholds?.[level-1],u=MEASURE_UNIT[b.measure]||MEASURE_UNIT.reps;
    const mark=need!=null?(b.measure==='bw'?`${String(need).replace('.',',')} ${u[1]}`:`${Number(need).toLocaleString()} ${Number(need)===1?u[0]:u[1]}`):'';
    const ev={gps_device:'Con GPS del dispositivo',session:'Registrada en un entrenamiento',declared:'Autorregistrada'}[b.evidence]||'Autorregistrada';
    const cat=b.category?E.categoryLabel(b.category):'';
    dlg.innerHTML=`<div class="cm-bi-body"><button type="button" class="wp-sheet-close cm-bi-close" data-bi-close aria-label="Cerrar"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      <div class="cm-bi-medal">${E.medalSvg({rankKey:rank.key,numeral:rank.numeral,glyph:E.glyphFor({id:b.exerciseId,name:b.exerciseName,category:b.category,measure:b.measure}),category:b.category,size:112,title:`${b.exerciseName||''} · ${rank.label}`})}</div>
      <h3 id="communityBadgeInfoTitle">${esc(b.exerciseName||'Insignia')}</h3>
      <p class="cm-bi-rank"><strong>${esc(rank.label)}</strong> · <span>nivel ${level} de 15</span></p>
      <dl class="cm-bi-facts">${cat?`<div><dt>Categoría</dt><dd>${esc(cat)}</dd></div>`:''}${mark?`<div><dt>Marca de este nivel</dt><dd>${esc(mark)}</dd></div>`:''}${b.earnedAt?`<div><dt>Lograda</dt><dd>${esc(dateLabel(b.earnedAt))}</dd></div>`:''}<div><dt>Cómo se registró</dt><dd>${esc(ev)}</dd></div></dl>
      <p class="muted small">Las insignias se ganan en la app con los registros de cada persona; ninguna está verificada por terceros.</p>
      <div class="btn-row">${own?'<button type="button" class="btn" data-bi-mine>Ver en mis insignias</button>':''}<button type="button" class="btn ${own?'ghost':''}" data-bi-close>Cerrar</button></div></div>`;
    dlg.querySelectorAll('[data-bi-close]').forEach(x=>x.onclick=()=>dlg.close());
    dlg.querySelector('[data-bi-mine]')?.addEventListener('click',()=>{dlg.close();window.FittFormaGo?.('badge:'+String(b.exerciseId||''));});
    dlg.onclick=e=>{if(e.target===dlg)dlg.close();};
    try{dlg.showModal();}catch{dlg.setAttribute('open','');}
  }
  // Captura: una insignia dentro de una tarjeta que abre un perfil abre su ficha, no el perfil.
  document.addEventListener('click',e=>{const el=e.target.closest?.('[data-badge-key]');if(!el)return;e.preventDefault();e.stopPropagation();showBadgeInfo(badgeRegistry.get(el.dataset.badgeKey),Boolean(el.closest('#communityOwnProfile'))||Boolean(user&&el.closest(`[data-owner="${user.id}"]`)));},true);
  document.addEventListener('keydown',e=>{if(e.key!=='Enter'&&e.key!==' ')return;const el=e.target.closest?.('[data-badge-key]');if(!el||el!==e.target)return;e.preventDefault();e.stopPropagation();el.click();},true);
  function featuredHtml(list,size=18){const E=window.FittFormaBadgeEngine;if(!E||!Array.isArray(list))return '';return list.slice(0,3).map(b=>{const level=Math.min(15,Math.max(1,Number(b?.level)||1)),rank=E.rankForLevel(level-1);return `<span class="community-mini-badge" title="${esc(b?.exerciseName||'')} · ${esc(rank.label)}" role="button" tabindex="0" data-badge-key="${badgeKey(b)}">${E.medalSvg({rankKey:rank.key,numeral:rank.numeral,glyph:E.glyphFor({id:b?.exerciseId,name:b?.exerciseName,category:b?.category,measure:b?.measure}),category:b?.category,size,title:`${b?.exerciseName||''} · ${rank.label}`})}</span>`;}).join('');}
  // #hashtags clicables (se buscan en Explorar). El texto se escapa antes.
  // v53: los #hashtags se resaltan pero no abren una búsqueda de publicaciones (no hay feed general).
  function richText(text){return esc(text).replace(/(^|[\s(])#([\p{L}\p{N}_]{2,30})/gu,(m,pre,tag)=>`${pre}<span class="community-hashtag">#${tag}</span>`);}

  async function ensureProfile(){
    if(!authReady())throw new Error(authHint());
    const {data,error}=await client.from('community_profiles').select('*').eq('user_id',user.id).maybeSingle();
    if(error)throw error;
    if(data){fillProfile(data);return data;}
    // Nunca se usa el correo para el nombre visible ni el usuario (la búsqueda lo expondría).
    const display=String(user.user_metadata?.full_name||user.user_metadata?.name||'Atleta FittForma').slice(0,60);
    const username=(String(user.user_metadata?.preferred_username||'atleta').toLowerCase().replace(/[^a-z0-9_.-]/g,'').slice(0,15)+'_'+user.id.replace(/-/g,'').slice(0,8)).slice(0,24);
    const payload={user_id:user.id,display_name:display,username, bio:'',visibility:'public'};
    const result=await client.from('community_profiles').upsert(payload,{onConflict:'user_id'}).select('*').single();
    if(result.error)throw result.error;fillProfile(result.data);return result.data;
  }
  function fillProfile(p){
    if(!$('communityDisplayName'))return;
    ownProfile=p;
    if(schemaV49===null)schemaV49=Object.prototype.hasOwnProperty.call(p,'featured_badges');
    ownVisibility=p.visibility==='public'?'public':'private';
    if($('communityAvatarRemove'))$('communityAvatarRemove').hidden=!p.avatar_path;
    $('communityDisplayName').value=p.display_name||'';$('communityUsername').value=p.username||'';$('communityBio').value=p.bio||'';$('communityVisibility').value=p.visibility==='private'?'private':'public';
    $('communityOwnName').textContent=p.display_name||p.username||'Tu perfil';
    if($('communityOwnHandle'))$('communityOwnHandle').textContent=p.username?`@${p.username}`:'';
    if($('communityOwnBio'))$('communityOwnBio').textContent=p.bio||'';
    renderOwnHeader();renderAvatarOffer();
    if(client&&user?.id===p.user_id){refreshOwnCounts();syncFeaturedBadges();}
  }
  async function renderOwnHeader(){
    const p=ownProfile;if(!$('communityOwnAvatar'))return;
    const urlOf=p?.avatar_path?await signedMany([p.avatar_path]):null;
    // Se vuelve a buscar después de esperar: otra actualización pudo reemplazar el elemento mientras tanto.
    const avatar=$('communityOwnAvatar');if(!avatar?.parentNode||p!==ownProfile)return;
    avatar.outerHTML=avatarHtml(p||{display_name:'FF'},urlOf,'lg').replace('<span class="community-avatar','<span id="communityOwnAvatar" class="community-avatar');
    const tab=$('communityTabAvatar');const url=p?.avatar_path&&urlOf?urlOf(p.avatar_path):'';
    if(tab){tab.classList.toggle('has-photo',Boolean(url));if(url)tab.innerHTML=`<img src="${esc(url)}" alt="">`;}
    renderOwnRankAndMuscles();
    const featured=$('communityOwnFeatured');if(featured)featured.innerHTML=featuredHtml(p?.featured_badges?.length?p.featured_badges:(window.FittFormaFeaturedBadgesPayload?.()||[]),26);
  }
  // v55: tu rango y tu mapa de músculos en Mi perfil, calculados en el dispositivo (se ven aunque falte una migración).
  function renderOwnRankAndMuscles(){
    const mine=window.FittFormaMyMuscles?.();const rk=$('communityOwnRank');if(rk)rk.innerHTML=mine?rankMini(mine.overall):'';
    const box=$('communityOwnMuscles');if(!box)return;
    const A=window.FittFormaAnatomy,R=MRK();if(!mine||!A?.muscleFillSvg||!R){box.hidden=true;return;}
    box.hidden=false;const fills={};for(const m of mine.muscles||[])if(m.rank>=0&&R.RANKS[m.rank])fills[m.id]=R.RANKS[m.rank].color;
    const ranked=(mine.muscles||[]).filter(m=>m.rank>=0).sort((a,b)=>b.rank-a.rank||b.score-a.score);
    box.innerHTML=`<div class="cm-own-muscles-head"><div><h3>Mis músculos</h3><p class="muted small">${ranked.length} de 20 con rango · así se ve en tu perfil${$('communityShowMuscles')&&!$('communityShowMuscles').checked?' (ahora oculto para los demás)':''}.</p></div><button class="btn ghost btn-sm" type="button" id="communityOwnMusclesGo">Ver detalle</button></div><div class="cm-muscle-map">${A.muscleFillSvg(fills,{label:'Tu rango por músculo'})}</div>${ranked.length?`<ul class="cm-muscle-top">${ranked.slice(0,3).map(m=>`<li>${rankChip(m.rank,20)}<span>${esc((A.MUSCLES||{})[m.id]||m.id)}</span></li>`).join('')}</ul>`:'<p class="muted small">Completá series en tus entrenamientos y tus músculos se van a ir pintando.</p>'}`;
    $('communityOwnMusclesGo')?.addEventListener('click',()=>window.FittFormaShowMuscles?.());
  }
  function statsHtml(posts,followers,following){return `<span><b>${Number(posts)||0}</b> publicaciones</span><span><b>${Number(followers)||0}</b> seguidores</span><span><b>${Number(following)||0}</b> seguidos</span>`;}
  async function refreshOwnCounts(){if(!client||!user)return;try{
    const stats=await client.rpc('community_profile_stats',{p_user:user.id});
    if(!stats.error&&stats.data?.[0]){const s=stats.data[0];if($('communityOwnStats'))$('communityOwnStats').innerHTML=statsHtml(s.posts,s.followers,s.following);return;}
    const [posts,followers,following]=await Promise.all([client.from('community_posts').select('id',{count:'exact',head:true}).eq('user_id',user.id),client.from('community_follows').select('follower_id',{count:'exact',head:true}).eq('following_id',user.id).eq('status','accepted'),client.from('community_follows').select('following_id',{count:'exact',head:true}).eq('follower_id',user.id).eq('status','accepted')]);
    if($('communityOwnStats'))$('communityOwnStats').innerHTML=statsHtml(posts.count,followers.count,following.count);}catch{}}
  // v49: las 3 insignias destacadas se copian al perfil social (solo el logro). Se actualizan si cambian.
  async function syncFeaturedBadges(){
    if(!authReady()||schemaV49===false||!ownProfile)return;
    const payload=(window.FittFormaFeaturedBadgesPayload?.()||[]).slice(0,3);
    if(JSON.stringify(payload)===JSON.stringify(ownProfile.featured_badges||[]))return;
    const {data,error}=await client.from('community_profiles').update({featured_badges:payload}).eq('user_id',user.id).select('*').maybeSingle();
    if(error){if(isMissingColumn(error))schemaV49=false;else console.warn('No se pudieron publicar las insignias destacadas:',error.message);return;}
    if(data){ownProfile=data;renderOwnHeader();}
  }
  // v53: solicitudes con la función community_follow_requests (sin el embed community_follows → community_profiles,
  // que puede dar PGRST201/PGRST200 según el nombre de las FK). Sin la migración v53, consulta por separado.
  async function loadFollowRequests(){const root=$('communityFollowRequests');if(!root)return;if(!authReady()){root.textContent='Iniciá sesión para administrar solicitudes.';return;}
    let rows=null;const r=await client.rpc('community_follow_requests');
    if(!r.error)rows=r.data||[];
    else if(isMissingFunction(r.error)){const f=await client.from('community_follows').select('follower_id,created_at').eq('following_id',user.id).eq('status','pending').order('created_at',{ascending:false}).limit(30);if(f.error){root.textContent='No se pudieron cargar las solicitudes: '+f.error.message;return;}const ids=(f.data||[]).map(x=>x.follower_id);const pr=ids.length?await client.rpc('community_directory',{p_search:'',p_after:null,p_limit:30}):{data:[]};const byId=new Map((pr.data||[]).map(x=>[x.user_id,x]));rows=(f.data||[]).map(x=>({follower_id:x.follower_id,...(byId.get(x.follower_id)||{})}));}
    else{root.textContent='No se pudieron cargar las solicitudes: '+r.error.message;return;}
    if(!rows.length){root.textContent='No hay solicitudes pendientes.';return;}
    root.innerHTML=rows.map(row=>`<div class="community-comment"><strong>${esc(row.display_name||'Usuario')}</strong> <span class="muted">@${esc(row.username||String(row.follower_id).slice(0,8))}</span><div class="btn-row" style="margin-top:7px"><button class="btn secondary" type="button" data-community-accept="${esc(row.follower_id)}">Aceptar</button><button class="btn ghost" type="button" data-community-reject="${esc(row.follower_id)}">Rechazar</button></div></div>`).join('');root.querySelectorAll('[data-community-accept]').forEach(b=>b.addEventListener('click',()=>resolveFollow(b.dataset.communityAccept,true)));root.querySelectorAll('[data-community-reject]').forEach(b=>b.addEventListener('click',()=>resolveFollow(b.dataset.communityReject,false)));}
  async function resolveFollow(followerId,accept){const result=accept?await client.from('community_follows').update({status:'accepted'}).eq('follower_id',followerId).eq('following_id',user.id).eq('status','pending'):await client.from('community_follows').delete().eq('follower_id',followerId).eq('following_id',user.id).eq('status','pending');if(result.error){status('No se pudo actualizar la solicitud: '+result.error.message);return;}await loadFollowRequests();refreshOwnCounts();}

  // ---------- Publicaciones ----------
  // v53: publicaciones con su autor sin el embed community_posts → community_profiles (evita PGRST201/PGRST200).
  async function withAuthors(posts){
    const ids=[...new Set((posts||[]).map(p=>p.user_id))];if(!ids.length)return [];
    const r=await client.from('community_profiles').select(profileCols()).in('user_id',ids);
    const byUser=new Map((r.error?[]:r.data||[]).map(x=>[x.user_id,x]));
    return posts.filter(p=>byUser.has(p.user_id)).map(p=>({...p,community_profiles:byUser.get(p.user_id)}));
  }
  function postSelect(){const extra=schemaV41===false?'':V41_COLS;return 'id,user_id,description,exercises_text,nutrition_text,running_text,start_date,end_date,before_path,after_path,visibility,created_at'+extra+(schemaV49===false?'':',linked_session');}
  function profileCols(){return 'user_id,display_name,username,bio,visibility,avatar_path'+(schemaV49===false?'':',featured_badges');}
  async function myFollowing(){if(!authReady())return new Map();const {data,error}=await client.from('community_follows').select('following_id,status').eq('follower_id',user.id);return new Map((error?[]:data||[]).map(x=>[x.following_id,x.status]));}
  // Me gusta, comentarios, seguimiento, guardadas e imágenes de un conjunto de publicaciones (todo bajo RLS).
  async function bundle(posts){
    const ids=posts.map(p=>p.id);let likes=[],comments=[],followStatus=new Map(),saved=new Set();
    if(ids.length){
      const requests=[client.from('community_likes').select('post_id,user_id').in('post_id',ids),client.from('community_comments').select('id,post_id,user_id,body,created_at,community_profiles!community_comments_user_id_fkey(display_name,username,avatar_path)').in('post_id',ids).order('created_at',{ascending:true})];
      const results=await Promise.all(requests);
      if(!results[0].error)likes=results[0].data||[];
      if(!results[1].error)comments=results[1].data||[];
      else if(results[1].error.code==='PGRST201'||results[1].error.code==='PGRST200'){
        // Recuperación para comentarios si la FK también es ambigua en un esquema antiguo.
        const plainComments=await client.from('community_comments').select('id,post_id,user_id,body,created_at').in('post_id',ids).order('created_at',{ascending:true});
        if(!plainComments.error){
          const commentAuthors=[...new Set((plainComments.data||[]).map(comment=>comment.user_id))];
          let commentProfiles=[];
          if(commentAuthors.length){const profileResult=await client.from('community_profiles').select('user_id,display_name,username,avatar_path').in('user_id',commentAuthors);if(!profileResult.error)commentProfiles=profileResult.data||[];}
          const profilesByUser=new Map(commentProfiles.map(profile=>[profile.user_id,profile]));
          comments=(plainComments.data||[]).map(comment=>({...comment,community_profiles:profilesByUser.get(comment.user_id)||null}));
        }else console.warn('No se pudieron cargar comentarios de Comunidad:',plainComments.error.message);
      }else console.warn('No se pudieron cargar comentarios de Comunidad:',results[1].error.message);
      if(user){followStatus=await myFollowing();
        if(savedEnabled&&schemaV49!==false){const s=await client.from('community_saved_posts').select('post_id').eq('user_id',user.id).in('post_id',ids);if(s.error){savedEnabled=false;}else saved=new Set((s.data||[]).map(x=>x.post_id));}}
    }
    const paths=[];for(const p of posts){const kind=p.post_kind||'transformation';if(kind==='transformation')paths.push(p.before_path,p.after_path);if(p.image_path)paths.push(p.image_path);const prof=Array.isArray(p.community_profiles)?p.community_profiles[0]:p.community_profiles;if(prof?.avatar_path)paths.push(prof.avatar_path);}for(const c of comments){const cp=Array.isArray(c.community_profiles)?c.community_profiles[0]:c.community_profiles;if(cp?.avatar_path)paths.push(cp.avatar_path);}
    const urlOf=await signedMany(paths);
    const likedSet=new Set(likes.filter(x=>x.user_id===user?.id).map(x=>x.post_id));
    const countBy={};likes.forEach(x=>countBy[x.post_id]=(countBy[x.post_id]||0)+1);
    return {likedSet,countBy,comments,followStatus,saved,urlOf};
  }
  const ICON={heart:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>',comment:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5h16v11H10l-5 3v-3H4z"/></svg>',share:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 3 10 14M21 3l-7 18-4-7-7-4z"/></svg>',save:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-6-4.5L6 21z"/></svg>',more:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>'};
  function linkedSessionHtml(s){if(!s||typeof s!=='object')return '';const bits=[s.minutes?`${s.minutes} min`:'',Array.isArray(s.exercises)&&s.exercises.length?`${s.exercises.length} ejercicio(s)`:'',s.sets?`${s.sets} series`:''].filter(Boolean);return `<div class="community-linked-session"><span class="community-linked-icon" aria-hidden="true">${s.type==='run'?'🏃':''}</span><div><small>${s.type==='run'?'Actividad':'Entrenamiento'} · ${esc(dateLabel(s.date))}</small><strong>${esc(s.title)}</strong>${bits.length?`<span>${esc(bits.join(' · '))}</span>`:''}${Array.isArray(s.exercises)&&s.exercises.length?`<span class="muted small">${esc(s.exercises.slice(0,4).join(' · '))}${s.exercises.length>4?'…':''}</span>`:''}</div></div>`;}
  function renderPostCard(p,ctx,rankByPost={}){
    const profile=Array.isArray(p.community_profiles)?p.community_profiles[0]:p.community_profiles;
    const kind=p.post_kind||'transformation';const urlOf=ctx.urlOf;
    const before=kind==='transformation'?urlOf(p.before_path):'',after=kind==='transformation'?urlOf(p.after_path):'',single=p.image_path?urlOf(p.image_path):'';
    const postComments=ctx.comments.filter(c=>c.post_id===p.id);
    const profileName=profile?.display_name||profile?.username||'Usuario';
    const owner=user?.id===p.user_id;
    const followState=ctx.followStatus.get(p.user_id)||'';const isFollowing=followState==='accepted',isPending=followState==='pending';
    const when=kind==='transformation'&&p.start_date&&p.end_date?`${dateLabel(p.start_date)} – ${dateLabel(p.end_date)}`:timeAgo(p.created_at)+(p.updated_at?' · editado':'');
    const kindLabel=kind==='achievement'?'Logro':kind==='transformation'?'Transformación':'';
    const missing="this.closest('.community-photo,.community-single-photo')?.classList.add('is-missing');this.remove()";
    const media=kind==='transformation'?`<div class="community-photos">${before?`<div class="community-photo"><img loading="lazy" onerror="${missing}" src="${esc(before)}" alt="Foto de antes de ${esc(profileName)}"><span>ANTES</span></div>`:'<div class="community-photo"><span>ANTES · imagen no disponible</span></div>'}${after?`<div class="community-photo"><img loading="lazy" onerror="${missing}" src="${esc(after)}" alt="Foto de después de ${esc(profileName)}"><span>DESPUÉS</span></div>`:'<div class="community-photo"><span>DESPUÉS · imagen no disponible</span></div>'}</div>`:(single?`<div class="community-single-photo"><img loading="lazy" onerror="${missing}" src="${esc(single)}" alt="Foto compartida por ${esc(profileName)}"></div>`:'');
    const achievementHtml=kind==='achievement'&&p.achievement?achievementCard(p.achievement):'';
    const tags=[p.exercises_text?`Rutina: ${p.exercises_text}`:'',p.nutrition_text?`Alimentación: ${p.nutrition_text}`:'',p.running_text?`Actividad: ${p.running_text}`:''].filter(Boolean);
    const commentHtml=postComments.map((c,i)=>{const cp=Array.isArray(c.community_profiles)?c.community_profiles[0]:c.community_profiles;return `<div class="community-comment"${i<postComments.length-2?' data-older-comment hidden':''}>${avatarHtml(cp||{display_name:'Usuario'},ctx.urlOf,'xs')}<strong>${esc(cp?.display_name||cp?.username||'Usuario')}</strong> ${esc(c.body)}${user?.id===c.user_id?` <button class="btn ghost btn-sm" type="button" data-community-delete-comment="${esc(c.id)}">Borrar</button>`:''}</div>`;}).join('');
    const rank=rankByPost[p.id]||{isPro:false,followerCount:0,activityScore:0};
    const liked=ctx.likedSet.has(p.id),saved=ctx.saved.has(p.id),likes=ctx.countBy[p.id]||0;
    const menu=`<details class="community-post-menu"><summary aria-label="Más opciones de la publicación">${ICON.more}</summary><div class="community-menu" role="menu">${owner?'':`<button class="btn ghost" type="button" data-community-report="${esc(p.id)}">Denunciar</button>${user?`<button class="btn ghost" type="button" data-community-block="${esc(p.user_id)}">Bloquear</button>`:''}`}${owner&&schemaV41?`<button class="btn ghost" type="button" data-community-edit-post="${esc(p.id)}" data-kind="${esc(kind)}">Editar texto</button>`:''}${owner?`<button class="btn ghost" type="button" data-community-delete-post="${esc(p.id)}">Eliminar</button>`:''}</div></details>`;
    const actions=`<div class="community-actions" role="group" aria-label="Acciones"><button class="community-action${liked?' is-on':''}" type="button" data-community-like="${esc(p.id)}" aria-pressed="${liked}" aria-label="${liked?'Quitar me gusta':'Me gusta'}">${ICON.heart}<span data-like-count>${likes}</span></button><button class="community-action" type="button" data-community-focus-comment="${esc(p.id)}" aria-label="Comentar">${ICON.comment}<span>${postComments.length}</span></button><button class="community-action" type="button" data-community-share="${esc(p.id)}" aria-label="Compartir">${ICON.share}</button>${user&&savedEnabled&&schemaV49!==false?`<button class="community-action community-save${saved?' is-on':''}" type="button" data-community-save="${esc(p.id)}" aria-pressed="${saved}" aria-label="${saved?'Quitar de guardadas':'Guardar'}">${ICON.save}</button>`:''}</div>`;
    const bodyHtml=`<div class="community-post-body">${kindLabel?`<span class="community-kind">${kindLabel}</span>`:''}${achievementHtml}${p.description?`<p data-community-post-text>${richText(p.description)}</p>`:''}${linkedSessionHtml(p.linked_session)}${tags.length?`<div class="community-tags">${tags.map(t=>`<span>${esc(t)}</span>`).join('')}</div>`:''}<p class="muted small community-disclaimer">Información compartida por el usuario; no está verificada automáticamente por FittForma.</p></div>`;
    // Con foto: foto, acciones y texto. Sin foto: el texto va primero y las acciones debajo.
    const content=media?`${media}${actions}${bodyHtml}`:`${bodyHtml}${actions}`;
    return `<article class="card community-post" data-community-post="${esc(p.id)}"><div class="community-post-head"><button type="button" class="community-author-btn" data-community-open-user="${esc(p.user_id)}" aria-label="Ver el perfil de ${esc(profileName)}">${avatarHtml(profile,urlOf)}</button><div class="community-author"><strong><button type="button" class="community-author-name" data-community-open-user="${esc(p.user_id)}">${esc(profileName)}</button>${featuredHtml(profile?.featured_badges,18)}${rank.isPro?'<span class="community-pro-badge">PRO</span>':''}</strong><small>@${esc(profile?.username||'usuario')} · ${esc(when)}${p.visibility==='followers'?' · Seguidores':''}</small></div>${owner||!user||isFollowing?'':`<button class="btn ghost btn-sm community-follow-btn" type="button" data-community-follow="${esc(p.user_id)}" data-following="${isPending?'pending':'no'}">${isPending?'Solicitud enviada':'Seguir'}</button>`}${menu}</div>${content}<div class="community-comments">${postComments.length>2?`<button class="community-more-comments" type="button" data-community-show-comments>Ver los ${postComments.length} comentarios</button>`:''}${commentHtml}${user?`<form class="community-comment-form" data-community-comment-form="${esc(p.id)}"><input name="body" maxlength="500" required placeholder="Agregá un comentario…" aria-label="Escribí un comentario"><button class="btn secondary btn-sm" type="submit">Enviar</button></form>`:`<p class="muted small">Iniciá sesión para comentar.</p>`}</div></article>`;
  }
  // v53: después de una acción sobre publicaciones se actualiza lo que está a la vista (no hay feed general).
  let dialogPostId=null;
  async function refreshPosts(){
    if(currentSubView==='profile')await renderOwnGrid();
    else if(currentSubView==='user'&&viewedUser)await openUser(viewedUser,{asOthers:viewedUser===user?.id});
    if($('communityPostDialog')?.open&&dialogPostId)await openPostDialog(dialogPostId);
  }

  async function saveProfile(e){e.preventDefault();if(!authReady()){setStatus('communityProfileStatus',authHint());return;}
    const display=$('communityDisplayName').value.trim(),username=$('communityUsername').value.trim().toLowerCase(),bio=$('communityBio').value.trim(),visibility=$('communityVisibility').value;
    if(display.length<1||!/^[a-z0-9_.-]{3,24}$/.test(username)){setStatus('communityProfileStatus','Revisá el nombre y el usuario (3–24 caracteres permitidos).');return;}
    setStatus('communityProfileStatus','Guardando perfil…');
    const {data,error}=await client.from('community_profiles').upsert({user_id:user.id,display_name:display,username,bio,visibility,updated_at:new Date().toISOString()},{onConflict:'user_id'}).select('*').single();
    if(error){setStatus('communityProfileStatus',error.message.includes('unique')?'Ese usuario ya está ocupado. Elegí otro.':`No se pudo guardar: ${error.message}`);return;}fillProfile(data);setStatus('communityProfileStatus','Perfil guardado. Privacidad: '+(visibility==='public'?'público':'privado')+'.');if($('communityCountry')&&extrasEnabled!==false)await saveCountry($('communityCountry').value);await refreshPosts();
  }
  async function prepareImage(file,{max=1800,square=false}={}){
    if(!file)throw new Error('Elegí las dos fotos de antes y después.');
    if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Las fotos deben ser JPG, PNG o WebP.');
    if(file.size>8*1024*1024)throw new Error('Cada foto original debe pesar como máximo 8 MB.');
    // Reencode on-device to JPEG: reduces upload size and strips EXIF metadata (including possible GPS data).
    let bitmap;try{bitmap=await createImageBitmap(file);}catch{throw new Error('No se pudo procesar la foto en este navegador. Probá con un JPG, PNG o WebP más simple.');}
    try{const side=Math.min(bitmap.width,bitmap.height),sw=square?side:bitmap.width,sh=square?side:bitmap.height,scale=Math.min(1,max/Math.max(sw,sh)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(sw*scale));canvas.height=Math.max(1,Math.round(sh*scale));const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)throw new Error('No se pudo preparar la imagen.');ctx.drawImage(bitmap,square?(bitmap.width-side)/2:0,square?(bitmap.height-side)/2:0,sw,sh,0,0,canvas.width,canvas.height);const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('No se pudo comprimir la foto.')),'image/jpeg',0.86));return new File([blob],'fittforma-photo.jpg',{type:'image/jpeg',lastModified:Date.now()});}finally{bitmap.close?.();}
  }
  async function uploadImage(file,path,options={}){
    const processed=await prepareImage(file,options);const upload={cacheControl:'600',upsert:false,contentType:'image/jpeg'};const {error}=await client.storage.from(bucket).upload(path,processed,upload);if(error)throw error;return path;
  }
  // v61: si la persona no tiene foto en Comunidad, se le ofrece usar la de su Perfil (un toque) o elegir una.
  // Nunca se sube sola: una foto de la cara es un dato personal y la publica la persona.
  const AVATAR_OFFER_KEY='fittforma-v61-avatar-offer';
  function fileFromDataUrl(u){const b=atob(String(u).split(',')[1]||''),a=new Uint8Array(b.length);for(let i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return new File([a],'avatar.jpg',{type:'image/jpeg'});}
  function renderAvatarOffer(){
    const box=$('communityAvatarOffer');if(!box)return;
    let dismissed='';try{dismissed=localStorage.getItem(AVATAR_OFFER_KEY)||'';}catch{}
    const show=authReady()&&ownProfile&&!ownProfile.avatar_path&&dismissed!==user.id&&['world','profile'].includes(currentSubView);
    box.hidden=!show;if(!show)return;
    const local=window.FittFormaLocalAvatar?.()||'';
    box.innerHTML=`<div class="cm-avatar-offer-pic">${local?`<img src="${esc(local)}" alt="Tu foto de perfil de la app" width="56" height="56">`:'<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>'}</div>
      <div class="cm-avatar-offer-text"><strong>${local?'¿Usar tu foto de perfil en Comunidad?':'Agregá una foto de perfil'}</strong><span class="muted small">${local?'Es la que elegiste en Perfil. Las demás personas la van a ver junto a tu nombre.':'Así te reconocen tus amigos. Podés cambiarla o quitarla cuando quieras.'}</span>
      <span class="cm-avatar-offer-btns">${local?'<button type="button" class="btn btn-sm" data-avatar-offer-use>Usar mi foto</button>':''}<label class="btn ${local?'ghost':''} btn-sm" for="communityAvatarInput">${local?'Elegir otra':'Elegir foto'}</label><button type="button" class="link-btn" data-avatar-offer-dismiss>Ahora no</button></span></div>`;
    box.querySelector('[data-avatar-offer-use]')?.addEventListener('click',()=>{const u=window.FittFormaLocalAvatar?.();if(u)changeAvatar(fileFromDataUrl(u));});
    box.querySelector('[data-avatar-offer-dismiss]')?.addEventListener('click',()=>{try{localStorage.setItem(AVATAR_OFFER_KEY,user.id);}catch{}box.hidden=true;});
  }
  // v49: foto de perfil propia (cuadrada, 512 px, sin metadatos), en la carpeta de la cuenta.
  async function changeAvatar(file){
    if(!authReady()||!file)return;if(schemaV49===false){setStatus('communityProfileStatus','Para usar foto de perfil, aplicá la migración v49 de Comunidad en Supabase.');return;}
    setStatus('communityProfileStatus','Subiendo foto de perfil…');setStatus('communityAvatarStatus','Subiendo foto de perfil…');
    const path=`${user.id}/avatar/${Date.now().toString(36)}.jpg`,previous=ownProfile?.avatar_path||'';
    try{
      await uploadImage(file,path,{max:512,square:true});
      const {data,error}=await client.from('community_profiles').update({avatar_path:path,updated_at:new Date().toISOString()}).eq('user_id',user.id).select('*').single();
      if(error)throw error;
      if(previous&&previous!==path)await client.storage.from(bucket).remove([previous]).catch(()=>{});
      fillProfile(data);setStatus('communityProfileStatus','Foto de perfil actualizada.');setStatus('communityAvatarStatus','Foto de perfil actualizada.');toast('Foto de perfil actualizada.');closeViewer();
    }catch(error){await client.storage.from(bucket).remove([path]).catch(()=>{});const raw=String(error?.message||''),msg=/bucket not found/i.test(raw)?'Falta crear el espacio de fotos «community-media» en Supabase (se crea con supabase/community.sql).':/row-level security|unauthorized|403/i.test(raw)?'Supabase no permitió subir la foto: revisá que estén aplicadas las migraciones de Comunidad (v49 y v50).':/avatar_path|column/i.test(raw)?'Falta aplicar la migración v49 de Comunidad (foto de perfil).':error?.code?friendlySupabaseError(error,'guardar la foto de perfil'):`No se pudo guardar la foto: ${raw}`;toast(msg);setStatus('communityProfileStatus',msg);setStatus('communityAvatarStatus',msg);}
    finally{if($('communityAvatarInput'))$('communityAvatarInput').value='';}
  }
  // v50: quitar la foto de perfil (vuelve la imagen predeterminada con iniciales).
  async function removeAvatar(){
    if(!authReady()||!ownProfile?.avatar_path)return;if(!confirm(tr('¿Quitar tu foto de perfil? Se mostrarán tus iniciales.')))return;
    const previous=ownProfile.avatar_path;setStatus('communityProfileStatus','Quitando foto…');
    const {data,error}=await client.from('community_profiles').update({avatar_path:null,updated_at:new Date().toISOString()}).eq('user_id',user.id).select('*').single();
    if(error){setStatus('communityProfileStatus',friendlySupabaseError(error,'quitar la foto de perfil'));return;}
    await client.storage.from(bucket).remove([previous]).catch(()=>{});fillProfile(data);setStatus('communityProfileStatus','Foto de perfil quitada.');setStatus('communityAvatarStatus','Foto de perfil quitada.');toast('Foto de perfil quitada.');
  }
  // v48: fotos por día. La base aplica el límite (si está activo); acá solo se avisa antes de subir y se ofrece
  // el video voluntario. El formulario nunca se borra y la foto no se publica sola después del video.
  async function photoGate(statusId){
    let q;try{const r=await client.rpc('my_photo_quota');if(r.error||!r.data)return true;q=r.data;}catch{return true;}
    if(!q.enabled||q.posted<q.allowed)return true;
    if(q.plan==='plus'){setStatus(statusId,'Llegaste al máximo de fotos de hoy. Tu publicación sigue en el formulario: podés publicarla mañana.');return false;}
    const ent=window.FittFormaAds?.entitlements?.(),canVideo=Boolean(ent?.ads?.rewardedAvailable)&&(ent?.photos?.extraLeft??0)>0;
    if(!canVideo){setStatus(statusId,'Ya publicaste las fotos gratuitas de hoy. Tu publicación sigue en el formulario: podés publicarla mañana.');return false;}
    setStatus(statusId,'Ya publicaste tus fotos gratuitas de hoy. Mirá un video voluntario para publicar una más; tu foto y tu texto siguen en el formulario.');
    if(await window.FittFormaAds.earnPhoto()){photoUnlocked=true;setStatus(statusId,'Listo: tocá «Publicar» para publicar tu foto.');}
    return false;
  }
  let photoUnlocked=false;
  const photoLimitError=error=>/photo_daily_limit/.test(String(error?.message||''));
  async function createPost(e){e.preventDefault();if(!authReady()){setStatus('communityPostStatus',authHint());return;}
    const beforeFile=$('communityBeforePhoto').files?.[0],afterFile=$('communityAfterPhoto').files?.[0],start=$('communityStartDate').value,end=$('communityEndDate').value;
    if(!beforeFile||!afterFile){setStatus('communityPostStatus','Elegí una foto de antes y una de después.');return;}
    if(!start||!end||end<start||end>localDateKey()){setStatus('communityPostStatus','Revisá las fechas: la final debe ser igual o posterior a la inicial y no futura.');return;}
    if(!(await photoGate('communityPostStatus')))return;
    const btn=$('communityPublish');btn.disabled=true;setStatus('communityPostStatus','Subiendo fotos…');let beforePath='',afterPath='';
    try{
      const postId=crypto.randomUUID();beforePath=await uploadImage(beforeFile,`${user.id}/${postId}/before.jpg`);afterPath=await uploadImage(afterFile,`${user.id}/${postId}/after.jpg`);
      const profile=await ensureProfile();const visibility=profile.visibility==='public'&&$('communityPostPublic').checked?'public':'followers';
      const {error}=await client.from('community_posts').insert({id:postId,user_id:user.id,description:$('communityPostDescription').value.trim(),exercises_text:$('communityPostExercises').value.trim(),nutrition_text:$('communityPostNutrition').value.trim(),running_text:$('communityPostRunning').value.trim(),start_date:start,end_date:end,before_path:beforePath,after_path:afterPath,visibility});
      if(error)throw error;if(photoUnlocked){photoUnlocked=false;window.FittFormaAds?.refresh?.(true);fetch('/api/metrics',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'photo_after_reward'})}).catch(()=>{});}$('communityPostForm').reset();setStatus('communityPostStatus','¡Antes y después publicado!');toast('Publicado en tu perfil.');showCommunitySubView('profile');
    }catch(error){if(beforePath||afterPath){try{await client.storage.from(bucket).remove([beforePath,afterPath].filter(Boolean));}catch{}}if(photoLimitError(error)){setStatus('communityPostStatus','Ya publicaste las fotos de hoy. Tu publicación sigue en el formulario.');photoGate('communityPostStatus');return;}setStatus('communityPostStatus',`No se pudo publicar: ${error.message||'revisá las políticas de Supabase.'}`);}
    finally{btn.disabled=false;}
  }
  // Me gusta y guardar: se actualiza solo el botón (sin volver a dibujar el feed) y solo después de que la base confirma.
  async function toggleLike(postId,button){if(!authReady())return alert(tr(authHint()));const {data,error}=await client.from('community_likes').select('post_id').eq('post_id',postId).eq('user_id',user.id).maybeSingle();if(error){status(error.message);return;}const result=data?await client.from('community_likes').delete().eq('post_id',postId).eq('user_id',user.id):await client.from('community_likes').insert({post_id:postId,user_id:user.id});if(result.error){status(`No se pudo actualizar el me gusta: ${result.error.message}`);return;}
    const on=!data;document.querySelectorAll(`[data-community-like="${CSS.escape(postId)}"]`).forEach(b=>{b.classList.toggle('is-on',on);b.setAttribute('aria-pressed',String(on));b.setAttribute('aria-label',tr(on?'Quitar me gusta':'Me gusta'));const c=b.querySelector('[data-like-count]');if(c)c.textContent=String(Math.max(0,(Number(c.textContent)||0)+(on?1:-1)));});if(!button)await refreshPosts();}
  async function toggleSave(postId){if(!authReady())return alert(tr(authHint()));const on=!document.querySelector(`[data-community-save="${CSS.escape(postId)}"]`)?.classList.contains('is-on');const result=on?await client.from('community_saved_posts').insert({user_id:user.id,post_id:postId}):await client.from('community_saved_posts').delete().eq('user_id',user.id).eq('post_id',postId);if(result.error){status(friendlySupabaseError(result.error,'guardar la publicación'));return;}document.querySelectorAll(`[data-community-save="${CSS.escape(postId)}"]`).forEach(b=>{b.classList.toggle('is-on',on);b.setAttribute('aria-pressed',String(on));b.setAttribute('aria-label',tr(on?'Quitar de guardadas':'Guardar'));});toast(on?'Publicación guardada.':'Publicación quitada de guardadas.');if(currentSubView==='profile'&&ownTab==='saved')renderOwnGrid();}
  async function sharePost(postId){const article=document.querySelector(`[data-community-post="${CSS.escape(postId)}"]`),author=article?.querySelector('.community-author small')?.textContent?.split('·')[0]?.trim()||'',text=(article?.querySelector('[data-community-post-text]')?.textContent||'').slice(0,140);const url=location.origin+location.pathname;const data={title:'FittForma AI · Comunidad',text:`${author?`${author} en FittForma AI`:'Una publicación en FittForma AI'}${text?`: «${text}»`:''}`,url};try{if(navigator.share){await navigator.share(data);return;}await navigator.clipboard.writeText(`${data.text} ${url}`);toast('Texto y enlace copiados para compartir.');}catch(error){if(error?.name!=='AbortError')toast('No se pudo compartir desde este navegador.');}}
  async function addComment(postId,body){if(!authReady())return alert(tr(authHint()));const text=String(body||'').trim();if(!text||text.length>500)return;const {error}=await client.from('community_comments').insert({post_id:postId,user_id:user.id,body:text});if(error)status(`No se pudo comentar: ${error.message}`);else await refreshPosts();}
  async function toggleFollow(target,button){if(!authReady())return alert(tr(authHint()));if(target===user.id)return;const {data,error}=await client.from('community_follows').select('follower_id,following_id,status').eq('follower_id',user.id).eq('following_id',target).maybeSingle();if(error){status(error.message);return;}let result;if(data)result=await client.from('community_follows').delete().eq('follower_id',user.id).eq('following_id',target);else{
      // La base de datos decide si el seguimiento queda aceptado o pendiente según la privacidad.
      result=await client.from('community_follows').insert({follower_id:user.id,following_id:target,status:'pending'}).select('status').single();
    }if(result.error)status(`No se pudo actualizar el seguimiento: ${result.error.message}`);else{if(!data&&button)button.textContent=result.data?.status==='accepted'?'Siguiendo':'Solicitud enviada';refreshOwnCounts();if(currentSubView==='user')await openUser(target);else if(currentSubView==='friends')loadFriends(true);}}
  async function blockUser(target){
    if(!authReady())return alert(tr(authHint()));if(!target||target===user.id)return;
    if(!confirm(tr('¿Bloquear a esta persona? Dejarán de verse entre ustedes en la comunidad, se eliminará el seguimiento mutuo y no podrán enviarse mensajes. Podés desbloquearla desde tu perfil.')))return;
    const {error}=await client.from('community_blocks').insert({blocker_id:user.id,blocked_id:target});
    if(error){status(error.message.includes('duplicate')?'Esta persona ya está bloqueada.':`No se pudo bloquear: ${error.message}`);return;}
    status('Usuario bloqueado. El seguimiento entre ambas cuentas fue eliminado.');
    if(currentSubView==='user'||currentSubView==='compare')showCommunitySubView(lastTab||'world');
    await Promise.all([loadBlockedUsers(),loadCurrentView(),loadChatContacts()]);
  }
  async function loadBlockedUsers(){
    const root=$('communityBlockedList');if(!root)return;
    if(!authReady()){root.textContent='Iniciá sesión para administrar los bloqueos.';return;}
    const {data,error}=await client.from('community_blocks').select('blocked_id,blocked_username,blocked_display_name,created_at').eq('blocker_id',user.id).order('created_at',{ascending:false}).limit(100);
    if(error){root.textContent='No se pudieron cargar los bloqueos. Aplicá la actualización v40 del esquema de Supabase.';return;}
    if(!data?.length){root.textContent='No bloqueaste a nadie.';return;}
    root.innerHTML=data.map(row=>`<div class="community-comment"><span>${esc(row.blocked_display_name||'Usuario bloqueado')} <small class="muted">@${esc(row.blocked_username||row.blocked_id.slice(0,8)+'…')}</small></span><button class="btn ghost" type="button" data-community-unblock="${esc(row.blocked_id)}">Desbloquear</button></div>`).join('');
    root.querySelectorAll('[data-community-unblock]').forEach(b=>b.addEventListener('click',()=>unblockUser(b.dataset.communityUnblock)));
  }
  async function unblockUser(target){
    if(!authReady()||!target)return;
    if(!confirm(tr('¿Desbloquear a este usuario? No se restaurará el seguimiento anterior automáticamente.')))return;
    const {error}=await client.from('community_blocks').delete().eq('blocker_id',user.id).eq('blocked_id',target);
    if(error){setStatus('communityProfileStatus',`No se pudo desbloquear: ${error.message}`);return;}
    setStatus('communityProfileStatus','Usuario desbloqueado. El seguimiento no se restaura automáticamente.');
    await Promise.all([loadBlockedUsers(),loadChatContacts()]);
  }
  async function deleteConversation(){
    if(!authReady())return;const target=$('communityChatContact')?.value;if(!target)return setStatus('communityChatStatus','Elegí una conversación primero.');
    if(!confirm(tr('¿Eliminar todos los mensajes de esta conversación para ambas personas? Esta acción no se puede deshacer.')))return;
    const {error}=await client.from('community_messages').delete().or(`and(sender_id.eq.${user.id},recipient_id.eq.${target}),and(sender_id.eq.${target},recipient_id.eq.${user.id})`);
    if(error){setStatus('communityChatStatus',`No se pudo borrar la conversación: ${error.message}`);return;}
    setStatus('communityChatStatus','Conversación eliminada para ambas personas.');await loadMessages();
  }
  async function deletePost(id){if(!confirm(tr('¿Eliminar esta publicación? También se borran sus fotos, me gusta y comentarios.')))return;const {data,error}=await client.from('community_posts').select('before_path,after_path'+(schemaV41?',image_path':'')).eq('id',id).eq('user_id',user.id).maybeSingle();if(error||!data){status(error?.message||'No se encontró la publicación.');return;}const {error:delError}=await client.from('community_posts').delete().eq('id',id).eq('user_id',user.id);if(delError){status(delError.message);return;}const paths=[data.before_path,data.after_path,data.image_path].filter(Boolean);if(paths.length)await client.storage.from(bucket).remove(paths);$('communityPostDialog')?.close?.();await refreshPosts();refreshOwnCounts();}
  async function reportPost(id){if(!authReady())return alert(tr(authHint()));const reason=String(prompt(tr('Motivo de la denuncia (spam, acoso, contenido inapropiado, otro):'))??'').trim();if(!reason)return;const {error}=await client.from('community_reports').insert({reporter_id:user.id,post_id:id,reason:reason.trim().slice(0,300)});if(error)status(error.code==='23505'?'Ya enviaste una denuncia por esta publicación.':`No se pudo enviar la denuncia: ${error.message}`);else status('Denuncia enviada. Gracias por ayudar a cuidar la comunidad.');}
  async function deleteComment(id){if(!confirm(tr('¿Borrar tu comentario?')))return;const {error}=await client.from('community_comments').delete().eq('id',id).eq('user_id',user.id);if(error)status(error.message);else await refreshPosts();}
  function achievementCard(a){
    const E=window.FittFormaBadgeEngine,level=Math.min(15,Math.max(1,Number(a?.level)||1));
    const rank=E?E.rankForLevel(level-1):{label:String(a?.rank||''),key:String(a?.rank||'bronze'),numeral:''};
    const medal=E?E.medalSvg({rankKey:rank.key,numeral:rank.numeral,glyph:E.glyphFor({id:a?.exerciseId,name:a?.exerciseName,category:a?.category,measure:a?.measure}),category:a?.category,size:56,title:rank.label}):'';
    const goal=E?E.formatValue(a?.threshold,a?.measure):String(a?.threshold??'');
    const gps=a?.evidence==='gps_device';
    return `<div class="community-achievement">${medal}<div class="community-achievement-copy"><small>Insignia obtenida</small><strong>${esc(a?.exerciseName||'Desafío')} · ${esc(rank.label)}</strong><span>Meta del nivel: ${esc(goal)} · ${esc(dateLabel(a?.earnedAt))}</span><span class="ff-evidence ${gps?'is-gps':''}">${gps?'Ruta GPS según el dispositivo del autor':a?.evidence==='session'?'Registrada en una sesión del autor':'Declarada por el autor'}</span></div></div>`;
  }
  function startEditPost(button){
    const id=button.dataset.communityEditPost,article=button.closest('[data-community-post]');if(!article||article.querySelector('.community-edit-form'))return;
    button.closest('details')?.removeAttribute('open');
    const textEl=article.querySelector('[data-community-post-text]'),current=textEl?textEl.textContent:'';
    const form=document.createElement('form');form.className='community-edit-form';
    form.innerHTML=`<label class="sr-only" for="edit-${esc(id)}">Editar texto</label><textarea id="edit-${esc(id)}" maxlength="1200" rows="3"></textarea><div class="btn-row"><button class="btn" type="submit">Guardar</button><button class="btn ghost" type="button" data-cancel>Cancelar</button></div>`;
    form.querySelector('textarea').value=current;
    const body=article.querySelector('.community-post-body');body.appendChild(form);if(textEl)textEl.hidden=true;form.querySelector('textarea').focus();
    form.querySelector('[data-cancel]').addEventListener('click',()=>{form.remove();if(textEl)textEl.hidden=false;});
    form.addEventListener('submit',async e=>{
      e.preventDefault();const value=form.querySelector('textarea').value.trim();
      if(button.dataset.kind==='text'&&!value){status('El texto de una publicación no puede quedar vacío.');return;}
      const save=form.querySelector('button[type="submit"]');save.disabled=true;
      const {error}=await client.from('community_posts').update({description:value}).eq('id',id).eq('user_id',user.id);
      save.disabled=false;
      if(error){status(friendlySupabaseError(error,'editar la publicación'));return;}
      status('Publicación actualizada.');await refreshPosts();
    });
  }
  function shareableBadges(){try{return typeof window.FittFormaShareableBadges==='function'?window.FittFormaShareableBadges():[];}catch(error){console.error('No se pudieron leer las insignias locales:',error);return [];}}
  function recentSessions(){try{return typeof window.FittFormaRecentSessions==='function'?window.FittFormaRecentSessions():[];}catch{return [];}}
  function updateKindAvailability(){
    const notice=$('communityKindNotice');if(!notice)return;
    const blocked=schemaV41===false&&postKind!=='transformation';
    notice.hidden=!blocked;notice.textContent=blocked?MIGRATION_HINT:'';
    ['communityTextPublish','communityAchievementPublish'].forEach(id=>{const b=$(id);if(b)b.disabled=!authReady()||schemaV41===false;});
  }
  function fillAchievementOptions(){
    const select=$('communityAchievementSelect');if(!select)return;
    const list=shareableBadges(),old=select.value;
    select.innerHTML=list.length?list.map(b=>`<option value="${esc(b.key)}">${esc(b.label)}</option>`).join(''):'<option value="">Todavía no tenés insignias para compartir</option>';
    if(list.some(b=>b.key===old))select.value=old;
  }
  function fillSessionOptions(){
    const select=$('communityLinkSession');if(!select)return;const old=select.value,list=recentSessions();
    select.closest('.field').hidden=schemaV49===false;
    select.innerHTML='<option value="">No vincular</option>'+list.map(s=>`<option value="${esc(s.key)}">${esc(s.label)}</option>`).join('');
    if(list.some(s=>s.key===old))select.value=old;
  }
  function renderPostPreview(){
    const root=$('communityPostPreview');if(!root)return;
    const audience=ownVisibility==='public'?'Visible para cualquier persona (perfil público)':'Visible solo para tus seguidores aceptados (perfil privado)';
    let inner='';
    if(postKind==='text'){
      const text=$('communityTextBody')?.value.trim()||'',file=$('communityTextImage')?.files?.[0],linked=recentSessions().find(s=>s.key===$('communityLinkSession')?.value);
      if($('communityTextCount'))$('communityTextCount').textContent=String(($('communityTextBody')?.value||'').length);
      if($('communityTextConsentRow'))$('communityTextConsentRow').hidden=!file;
      inner=text||file||linked?`${text?`<p>${richText(text)}</p>`:''}${file?'<p class="muted small">Incluye 1 foto (recomprimida y sin metadatos).</p>':''}${linked?linkedSessionHtml(linked.payload):''}`:'<p class="muted small">Escribí algo para ver la vista previa.</p>';
    }else if(postKind==='achievement'){
      const b=shareableBadges().find(x=>x.key===$('communityAchievementSelect')?.value),comment=$('communityAchievementComment')?.value.trim()||'';
      inner=b?`${achievementCard(b.payload)}${comment?`<p>${esc(comment)}</p>`:''}`:'<p class="muted small">Cuando obtengas una insignia en Progreso › Insignias vas a poder compartirla acá.</p>';
    }else inner='<p class="muted small">Se publican las dos fotos, las fechas y los textos que completes.</p>';
    root.innerHTML=`<div class="community-preview-head"><strong>Vista previa</strong><span class="muted small">${esc(audience)}</span></div>${inner}`;
  }
  function setPostKind(kind){
    postKind=['text','achievement','transformation'].includes(kind)?kind:'text';
    document.querySelectorAll('[data-post-kind]').forEach(b=>{const on=b.dataset.postKind===postKind;b.classList.toggle('active',on);b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;});
    document.querySelectorAll('[data-post-form]').forEach(f=>{f.hidden=f.dataset.postForm!==postKind;});
    if(postKind==='achievement')fillAchievementOptions();
    updateKindAvailability();renderPostPreview();setStatus('communityComposeStatus','');
  }
  async function createKindPost(e){
    e.preventDefault();
    if(!authReady()){setStatus('communityComposeStatus',authHint());return;}
    if(schemaV41===false){setStatus('communityComposeStatus',MIGRATION_HINT);return;}
    const button=postKind==='text'?$('communityTextPublish'):$('communityAchievementPublish');
    // El id se genera una sola vez por intento: un reintento del mismo insert choca con la clave primaria.
    const postId=crypto.randomUUID();let imagePath=null;
    button.disabled=true;setStatus('communityComposeStatus','Publicando…');
    try{
      const profile=await ensureProfile();const visibility=profile.visibility==='public'?'public':'followers';
      let row;
      if(postKind==='text'){
        const body=$('communityTextBody').value.trim(),file=$('communityTextImage').files?.[0],linked=recentSessions().find(s=>s.key===$('communityLinkSession')?.value);
        if(!body)throw new Error('Escribí el texto de la publicación.');
        if(file){if(!$('communityTextPhotoConsent').checked)throw new Error('Confirmá que tenés derecho a publicar la foto.');if(!(await photoGate('communityComposeStatus'))){button.disabled=false;return;}setStatus('communityComposeStatus','Subiendo foto…');imagePath=await uploadImage(file,`${user.id}/${postId}/image.jpg`);}
        row={id:postId,user_id:user.id,post_kind:'text',description:body,image_path:imagePath,visibility};
        if(linked&&schemaV49!==false)row.linked_session=linked.payload;
      }else{
        const badge=shareableBadges().find(x=>x.key===$('communityAchievementSelect').value);
        if(!badge)throw new Error('Elegí una insignia para compartir.');
        row={id:postId,user_id:user.id,post_kind:'achievement',description:$('communityAchievementComment').value.trim(),achievement:badge.payload,visibility};
      }
      // Recién cuando la base confirma el guardado se muestra como publicada.
      const {error}=await client.from('community_posts').insert(row);
      if(error)throw error;
      if(imagePath&&photoUnlocked){photoUnlocked=false;window.FittFormaAds?.refresh?.(true);fetch('/api/metrics',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'photo_after_reward'})}).catch(()=>{});}
      (postKind==='text'?$('communityTextPostForm'):$('communityAchievementPostForm')).reset();
      setStatus('communityComposeStatus','Publicado.');toast('Publicación guardada.');renderPostPreview();showCommunitySubView('profile');refreshOwnCounts();
    }catch(error){
      if(imagePath){try{await client.storage.from(bucket).remove([imagePath]);}catch(cleanupError){console.warn('No se pudo limpiar la foto subida:',cleanupError);}}
      if(photoLimitError(error)){setStatus('communityComposeStatus','Ya publicaste las fotos de hoy. Tu publicación sigue en el formulario.');photoGate('communityComposeStatus');return;}
      if(String(error?.code)==='23514'&&postKind==='achievement'){setStatus('communityComposeStatus','La base de datos rechazó esta insignia: falta aplicar en Supabase la migración supabase/migrations/2026-10-22_v49_badges.sql (acepta las insignias de entrenamientos, rachas y peso corporal).');return;}
      setStatus('communityComposeStatus',error?.code?friendlySupabaseError(error,'publicar'):`No se pudo publicar: ${error.message}`);
    }finally{button.disabled=!authReady()||schemaV41===false;}
  }

  // ---------- Mensajes ----------
  async function loadUnread(){
    const badge=$('communityUnreadBadge');
    if(!authReady()||schemaV41===false){if(badge)badge.hidden=true;window.dispatchEvent(new CustomEvent('fittforma:unread',{detail:{total:0}}));return;}
    const {data,error}=await client.from('community_messages').select('sender_id').eq('recipient_id',user.id).is('read_at',null).limit(500);
    if(error){if(isMissingColumn(error)){markLegacySchema();updateKindAvailability();}else console.warn('No se pudieron contar los mensajes no leídos:',error.message);if(badge)badge.hidden=true;return;}
    const bySender={};(data||[]).forEach(m=>{bySender[m.sender_id]=(bySender[m.sender_id]||0)+1;});
    const total=(data||[]).length;window.dispatchEvent(new CustomEvent('fittforma:unread',{detail:{total}}));
    if(badge){badge.hidden=!total;badge.textContent=total>99?'99+':String(total);badge.setAttribute('aria-label',tr(`${total} mensaje(s) sin leer`));}
    document.querySelectorAll('#communityChatContact option').forEach(o=>{if(!o.value)return;if(!o.dataset.base)o.dataset.base=o.textContent;const n=bySender[o.value]||0;o.textContent=o.dataset.base+(n?` · ${n} sin leer`:'');});
  }
  async function markConversationRead(target){
    if(!authReady()||!target||schemaV41===false)return;
    const {error}=await client.from('community_messages').update({read_at:new Date().toISOString()}).eq('recipient_id',user.id).eq('sender_id',target).is('read_at',null);
    if(error&&!isMissingColumn(error))console.warn('No se pudieron marcar los mensajes como leídos:',error.message);
    await loadUnread();
  }
  // v43: moderación. Solo visible si la base confirma que la cuenta es moderadora (RLS en el servidor).
  async function loadModeration(){
    const card=$('communityModerationCard'),root=$('communityReportsList');if(!card||!root)return;
    if(!authReady()){card.hidden=true;return;}
    const check=await client.rpc('community_is_moderator');
    if(check.error||check.data!==true){card.hidden=true;if(check.error&&!/community_is_moderator|PGRST202|42883/i.test(String(check.error.message)+String(check.error.code)))console.warn('No se pudo comprobar el rol de moderación:',check.error.message);return;}
    card.hidden=false;root.textContent='Cargando denuncias…';
    const {data:reports,error}=await client.from('community_reports').select('id,post_id,reason,created_at,status').eq('status','open').order('created_at',{ascending:true}).limit(50);
    if(error){root.textContent=friendlySupabaseError(error,'cargar las denuncias');return;}
    if(!reports?.length){root.textContent='No hay denuncias abiertas.';return;}
    const ids=[...new Set(reports.map(r=>r.post_id))];
    const posts=await client.from('community_posts').select('id,user_id,description,post_kind,created_at').in('id',ids);
    const byId=new Map((posts.data||[]).map(p=>[p.id,p]));
    const authors=[...new Set((posts.data||[]).map(p=>p.user_id))];
    const profs=authors.length?await client.from('community_profiles').select('user_id,username,display_name').in('user_id',authors):{data:[]};
    const who=new Map((profs.data||[]).map(p=>[p.user_id,p]));
    root.innerHTML=reports.map(r=>{const post=byId.get(r.post_id),a=post?who.get(post.user_id):null;return `<div class="community-report"><strong>${esc(r.reason)}</strong><div class="muted small">${esc(dateLabel(String(r.created_at).slice(0,10)))} · ${post?`${esc(post.post_kind||'transformation')} de @${esc(a?.username||'usuario')}`:'publicación no disponible'}</div>${post?.description?`<p>${esc(post.description.slice(0,280))}</p>`:''}<div class="btn-row"><button class="btn ghost btn-sm" type="button" data-report-dismiss="${esc(r.id)}">Descartar</button>${post?`<button class="btn danger btn-sm" type="button" data-report-remove="${esc(post.id)}">Eliminar publicación</button>`:''}</div></div>`;}).join('');
  }
  async function moderationAction(e){
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.reportDismiss){b.disabled=true;const {data:changed,error}=await client.from('community_reports').update({status:'dismissed'}).eq('id',b.dataset.reportDismiss).select('id');if(error||!changed?.length){setStatus('communityProfileStatus',error?friendlySupabaseError(error,'descartar la denuncia'):'No se pudo descartar: la denuncia ya no está disponible o no tenés permiso.');b.disabled=false;return;}await loadModeration();}
    else if(b.dataset.reportRemove){
      if(!confirm(tr('¿Eliminar esta publicación para todos? También se borran sus fotos, comentarios y me gusta.')))return;b.disabled=true;
      const id=b.dataset.reportRemove,{data}=await client.from('community_posts').select('before_path,after_path,image_path').eq('id',id).maybeSingle();
      // Primero queda registrado que se actuó (las denuncias se conservan sin la publicación; migración v44).
      const marked=await client.from('community_reports').update({status:'actioned'}).eq('post_id',id).eq('status','open').select('id');
      if(marked.error){setStatus('communityProfileStatus',friendlySupabaseError(marked.error,'registrar la resolución'));b.disabled=false;return;}
      const {data:removed,error}=await client.from('community_posts').delete().eq('id',id).select('id');
      if(error||!removed?.length){setStatus('communityProfileStatus',error?friendlySupabaseError(error,'eliminar la publicación'):'No se pudo eliminar la publicación (sin permiso o ya no existe).');b.disabled=false;return;}
      const paths=[data?.before_path,data?.after_path,data?.image_path].filter(Boolean);if(paths.length){const r=await client.storage.from(bucket).remove(paths);if(r.error)console.warn('No se pudieron borrar las fotos de la publicación eliminada:',r.error.message);}
      await loadModeration();await refreshPosts();
    }
  }
  function bindFeedActions(root=$('communityFeed')){
    if(!root)return;
    root.querySelectorAll('[data-community-like]').forEach(b=>b.addEventListener('click',()=>toggleLike(b.dataset.communityLike,b)));
    root.querySelectorAll('[data-community-save]').forEach(b=>b.addEventListener('click',()=>toggleSave(b.dataset.communitySave)));
    root.querySelectorAll('[data-community-share]').forEach(b=>b.addEventListener('click',()=>sharePost(b.dataset.communityShare)));
    root.querySelectorAll('[data-community-focus-comment]').forEach(b=>b.addEventListener('click',()=>{const a=b.closest('[data-community-post]');a?.querySelectorAll('[data-older-comment]').forEach(c=>c.hidden=false);a?.querySelector('[data-community-show-comments]')?.remove();a?.querySelector('.community-comment-form input')?.focus();}));
    root.querySelectorAll('[data-community-show-comments]').forEach(b=>b.addEventListener('click',()=>{b.closest('.community-comments')?.querySelectorAll('[data-older-comment]').forEach(c=>c.hidden=false);b.remove();}));
    root.querySelectorAll('[data-community-follow]').forEach(b=>b.addEventListener('click',()=>toggleFollow(b.dataset.communityFollow,b)));
    root.querySelectorAll('[data-community-open-user]').forEach(b=>b.addEventListener('click',()=>openUser(b.dataset.communityOpenUser)));
    root.querySelectorAll('[data-community-block]').forEach(b=>b.addEventListener('click',()=>blockUser(b.dataset.communityBlock)));
    root.querySelectorAll('[data-community-edit-post]').forEach(b=>b.addEventListener('click',()=>startEditPost(b)));
    root.querySelectorAll('[data-community-go]').forEach(b=>b.addEventListener('click',()=>showCommunitySubView(b.dataset.communityGo)));
    root.querySelectorAll('[data-community-delete-post]').forEach(b=>b.addEventListener('click',()=>deletePost(b.dataset.communityDeletePost)));
    root.querySelectorAll('[data-community-report]').forEach(b=>b.addEventListener('click',()=>{b.closest('details')?.removeAttribute('open');reportPost(b.dataset.communityReport);}));
    root.querySelectorAll('[data-community-delete-comment]').forEach(b=>b.addEventListener('click',()=>deleteComment(b.dataset.communityDeleteComment)));
    root.querySelectorAll('[data-community-comment-form]').forEach(form=>form.addEventListener('submit',e=>{e.preventDefault();const input=form.elements.body;addComment(form.dataset.communityCommentForm,input.value);}));
  }
  async function loadChatContacts(){
    const select=$('communityChatContact');if(!select)return;
    if(!authReady()){select.innerHTML='<option value="">Iniciá sesión para chatear</option>';setStatus('communityChatStatus','Iniciá sesión para usar los mensajes privados.');if($('communityConversations'))$('communityConversations').innerHTML='';return;}
    setStatus('communityChatStatus','Buscando contactos que se siguen mutuamente…');
    const [outgoing,incoming]=await Promise.all([
      client.from('community_follows').select('following_id,community_profiles!community_follows_following_id_fkey(user_id,display_name,username,avatar_path)').eq('follower_id',user.id).eq('status','accepted').limit(500),
      client.from('community_follows').select('follower_id,community_profiles!community_follows_follower_id_fkey(user_id,display_name,username,avatar_path)').eq('following_id',user.id).eq('status','accepted').limit(500)
    ]);
    if(outgoing.error||incoming.error){setStatus('communityChatStatus','No se pudieron cargar contactos. Aplicá la actualización v40 del esquema de Supabase.');return;}
    const follows=new Set((outgoing.data||[]).map(x=>x.following_id));
    const mutual=(incoming.data||[]).filter(x=>follows.has(x.follower_id)).map(x=>({id:x.follower_id,profile:Array.isArray(x.community_profiles)?x.community_profiles[0]:x.community_profiles}));
    mutualContacts=new Map(mutual.map(x=>[x.id,x.profile]));
    const old=select.value;select.innerHTML='<option value="">Elegí un contacto mutuo</option>'+mutual.map(x=>`<option value="${esc(x.id)}">${esc(x.profile?.display_name||x.profile?.username||'Usuario')} (@${esc(x.profile?.username||'usuario')})</option>`).join('');
    if(mutual.some(x=>x.id===old))select.value=old;
    setStatus('communityChatStatus',mutual.length?`${mutual.length} contacto(s) disponible(s). El chat se habilita solo con seguimiento mutuo aceptado.`:'Todavía no tenés contactos con seguimiento mutuo aceptado.');
    await loadConversations();
    if(select.value&&!$('communityChatView')?.hidden)await loadMessages();else await loadUnread();
  }
  let mutualContacts=new Map();
  // Lista de conversaciones con el último mensaje (función de la base, bajo RLS). Sin la migración v49 se muestran
  // los contactos mutuos sin vista previa.
  async function loadConversations(){
    const root=$('communityConversations');if(!root||!authReady())return;
    let rows=[];const r=await client.rpc('community_conversations');
    if(!r.error)rows=r.data||[];else if(!isMissingFunction(r.error))console.warn('No se pudieron cargar las conversaciones:',r.error.message);
    const listed=new Set(rows.map(x=>x.partner_id));
    for(const [id,p] of mutualContacts)if(!listed.has(id))rows.push({partner_id:id,username:p?.username,display_name:p?.display_name,avatar_path:p?.avatar_path,last_body:'',last_at:null,last_from_me:false,unread:0});
    const urlOf=await signedMany(rows.map(x=>x.avatar_path));
    root.innerHTML=rows.length?rows.map(c=>`<button type="button" class="community-conversation${c.unread?' has-unread':''}" data-community-chat="${esc(c.partner_id)}">${avatarHtml(c,urlOf)}<span class="community-conversation-copy"><strong>${esc(c.display_name||c.username||'Usuario')}</strong><small>${c.last_body?`${c.last_from_me?'Vos: ':''}${esc(c.last_body)}`:'Sin mensajes todavía'}</small></span><span class="community-conversation-meta">${c.last_at?`<small>${esc(timeAgo(c.last_at))}</small>`:''}${c.unread?`<b aria-label="${c.unread} sin leer">${c.unread}</b>`:''}</span></button>`).join(''):'<div class="empty"><strong>Sin conversaciones</strong><p>El chat se habilita cuando ambas personas se siguen.</p></div>';
    root.querySelectorAll('[data-community-chat]').forEach(b=>b.addEventListener('click',()=>openChat(b.dataset.communityChat)));
  }
  async function openChat(target){
    if(!target)return;const who=$('communityChatWho');if(who)who.dataset.uid=target;const select=$('communityChatContact');if(select&&select.value!==target)select.value=target;
    const p=mutualContacts.get(target);
    $('communityChatListView').hidden=true;$('communityChatView').hidden=false;
    $('communityChatName').textContent=p?.display_name||p?.username||'Conversación';
    const urlOf=p?.avatar_path?await signedMany([p.avatar_path]):null;$('communityChatAvatar').outerHTML=avatarHtml(p,urlOf,'sm').replace('<span class="community-avatar','<span id="communityChatAvatar" class="community-avatar');
    await loadMessages();startChatPoll();
  }
  function closeChat(){stopChatPoll();$('communityChatView').hidden=true;$('communityChatListView').hidden=false;loadConversations();}
  // Mientras el chat está abierto y visible se consultan mensajes nuevos cada 8 s (no hay tiempo real).
  function startChatPoll(){stopChatPoll();chatPoll=setInterval(()=>{if(document.visibilityState==='visible'&&currentSubView==='messages'&&!$('communityChatView')?.hidden)loadMessages(true);},8000);}
  function stopChatPoll(){if(chatPoll){clearInterval(chatPoll);chatPoll=null;}}
  async function loadMessages(quiet=false){
    const target=$('communityChatContact')?.value,root=$('communityChatMessages');if(!root)return;
    if(!authReady()||!target){root.innerHTML='<p class="muted small">Elegí un contacto mutuo.</p>';return;}
    const {data,error}=await client.from('community_messages').select('id,sender_id,recipient_id,body,created_at').or(`and(sender_id.eq.${user.id},recipient_id.eq.${target}),and(sender_id.eq.${target},recipient_id.eq.${user.id})`).order('created_at',{ascending:true}).limit(200);
    if(error){root.innerHTML='<p class="muted small">No se pudo abrir el chat. Comprobá que ejecutaste la actualización v40 del esquema de Supabase.</p>';setStatus('communityChatStatus',error.message);return;}
    const html=(data||[]).map(m=>`<div class="community-chat-message ${m.sender_id===user.id?'mine':''}">${esc(m.body)}<small>${esc(new Date(m.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}))}</small></div>`).join('')||'<p class="muted small">Todavía no hay mensajes. ¡Saludá!</p>';
    if(quiet&&root.dataset.last===String(data?.length||0))return;root.dataset.last=String(data?.length||0);
    root.innerHTML=html;root.scrollTop=root.scrollHeight;
    if((data||[]).some(m=>m.recipient_id===user.id))await markConversationRead(target);
  }
  async function sendMessage(e){
    e.preventDefault();if(!authReady()){setStatus('communityChatStatus',authHint());return;}
    const target=$('communityChatContact').value,body=$('communityChatText').value.trim();if(!target||!body)return;if(body.length>2000){setStatus('communityChatStatus','El mensaje no puede superar los 2000 caracteres.');return;}
    const now=Date.now();while(messageAttempts.length&&now-messageAttempts[0]>60000)messageAttempts.shift();if(messageAttempts.length>=10){setStatus('communityChatStatus','Límite de seguridad: esperá un minuto antes de enviar más mensajes.');return;}
    const btn=$('communityChatSend');btn.disabled=true;
    const {error}=await client.from('community_messages').insert({sender_id:user.id,recipient_id:target,body});
    btn.disabled=false;
    if(error){setStatus('communityChatStatus','No se pudo enviar. Revisá el seguimiento mutuo y los límites de mensajes. '+error.message);return;}
    messageAttempts.push(now);$('communityChatText').value='';setStatus('communityChatStatus','Mensaje enviado.');await loadMessages();
  }

  // ---------- Explorar ----------
  // ---------- v53: comunidad de deportistas ----------
  // Todos y Amigos (community_people), Ranking (community_leaderboard), perfil completo (community_athlete_profile)
  // y comparación. Todo sale de funciones del servidor: el cliente nunca lee la tabla de estadísticas de otra persona.
  // Si el proyecto todavía no aplicó la migración v53, se usa el directorio de v50 sin estadísticas.
  const AS=()=>window.FittFormaAthleteStats,MRK=()=>window.FittFormaMuscleRanks,BE=()=>window.FittFormaBadgeEngine;
  const LEVEL_LABEL={beginner:'Principiante',intermediate:'Intermedio',advanced:'Avanzado'};
  const V54_HINT='Comunidad se está actualizando y esta parte todavía no está disponible. Para quien administra la app: falta aplicar supabase/APLICAR_MIGRACIONES.sql en Supabase (SQL Editor).';
  const V53_HINT='Comunidad se está actualizando y esta parte todavía no está disponible. Para quien administra la app: falta aplicar supabase/APLICAR_MIGRACIONES.sql en Supabase (SQL Editor).';
  let athleteEnabled=null,viewedUser=null,compareUser=null;
  const LOCK_SVG='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
  function rankChip(i,size=26){const R=MRK();if(!R||!Number.isInteger(Number(i))||Number(i)<0||!R.RANKS[Number(i)])return '<span class="cm-rank is-none">Sin entrenar</span>';const r=R.RANKS[Number(i)];return `<span class="cm-rank" style="--rk:${esc(r.glow||r.color||'#8b9ab8')}">${R.emblemSvg(Number(i),size)}<b>${esc(r.name)}</b></span>`;}
  // v55: rango junto al nombre (emblema chico y nombre del rango).
  function rankMini(i){const R=MRK();const n=Number(i);if(!R||!Number.isInteger(n)||n<0||!R.RANKS[n])return '';const r=R.RANKS[n];return ` <span class="cm-rank cm-rank-mini" style="--rk:${esc(r.glow||r.color)}" title="Rango general: ${esc(r.name)}">${R.emblemSvg(n,18)}<b>${esc(r.name)}</b></span>`;}
  function levelLine(p){if(!p?.stats_visible)return '';return [LEVEL_LABEL[p.training_level]||'',p.xp_level?`Nivel ${Number(p.xp_level)}`:''].filter(Boolean).join(' · ');}
  function followLabel(fs,priv){return fs==='accepted'?'Siguiendo':fs==='pending'?'Solicitud enviada':priv?'Solicitar seguir':'Seguir';}
  function athleteCard(p,urlOf,opts={}){
    const uid=esc(p.user_id),name=esc(p.display_name||p.username),locked=p.can_view===false,fs=p.follow_status||'',meta=levelLine(p);
    const side=p.stats_visible?'':locked?`<small class="community-private-tag">${LOCK_SVG}Perfil privado</small>`:'<span class="cm-rank is-none">Sin estadísticas</span>';
    const latest=p.stats_visible&&p.latest_badge?.exerciseName?`<small class="cm-latest">Último logro: ${esc(p.latest_badge.exerciseName)}</small>`:'';
    const mutual=fs==='accepted'&&p.follows_me;
    const actions=[opts.position?`<span class="cm-pos" title="Puesto en el ranking de rango general entre tus amigos">#${Number(opts.position)} en rango</span>`:'',
      user&&!p.is_self?`<button class="btn btn-sm${fs?' secondary':''}" type="button" data-community-search-follow="${uid}">${followLabel(fs,p.visibility==='private')}</button>`:'',
      opts.compare&&user&&!p.is_self&&p.stats_visible?`<button class="btn ghost btn-sm" type="button" data-community-compare="${uid}">Comparar</button>`:''].filter(Boolean).join('');
    return `<article class="cm-card${locked?' is-private':''}${p.is_self?' is-self':''}"><button type="button" class="cm-card-open" data-community-open-user="${uid}" aria-label="Ver el perfil de ${name}">${avatarHtml(p,urlOf,'lg')}<span class="cm-card-id"><strong>${name} <span data-flag-for="${uid}"></span>${p.stats_visible?rankMini(p.overall_rank):''}</strong><small class="muted">@${esc(p.username)}${p.is_self?' · Vos':mutual?' · Se siguen':''}</small>${meta?`<small class="cm-card-level">${esc(meta)}</small>`:''}${latest}</span><span class="cm-card-side">${side}<span class="cm-card-badges">${featuredHtml(p.featured_badges,20)}</span></span></button>${actions?`<div class="cm-card-actions">${actions}</div>`:''}</article>`;
  }
  // Tarjeta del directorio de v50 (sin estadísticas), para proyectos sin la migración v53.
  function legacyToAthlete(p){return {...p,stats_visible:false,follows_me:false};}
  function bindPeople(root){
    root.querySelectorAll('[data-community-open-user]').forEach(b=>b.addEventListener('click',()=>openUser(b.dataset.communityOpenUser)));
    root.querySelectorAll('[data-community-search-follow]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();toggleFollow(b.dataset.communitySearchFollow,b);}));
    root.querySelectorAll('[data-community-compare]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();openCompare(b.dataset.communityCompare);}));
  }
  async function peopleRpc(scope,term,after,limit=20){
    if(athleteEnabled!==false){
      const r=await client.rpc('community_people',{p_search:term,p_after:after,p_limit:limit,p_scope:scope});
      if(!r.error){athleteEnabled=true;return r;}
      if(!isMissingFunction(r.error))return r;
      athleteEnabled=false;
    }
    if(scope==='friends')return {data:null,error:{message:V53_HINT,code:'V53'}};
    const r=await client.rpc('community_directory',{p_search:term,p_after:after,p_limit:limit});
    return r.error?r:{data:(r.data||[]).map(legacyToAthlete),error:null};
  }
  // Todos: usuarios reales, por @usuario, de a 20 (carga progresiva).
  let peopleAfter=null,peopleTerm='',peopleBusy=false,peopleQueued=false;
  async function loadDirectory(reset=true){
    const root=$('communityPeople'),more=$('communityPeopleMore');if(!root)return;
    if(!client){root.innerHTML='';setStatus('communityWorldStatus',authHint());return;}
    if(peopleBusy){peopleQueued=peopleQueued||reset;return;} // una búsqueda durante una carga se hace al terminar
    peopleBusy=true;
    if(reset){peopleAfter=null;root.innerHTML='<div class="cm-skeleton" aria-hidden="true"><i></i><i></i><i></i></div>';setStatus('communityWorldStatus','Cargando personas…');}
    try{
      const r=await peopleRpc('all',peopleTerm,peopleAfter,20);
      if(r.error){root.innerHTML='';setStatus('communityWorldStatus',friendlySupabaseError(r.error,'cargar personas'));return;}
      const list=r.data||[];const urlOf=await signedMany(list.map(x=>x.avatar_path));
      const html=list.map(p=>athleteCard(p,urlOf)).join('');
      if(reset)root.innerHTML=html||`<div class="empty"><strong>${peopleTerm?'No encontramos personas':'Todavía no hay otras personas'}</strong><p>${peopleTerm?'Probá con otro nombre o @usuario.':'Cuando más deportistas usen FittForma, van a aparecer acá.'}</p></div>`;else root.insertAdjacentHTML('beforeend',html);
      bindPeople(root);fillFlags(root);peopleAfter=list.length?list[list.length-1].username:peopleAfter;if(more)more.hidden=list.length<20;
      setStatus('communityPeopleHint',peopleTerm?`Resultados para «${peopleTerm}»`:'Usuarios reales de la app, por orden alfabético');
      setStatus('communityWorldStatus',athleteEnabled===false?'Las estadísticas de los perfiles requieren la actualización v53 de la base de datos.':user?'':'Iniciá sesión para seguir personas y ver perfiles privados que te acepten.');
      connectionStatus('Supabase responde correctamente: el directorio de Comunidad se pudo consultar.');
    }finally{peopleBusy=false;if(peopleQueued){peopleQueued=false;loadDirectory(true);}}
  }
  async function searchUsers(e){
    e.preventDefault();searchTerm=$('communitySearch').value.trim();
    if(!client){setStatus('communityWorldStatus',authHint());return;}
    peopleTerm=searchTerm.replace(/^[@#]/,'').replace(/[,%()]/g,'');loadSuggested();await loadDirectory(true);
  }
  // «Personas sugeridas» (perfiles públicos que todavía no seguís), arriba del directorio cuando no hay búsqueda.
  async function loadSuggested(){
    const wrap=$('communitySuggestedWrap'),root=$('communitySuggested');if(!wrap||!root||!client)return;
    if(!user||peopleTerm){wrap.hidden=true;return;}
    const r=await client.rpc('community_suggested_profiles');
    if(r.error||!r.data?.length){wrap.hidden=true;return;}
    const list=r.data.slice(0,10),urlOf=await signedMany(list.map(x=>x.avatar_path));
    root.innerHTML=list.map(p=>`<button type="button" class="cm-sugg" data-community-open-user="${esc(p.user_id)}">${avatarHtml(p,urlOf,'lg')}<strong>${esc(p.display_name||p.username)}</strong><small class="muted">@${esc(p.username)}</small></button>`).join('');
    wrap.hidden=false;bindPeople(root);
  }
  function clearSearch(){searchTerm='';peopleTerm='';$('communitySearch').value='';loadDirectory(true);}

  // Amigos: la relación de seguimiento existente (seguís a la persona y aceptó). Se marca si además te sigue.
  let friendsAfter=null,friendsBusy=false;
  async function loadFriends(reset=true){
    const root=$('communityFriends'),more=$('communityFriendsMore');if(!root)return;
    if(!client){root.innerHTML='';setStatus('communityFriendsStatus',authHint());return;}
    if(!user){root.innerHTML=`<div class="empty cm-empty"><strong>Iniciá sesión para ver a tus amigos</strong><p>Tus amigos son las personas que seguís en Comunidad.</p><button class="btn" type="button" data-community-go="profile">Iniciar sesión</button></div>`;bindGo(root);setStatus('communityFriendsStatus','');if(more)more.hidden=true;return;}
    if(friendsBusy)return;friendsBusy=true;
    if(reset){friendsAfter=null;root.innerHTML='<div class="cm-skeleton" aria-hidden="true"><i></i><i></i></div>';setStatus('communityFriendsStatus','Cargando amigos…');}
    try{
      const [r,board]=await Promise.all([peopleRpc('friends','',friendsAfter,20),reset?client.rpc('community_leaderboard',{p_category:'rank',p_scope:'friends',p_limit:100}):Promise.resolve({data:null})]);
      if(r.error){root.innerHTML='';setStatus('communityFriendsStatus',r.error.code==='V53'?V53_HINT:friendlySupabaseError(r.error,'cargar tus amigos'));return;}
      if(reset)friendPositions=new Map((board.data||[]).map(x=>[x.user_id,Number(x.pos)]));
      const list=r.data||[];const urlOf=await signedMany(list.map(x=>x.avatar_path));
      const html=list.map(p=>athleteCard(p,urlOf,{compare:true,position:friendPositions.get(p.user_id)})).join('');
      if(reset)root.innerHTML=html||`<div class="empty cm-empty"><svg class="cm-empty-art" viewBox="0 0 64 64" aria-hidden="true"><circle cx="24" cy="22" r="9"/><circle cx="43" cy="26" r="7"/><path d="M8 52c1.5-9 8-14 16-14s14.5 5 16 14M38 40c7 0 12 4 14 12"/></svg><strong>Todavía no tenés amigos en tu comunidad</strong><p>Seguí a otros deportistas para ver su progreso, compararte y competir en el ranking de amigos.</p><div class="btn-row"><button class="btn" type="button" data-community-go="world">Descubrir personas</button><button class="btn ghost" type="button" data-community-search-focus>Buscar a alguien</button></div></div>`;else root.insertAdjacentHTML('beforeend',html);
      bindPeople(root);bindGo(root);fillFlags(root);root.querySelector('[data-community-search-focus]')?.addEventListener('click',()=>{showCommunitySubView('world');$('communitySearch')?.focus();});
      friendsAfter=list.length?list[list.length-1].username:friendsAfter;if(more)more.hidden=list.length<20;
      setStatus('communityFriendsStatus',list.length&&reset?`${list.length}${list.length>=20?'+':''} amigo(s). Para escribirle a alguien, tienen que seguirse mutuamente.`:'');
    }finally{friendsBusy=false;}
  }
  let friendPositions=new Map();
  function bindGo(root){root.querySelectorAll('[data-community-go]').forEach(b=>b.addEventListener('click',()=>showCommunitySubView(b.dataset.communityGo)));}

  // Ranking: una categoría a la vez, con qué mide, el período y el orden. Las posiciones las calcula el servidor.
  let rankCategory='rank',rankScope='all',rankBusy=false,rankPeriod='30d';
  // v54: «Esta semana» (lunes a hoy) para constancia y running, con community_week_board.
  const WEEK_CAT={constancy:'active',running:'running'};
  const WEEK_TEXT={constancy:'Días distintos con al menos un entrenamiento o una actividad, de lunes a hoy. Se reinicia cada lunes.',running:'Kilómetros corridos registrados en la app de lunes a hoy (manual o con GPS). Se reinicia cada lunes.'};
  function formatMetric(cat,v){
    const n=Number(v);if(v==null||!Number.isFinite(n))return 'Sin datos disponibles';
    if(cat==='rank'){const r=MRK()?.RANKS?.[n];return r?r.name:'Sin entrenar';}
    if(cat==='constancy')return `${n} ${n===1?'día':'días'}`;
    if(cat==='badges')return `${n} ${n===1?'insignia':'insignias'}`;
    if(cat==='level')return `Nivel ${n}`;
    if(cat==='running')return `${n.toLocaleString(undefined,{maximumFractionDigits:1})} km`;
    if(cat==='plank'){const m=Math.floor(n/60),s=Math.round(n%60);return m?`${m} min ${String(s).padStart(2,'0')} s`:`${s} s`;}
    return `${n} rep`;
  }
  function renderRankingChips(){
    const root=$('rankingCategories');const S=AS();if(!root||!S)return;
    root.innerHTML=S.CATEGORIES.map(c=>`<button type="button" class="cm-chip${c.key===rankCategory?' is-active':''}" data-ranking-category="${esc(c.key)}" aria-pressed="${c.key===rankCategory}">${esc(c.label)}</button>`).join('');
    root.querySelectorAll('[data-ranking-category]').forEach(b=>b.addEventListener('click',()=>{rankCategory=b.dataset.rankingCategory;renderRankingChips();loadRanking();}));
    const c=S.CATEGORIES.find(x=>x.key===rankCategory),weekly=rankPeriod==='week'&&WEEK_CAT[rankCategory];
    const per=$('rankingPeriod');if(per){per.hidden=!WEEK_CAT[rankCategory];per.querySelectorAll('[data-ranking-period]').forEach(b=>{const on=b.dataset.rankingPeriod===rankPeriod;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});}
    $('rankingExplain').innerHTML=c?`<strong>${esc(c.label)}${weekly?' · Esta semana':''}</strong><p>${esc(weekly?WEEK_TEXT[rankCategory]:c.measures)}</p><dl><div><dt>Período</dt><dd>${esc(weekly?'Esta semana (de lunes a hoy)':c.period)}</dd></div><div><dt>Orden</dt><dd>${esc(c.order)}</dd></div><div><dt>Participan</dt><dd>${rankScope==='friends'?'Vos y las personas que seguís':'Perfiles que podés ver'} que muestran sus estadísticas.</dd></div></dl>`:'';
  }
  function rankRow(x,urlOf,podium=false){
    const name=esc(x.is_self?'Vos':(x.display_name||x.username)),uid=esc(x.user_id),pos=Number(x.pos)||0,lvl=LEVEL_LABEL[x.training_level]||'';
    const value=formatMetric(rankCategory,x.value);
    if(podium)return `<li class="cm-podium-step p${Math.min(pos,3)}${x.is_self?' is-self':''}"><button type="button" data-community-open-user="${uid}" aria-label="Puesto ${pos}: ${name}, ${esc(value)}">${avatarHtml(x,urlOf,'lg')}<span class="cm-podium-pos">${pos}</span><strong>${name}</strong><small>${esc(value)}</small></button></li>`;
    return `<li class="cm-board-row${x.is_self?' is-self':''}"><button type="button" data-community-open-user="${uid}" aria-label="Puesto ${pos}: ${name}, ${esc(value)}"><span class="cm-board-pos">${pos}</span>${avatarHtml(x,urlOf)}<span class="cm-board-who"><strong>${name} <span data-flag-for="${uid}"></span>${rankCategory==='rank'?'':rankMini(x.overall_rank)}</strong><small class="muted">@${esc(x.username)}${lvl?' · '+esc(lvl):''}</small></span><span class="cm-board-meta"><span class="cm-card-badges">${featuredHtml(x.featured_badges,16)}</span></span><b class="cm-board-value">${esc(value)}</b></button></li>`;
  }
  async function loadRanking(){
    renderRankingChips();const podium=$('rankingPodium'),list=$('rankingList');if(!podium||!list)return;
    if(!client){podium.innerHTML='';list.innerHTML='';setStatus('rankingStatus',authHint());return;}
    if(rankScope==='friends'&&!user){podium.innerHTML='';list.innerHTML='';setStatus('rankingStatus','Iniciá sesión para ver el ranking con tus amigos.');return;}
    if(rankBusy)return;rankBusy=true;setStatus('rankingStatus','Cargando ranking…');
    const cat=rankCategory,scope=rankScope;
    try{
      if(user)await syncStats();
      const weekly=rankPeriod==='week'&&WEEK_CAT[cat],period=rankPeriod;
      const r=weekly?await client.rpc('community_week_board',{p_category:WEEK_CAT[cat],p_scope:scope,p_limit:50}):await client.rpc('community_leaderboard',{p_category:cat,p_scope:scope,p_limit:50});
      if(cat!==rankCategory||scope!==rankScope||period!==rankPeriod)return;
      if(r.error){podium.innerHTML='';list.innerHTML='';setStatus('rankingStatus',isMissingFunction(r.error)?(weekly?V54_HINT:V53_HINT):friendlySupabaseError(r.error,'cargar el ranking'));return;}
      athleteEnabled=true;
      const rows=r.data||[];const urlOf=await signedMany(rows.map(x=>x.avatar_path));
      const top=rows.filter(x=>Number(x.pos)<=3).slice(0,3),rest=rows.slice(top.length);
      podium.innerHTML=top.map(x=>rankRow(x,urlOf,true)).join('');podium.hidden=!top.length;
      list.innerHTML=rest.map(x=>rankRow(x,urlOf)).join('');
      bindPeople(podium);bindPeople(list);fillFlags(list);
      const mine=rows.find(x=>x.is_self);
      setStatus('rankingStatus',!rows.length?(scope==='friends'?'Todavía no hay datos de tus amigos en esta categoría. Seguí a más personas o probá otra categoría.':'Todavía nadie tiene datos en esta categoría.'):mine?`Tu puesto: ${Number(mine.pos)} de ${rows.length}${rows.length>=50?'+':''}.`:user?(ownStats?.stats_public===false?'Tus estadísticas están ocultas: no aparecés en los rankings.':'Todavía no tenés datos en esta categoría.'):'Iniciá sesión para aparecer en el ranking.');
    }finally{rankBusy=false;}
  }

  // ---------- Estadísticas propias: se publican desde la app, públicas por defecto y ocultables ----------
  const NOTICE_KEY='fittforma-v53-stats-notice';
  let ownStats=null,ownStatsLoaded=false,statsSig='',statsBusy=null,statsVersion=0;
  const noticeState=()=>{try{return localStorage.getItem(NOTICE_KEY)||'';}catch{return 'shown';}};
  const setNotice=v=>{try{localStorage.setItem(NOTICE_KEY,v);}catch{}};
  function renderStatsNotice(){
    const box=$('communityStatsNotice');if(!box)return;
    const show=authReady()&&athleteEnabled!==false&&noticeState()!=='1'&&['world','ranking','friends'].includes(currentSubView);
    box.hidden=!show;if(show&&!noticeState())setNotice('shown');
  }
  function reflectStatsToggles(){const on=ownStats?ownStats.stats_public!==false:true;['communityStatsPublic','rkShareToggle'].forEach(id=>{const el=$(id);if(el)el.checked=on;});}
  // Sube las estadísticas actuales (si cambiaron), nunca si la persona las ocultó. Devuelve la fila propia ({stats_public, ...}) o null.
  async function syncStats(force=false){
    if(!authReady()||athleteEnabled===false)return ownStats;
    if(statsBusy)return statsBusy;
    statsBusy=(async()=>{
      try{
        if(!ownStatsLoaded){
          const r=await client.from('community_athlete_stats').select('stats_public,stats_date,updated_at').eq('user_id',user.id).maybeSingle();
          if(r.error){if(String(r.error.code)==='42P01'||String(r.error.code)==='PGRST205'||/does not exist|could not find the table/i.test(String(r.error.message)))athleteEnabled=false;return ownStats;}
          ownStats=r.data||null;ownStatsLoaded=true;reflectStatsToggles();
        }
        if(ownStats?.stats_public===false)return ownStats;
        // v61: públicas desde el inicio. Se publican al iniciar sesión, sin esperar el aviso (que sigue siendo informativo
        // y ofrece «Ocultar mis estadísticas»). Nunca incluyen peso, altura, medidas ni objetivos (esos van aparte, ver syncBody).
        const row=window.FittFormaAthleteStatsNow?.();if(!row)return ownStats;
        const sig=JSON.stringify(row);if(!force&&ownStats&&sig===statsSig)return ownStats;
        const version=statsVersion;
        const {data,error}=await upsertStats({...row,user_id:user.id});
        if(error){console.warn('No se pudieron publicar las estadísticas de Comunidad:',error.message);return ownStats;}
        if(version!==statsVersion)return ownStats; // la persona cambió la preferencia mientras tanto
        statsSig=sig;ownStats=data||ownStats;athleteEnabled=true;reflectStatsToggles();return ownStats;
      }catch(error){console.warn('Estadísticas de Comunidad:',error?.message||error);return ownStats;}
    })();
    const current=statsBusy;current.finally(()=>{if(statsBusy===current)statsBusy=null;});
    return current;
  }
  // Sin la migración v53.1 la columna muscle_ranks no existe: se publica el resto.
  // Columnas que el proyecto todavía no tiene (migraciones v53.1 o v54 sin aplicar): se quitan y se reintenta.
  const droppedStatCols=new Set();
  function statsPayload(row){const out={...row};if(extrasEnabled===false)droppedStatCols.add('muscle_ranks');droppedStatCols.forEach(c=>delete out[c]);return out;}
  function noteMissingColumn(error){const m=String(error?.message||'').match(/'([a-z_0-9]+)' column|column [a-z_."]*?"?([a-z_0-9]+)"? does not exist/);const col=m&&(m[1]||m[2]);if(col&&!droppedStatCols.has(col)&&/^(muscle_ranks|show_muscles|week_start|active_days_week|workouts_week|run_km_week)$/.test(col)){droppedStatCols.add(col);return true;}return false;}
  async function upsertStats(payload){
    for(let i=0;i<7;i++){const r=await client.from('community_athlete_stats').upsert(statsPayload(payload)).select('stats_public,stats_date,updated_at').maybeSingle();if(!r.error||!noteMissingColumn(r.error))return r;}
    return client.from('community_athlete_stats').upsert(statsPayload(payload)).select('stats_public,stats_date,updated_at').maybeSingle();
  }
  async function setStatsPublic(on){
    if(!authReady()){toast(authHint());return false;}
    if(athleteEnabled===false){setStatus('communityStatsStatus',V53_HINT);return false;}
    statsVersion++;if(statsBusy)await statsBusy.catch(()=>{});
    const row=on?(window.FittFormaAthleteStatsNow?.()||{}):{stats_date:localDateKey()};
    const payload=ownStats&&!on?{user_id:user.id,stats_public:false,stats_date:localDateKey()}:{...row,user_id:user.id,stats_public:!!on};
    const {data,error}=await upsertStats(payload);
    if(error){setStatus('communityStatsStatus',friendlySupabaseError(error,'guardar la preferencia de estadísticas'));reflectStatsToggles();return false;}
    ownStats=data;ownStatsLoaded=true;statsSig=on?JSON.stringify(row):'';setNotice('1');renderStatsNotice();reflectStatsToggles();
    const msg=on?'Tus estadísticas de entrenamiento se muestran en tu perfil y en los rankings.':'Ocultaste tus estadísticas: ya no se muestran ni aparecés en los rankings.';
    setStatus('communityStatsStatus',msg);toast(msg);
    if(currentSubView==='ranking')loadRanking();
    return true;
  }

  // ---------- v62: datos físicos, PRIVADOS por defecto ----------
  // Cada dato se sube solo si la persona activó su interruptor; los demás van en null. Sin fila = nada compartido.
  const BODY_FIELDS=[['weight_kg','communityBodyWeight','tu peso actual'],['height_cm','communityBodyHeight','tu altura'],['target_weight_kg','communityBodyTarget','tu peso objetivo'],['goal','communityBodyGoal','tu objetivo de entrenamiento']];
  const GOAL_LABEL={fitness:'Ponerme en forma',muscle:'Ganar masa muscular',strength:'Ganar fuerza',endurance:'Mejorar resistencia',habit:'Crear el hábito'};
  let bodyEnabled=null,ownBody=null,ownBodyLoaded=false,bodyBusy=null;
  const bodyMissing=e=>isMissingFunction(e)||['42P01','PGRST205'].includes(String(e?.code))||(/community_body/.test(String(e?.message||''))&&/does not exist|could not find/i.test(String(e?.message||'')));
  const bodyNorm=o=>JSON.stringify(BODY_FIELDS.map(([k])=>o?.[k]==null?null:k==='goal'?String(o[k]):Number(o[k])));
  function bodyValue(k,v){if(v==null)return '';if(k==='goal')return GOAL_LABEL[v]||String(v);return `${String(Number(v)).replace('.',',')} ${k==='height_cm'?'cm':'kg'}`;}
  function bodyPayload(chosen){const now=window.FittFormaBodyNow?.()||{};return Object.fromEntries(BODY_FIELDS.map(([k])=>[k,chosen[k]?(now[k]??null):null]));}
  function reflectBody(){
    const now=window.FittFormaBodyNow?.()||{};
    BODY_FIELDS.forEach(([k,id])=>{const el=$(id);if(el)el.checked=ownBody?.[k]!=null;const v=$(id+'Val');if(v)v.textContent=now[k]==null?'Sin cargar en Perfil':bodyValue(k,now[k]);});
  }
  async function loadOwnBody(){
    if(!authReady()||bodyEnabled===false){reflectBody();return;}
    const r=await client.from('community_body').select('weight_kg,height_cm,target_weight_kg,goal').eq('user_id',user.id).maybeSingle();
    if(r.error){if(bodyMissing(r.error)){bodyEnabled=false;const c=$('communityBodyCard');if(c)c.hidden=true;}return;}
    bodyEnabled=true;ownBody=r.data||null;ownBodyLoaded=true;reflectBody();
  }
  async function writeBody(payload){
    const {data,error}=await client.from('community_body').upsert({user_id:user.id,...payload}).select('weight_kg,height_cm,target_weight_kg,goal').maybeSingle();
    if(!error)ownBody=data;return error;
  }
  async function setBodyField(key,on){
    const f=BODY_FIELDS.find(x=>x[0]===key);if(!f)return;const el=$(f[1]);
    if(!authReady()){if(el)el.checked=false;toast(authHint());return;}
    if(bodyEnabled===false){if(el)el.checked=false;setStatus('communityBodyStatus',V54_HINT);return;}
    if(bodyBusy)await bodyBusy.catch(()=>{});
    if(!ownBodyLoaded)await loadOwnBody();
    const now=window.FittFormaBodyNow?.()||{};
    if(on&&now[key]==null){if(el)el.checked=false;setStatus('communityBodyStatus',`Primero cargá ${f[2]} en Perfil → Datos físicos.`);return;}
    const chosen=Object.fromEntries(BODY_FIELDS.map(([k])=>[k,ownBody?.[k]!=null]));chosen[key]=!!on;
    const error=await writeBody(bodyPayload(chosen));
    if(error){if(el)el.checked=!on;setStatus('communityBodyStatus',bodyMissing(error)?V54_HINT:friendlySupabaseError(error,'guardar la preferencia'));return;}
    reflectBody();
    const msg=on?`Ahora se muestra ${f[2]} en tu perfil de Comunidad.`:`Dejaste de mostrar ${f[2]}: volvió a ser privado.`;
    setStatus('communityBodyStatus',msg);toast(msg);
  }
  // Mantiene al día SOLO lo que la persona eligió mostrar (por ejemplo, si cambia su peso en Perfil).
  function syncBody(){
    if(!authReady()||bodyEnabled===false)return Promise.resolve();
    if(bodyBusy)return bodyBusy;
    bodyBusy=(async()=>{try{
      if(!ownBodyLoaded)await loadOwnBody();
      if(!ownBody)return; // nunca eligió mostrar nada: no se crea ninguna fila
      const payload=bodyPayload(Object.fromEntries(BODY_FIELDS.map(([k])=>[k,ownBody[k]!=null])));
      if(bodyNorm(payload)!==bodyNorm(ownBody)){await writeBody(payload);reflectBody();}
    }catch(error){console.warn('Datos físicos de Comunidad:',error?.message||error);}})();
    const current=bodyBusy;current.finally(()=>{if(bodyBusy===current)bodyBusy=null;});
    return current;
  }
  function bodySection(b){
    if(!b)return '';const tiles=[['weight_kg','Peso actual'],['height_cm','Altura'],['target_weight_kg','Peso objetivo'],['goal','Objetivo']].filter(([k])=>b[k]!=null);
    if(!tiles.length)return '';
    return `<section class="cm-section cm-body-section"><h4>Datos físicos</h4><div class="cm-stats">${tiles.map(([k,l])=>statTile(l,bodyValue(k,b[k]))).join('')}</div><p class="muted small cm-footnote">Los eligió mostrar esta persona. No es una evaluación de salud.</p></section>`;
  }
  async function bodyInfo(uid){
    if(bodyEnabled===false)return null;
    const r=await client.rpc('community_body_info',{p_user:uid});
    if(r.error){if(bodyMissing(r.error))bodyEnabled=false;return null;}
    bodyEnabled=true;return r.data?.[0]||null;
  }

  // ---------- Perfil completo (el mismo componente desde Todos, Ranking y Amigos) ----------
  function statTile(label,value,sub=''){return `<div class="cm-stat"><small>${esc(label)}</small><b${value==null?' class="is-empty"':''}>${esc(value==null?'Sin datos disponibles':value)}</b>${sub?`<span>${esc(sub)}</span>`:''}</div>`;}
  function statsSection(p){
    if(!p.stats_visible)return `<section class="cm-section"><h4>Estadísticas</h4><p class="muted small">${p.is_self?'Ocultaste tus estadísticas. Activalas en Mi perfil para que otras personas las vean.':'Esta persona no comparte sus estadísticas de entrenamiento.'}</p></section>`;
    const fresh=p.stats_fresh!==false,n=v=>Number(v)||0,km=n(p.run_km_30d);
    const plank=n(p.best_plank_seconds)?formatMetric('plank',p.best_plank_seconds):null;
    const when=p.stats_updated_at?new Date(p.stats_updated_at).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'}):'';
    return `<section class="cm-section"><h4>Estadísticas</h4>
      <div class="cm-stats">
        ${statTile('Constancia (30 días)',fresh?`${n(p.active_days_30d)} de 30 días`:null,fresh?'días con entrenamiento o actividad':'sin datos recientes')}
        ${statTile('Entrenamientos (30 días)',fresh?String(n(p.workouts_30d)):null,fresh?'sesiones y actividades':'sin datos recientes')}
        ${statTile('Actividades registradas',String(n(p.workouts_total)),'en total')}
        ${statTile('Running (30 días)',fresh&&km>0?formatMetric('running',km):null,fresh&&km>0?`${n(p.run_count_30d)} carrera(s) · ${n(p.run_minutes_30d)} min`:'')}
        ${statTile('Músculos con rango',`${n(p.ranked_muscles)} de 20`,'Mapa de avances')}
        ${statTile('Insignias',String(n(p.badges_count)),'desafíos con insignia')}
      </div>
      <h5 class="cm-subhead">Mejores series</h5>
      <div class="cm-stats cm-stats-4">
        ${statTile('Flexiones clásicas',n(p.best_pushups)?`${n(p.best_pushups)} rep`:null)}
        ${statTile('Dominadas',n(p.best_pullups)?`${n(p.best_pullups)} rep`:null)}
        ${statTile('Sentadilla al aire',n(p.best_air_squats)?`${n(p.best_air_squats)} rep`:null)}
        ${statTile('Plancha frontal',plank)}
      </div>
      <p class="muted small cm-footnote">Calculadas por la app con los registros de la persona${when?` (actualizado el ${esc(when)})`:''}. No son mediciones médicas ni de masa muscular.</p></section>`;
  }
  function badgesSection(p){
    const E=BE();const list=p.stats_visible&&Array.isArray(p.badges)&&p.badges.length?p.badges:(Array.isArray(p.featured_badges)?p.featured_badges:[]);
    if(!p.can_view)return '';
    if(!list.length)return `<section class="cm-section"><h4>Insignias y logros</h4><p class="muted small">${p.stats_visible?'Todavía no tiene insignias.':'Sin insignias para mostrar.'}</p></section>`;
    const ev={gps_device:'Con GPS del dispositivo',session:'Registrada en un entrenamiento',declared:'Autorregistrada'};
    const items=list.map(b=>{const level=Math.min(15,Math.max(1,Number(b?.level)||1)),rank=E?E.rankForLevel(level-1):{label:'',key:'',numeral:''};
      const medal=E?E.medalSvg({rankKey:rank.key,numeral:rank.numeral,glyph:E.glyphFor({id:b.exerciseId,name:b.exerciseName,category:b.category,measure:b.measure}),category:b.category,size:46,title:`${b.exerciseName} · ${rank.label}`}):'';
      const cat=E&&b.category?E.categoryLabel(b.category):'';const date=b.earnedAt?dateLabel(b.earnedAt):'';
      return `<li class="cm-badge" role="button" tabindex="0" data-badge-key="${badgeKey(b)}">${medal}<div><strong>${esc(b.exerciseName||'Insignia')}</strong><small>${esc([cat,rank.label?`${rank.label} · nivel ${level}`:`Nivel ${level}`].filter(Boolean).join(' · '))}</small><small class="muted">${esc([date,b.evidence?ev[b.evidence]||ev.declared:''].filter(Boolean).join(' · '))}</small></div></li>`;}).join('');
    return `<section class="cm-section"><h4>Insignias y logros <small class="muted">${list.length}${p.stats_visible&&Number(p.badges_count)>list.length?` de ${Number(p.badges_count)}`:''}</small></h4><ul class="cm-badges">${items}</ul><p class="muted small cm-footnote">Las insignias se ganan en la app. Ninguna está verificada por terceros: se indica si tiene GPS del dispositivo, si salió de un entrenamiento registrado o si fue autorregistrada.</p></section>`;
  }
  async function openUser(uid,opts={}){
    if(!client||!uid)return;
    if(user&&uid===user.id&&!opts.asOthers){showCommunitySubView('profile');return;}
    if(athleteEnabled===false)return openUserLegacy(uid,opts);
    viewedUser=uid;showCommunitySubView('user');const root=$('communityUserProfile');root.dataset.owner=uid;root.innerHTML='<div class="cm-skeleton cm-skeleton-hero" aria-hidden="true"><i></i><i></i></div><p class="sr-only">Cargando perfil…</p>';
    if(user&&uid===user.id)await syncStats();
    const r=await client.rpc('community_athlete_profile',{p_user:uid});
    if(r.error){if(isMissingFunction(r.error)){athleteEnabled=false;return openUserLegacy(uid,opts);}root.innerHTML=`<div class="empty"><strong>No se pudo abrir el perfil</strong><p>${esc(friendlySupabaseError(r.error,'abrir el perfil'))}</p></div>`;return;}
    athleteEnabled=true;const p=r.data?.[0];if(viewedUser!==uid)return;
    if(!p){root.innerHTML='<div class="empty"><strong>Perfil no disponible</strong><p>Puede haber sido eliminado o haber un bloqueo entre las cuentas.</p></div>';return;}
    const [urlOf,extra,body]=await Promise.all([signedMany([p.avatar_path]),profileExtrasHtml(uid,p),p.can_view?bodyInfo(uid):null]),fs=p.follow_status||'',mutual=fs==='accepted'&&p.follows_me,priv=p.visibility==='private',meta=levelLine(p);if(viewedUser!==uid)return;
    const counts=p.can_view?`<div class="community-profile-stats cm-counts">${statsHtml(p.posts,p.followers,p.following)}</div>`:'';
    const actions=p.is_self?`<p class="muted small">Así ven tu perfil las demás personas.</p>`:user?`<div class="btn-row community-profile-actions"><button class="btn${fs?' secondary':''}" type="button" data-user-follow>${fs==='accepted'?'Dejar de seguir':fs==='pending'?'Cancelar solicitud':priv?'Solicitar seguir':'Seguir'}</button>${p.stats_visible?'<button class="btn ghost" type="button" data-user-compare>Comparar progreso</button>':''}${mutual?'<button class="btn ghost" type="button" data-user-message>Mensaje</button>':''}<button class="btn ghost" type="button" data-community-block>Bloquear</button></div>${!mutual&&fs==='accepted'?'<p class="muted small">Los mensajes privados se habilitan cuando se siguen mutuamente.</p>':''}`:'<p class="muted small">Iniciá sesión para seguir, comparar o escribir.</p>';
    root.innerHTML=`<header class="cm-hero card">
        <div class="cm-hero-top"><button type="button" class="cm-avatar-btn" data-hero-avatar aria-label="Ver la foto de perfil">${avatarHtml(p,urlOf,'xl')}</button><div class="cm-hero-id"><strong>${esc(p.display_name||p.username)} ${flagHtml(extra.country)}${p.stats_visible?rankMini(p.overall_rank):''}</strong><span class="muted small">@${esc(p.username)}${priv?' · Privado':''}${p.follows_me&&!p.is_self?' · Te sigue':''}</span>${meta?`<span class="cm-card-level">${esc(meta)}</span>`:''}</div></div>
        <div class="cm-hero-rank">${p.stats_visible?`<div><small class="muted">Rango principal</small>${rankChip(p.overall_rank,44)}</div>`:''}<div class="community-featured" aria-label="Insignias destacadas">${featuredHtml(p.featured_badges,30)}</div></div>
        ${p.bio?`<p class="community-profile-bio">${esc(p.bio)}</p>`:''}${counts}${actions}
      </header>
      ${p.can_view?'':`<div class="notice community-private-notice"><strong>Este perfil es privado.</strong><p class="small">${fs==='pending'?'Tu solicitud está pendiente: cuando la acepte vas a ver sus estadísticas, insignias y publicaciones.':'Seguilo y, cuando acepte tu solicitud, vas a ver sus estadísticas, insignias y publicaciones.'}</p></div>`}
      ${p.can_view?extra.html+bodySection(body)+statsSection(p)+badgesSection(p):''}
      ${p.can_view?'<section class="cm-section"><h4>Publicaciones</h4><div class="community-grid" id="communityUserGrid"><p class="muted small">Cargando…</p></div></section>':''}`;
    root.querySelector('[data-user-follow]')?.addEventListener('click',e=>toggleFollow(uid,e.currentTarget));
    root.querySelector('[data-user-compare]')?.addEventListener('click',()=>openCompare(uid));
    bindPhysiqueViews(root,extra.urlOf);
    root.querySelector('[data-hero-avatar]')?.addEventListener('click',()=>{const u=p.avatar_path?urlOf(p.avatar_path):'';if(u)openViewer(u,p.display_name||p.username);});
    root.querySelector('[data-user-message]')?.addEventListener('click',async()=>{showCommunitySubView('messages');await loadChatContacts();openChat(uid);});
    root.querySelector('[data-community-block]')?.addEventListener('click',()=>blockUser(uid));
    if(p.can_view)loadUserPosts(uid,p);
  }
  async function loadUserPosts(uid,p){
    const {data:posts}=await client.from('community_posts').select(postSelect()).eq('user_id',uid).order('created_at',{ascending:false}).limit(30);
    const list=posts||[];const tileUrl=await signedMany(list.flatMap(x=>[x.image_path,(x.post_kind||'transformation')==='transformation'?x.after_path:null]));
    const grid=$('communityUserGrid');if(grid&&viewedUser===uid){grid.innerHTML=list.length?list.map(x=>gridTile({...x,community_profiles:p},tileUrl)).join(''):'<div class="empty"><p>Todavía no publicó nada.</p></div>';bindGrid(grid);}
  }

  // Mosaicos de publicaciones dentro de un perfil (propio o ajeno).
  function gridTile(p,urlOf){const kind=p.post_kind||'transformation',img=urlOf(p.image_path)||(kind==='transformation'?urlOf(p.after_path):'');const E=window.FittFormaBadgeEngine;let inner='';
    if(img)inner=`<img src="${esc(img)}" alt="" loading="lazy" onerror="this.remove()">`;
    else if(kind==='achievement'&&E&&p.achievement){const level=Math.min(15,Math.max(1,Number(p.achievement.level)||1)),rank=E.rankForLevel(level-1);inner=`<span class="community-tile-badge">${E.medalSvg({rankKey:rank.key,numeral:rank.numeral,glyph:E.glyphFor({id:p.achievement.exerciseId,name:p.achievement.exerciseName,category:p.achievement.category,measure:p.achievement.measure}),category:p.achievement.category,size:52})}<small>${esc(p.achievement.exerciseName)}</small></span>`;}
    else inner=`<span class="community-tile-text">${esc(String(p.description||'').slice(0,90))}</span>`;
    const label=kind==='transformation'?'Transformación':kind==='achievement'?'Logro':'Publicación';
    return `<button type="button" class="community-tile${img?'':' is-text'}" data-community-open-post="${esc(p.id)}" aria-label="Abrir ${label.toLowerCase()} de ${esc((Array.isArray(p.community_profiles)?p.community_profiles[0]:p.community_profiles)?.username||'usuario')}">${inner}${kind==='transformation'?'<span class="community-tile-kind">Antes/Después</span>':''}</button>`;}
  function bindGrid(root){root.querySelectorAll('[data-community-open-post]').forEach(b=>b.addEventListener('click',()=>openPostDialog(b.dataset.communityOpenPost)));}

  // ---------- v53.1: bandera, «Mi físico», mapa de músculos y visor de fotos ----------
  // Requieren supabase/migrations/2026-10-28_v53_profile_extras.sql. Sin esa migración se ocultan (extrasEnabled=false).
  let extrasEnabled=null,ownPhysique={pair:null,single:null};
  const COUNTRY_CODES='AR BO BR CL CO CR CU DO EC SV GT HN MX NI PA PY PE PR UY VE US CA ES PT FR IT DE GB IE NL BE CH AT SE NO DK FI PL CZ GR RO HU UA RU TR IL MA EG ZA NG KE AU NZ JP CN KR IN PH TH VN ID MY SG AE SA QA'.split(' ');
  function flagEmoji(code){const c=String(code||'').toUpperCase();return /^[A-Z]{2}$/.test(c)?String.fromCodePoint(...[...c].map(ch=>0x1F1A5+ch.charCodeAt(0))):'';}
  let regionNames=null;
  function countryName(code){try{regionNames=regionNames||new Intl.DisplayNames([document.documentElement.lang||'es'],{type:'region'});return regionNames.of(code)||code;}catch{return code;}}
  function flagHtml(code){const c=String(code||'').toUpperCase();return /^[A-Z]{2}$/.test(c)?`<span class="cm-flag" title="${esc(countryName(c))}" aria-label="${esc(countryName(c))}">${flagEmoji(c)}</span>`:'';}
  function fillCountryOptions(){
    const sel=$('communityCountry');if(!sel||sel.options.length>1)return;
    const items=COUNTRY_CODES.map(c=>({c,n:countryName(c)})).sort((a,b)=>a.n.localeCompare(b.n));
    sel.insertAdjacentHTML('beforeend',items.map(x=>`<option value="${x.c}">${flagEmoji(x.c)} ${esc(x.n)}</option>`).join(''));
  }
  const missingExtras=error=>isMissingFunction(error)||isMissingColumn(error)||String(error?.code)==='42P01'||String(error?.code)==='PGRST205'||String(error?.code)==='PGRST204'||/community_physique|country_code|muscle_ranks|show_muscles/.test(String(error?.message||''));
  // Banderas en tarjetas, podio y filas: se completan después de dibujar (una consulta por lista).
  async function fillFlags(root){
    if(!client||!root||extrasEnabled===false)return;
    const ids=[...new Set([...root.querySelectorAll('[data-flag-for]')].map(x=>x.dataset.flagFor))].slice(0,60);if(!ids.length)return;
    const r=await client.rpc('community_flags',{p_users:ids});
    if(r.error){if(missingExtras(r.error))extrasEnabled=false;return;}
    extrasEnabled=true;const by=new Map((r.data||[]).map(x=>[x.user_id,x.country_code]));
    root.querySelectorAll('[data-flag-for]').forEach(el=>{el.innerHTML=flagHtml(by.get(el.dataset.flagFor));});
  }

  // Visor de fotos (foto de perfil y «Mi físico»). Con acciones opcionales (cambiar o quitar la foto propia).
  function openViewer(url,caption='',actions=''){
    const dlg=$('communityPhotoViewer');if(!dlg||!url)return;
    $('communityPhotoViewerImg').src=url;$('communityPhotoViewerImg').alt=caption||'Foto';
    $('communityPhotoViewerCaption').textContent=caption;$('communityPhotoViewerActions').innerHTML=actions;
    if(typeof dlg.showModal==='function'&&!dlg.open)dlg.showModal();else dlg.setAttribute('open','');
  }
  function closeViewer(){const d=$('communityPhotoViewer');if(d?.open)d.close();}
  async function ownAvatarTapped(){
    if(!authReady()){toast(authHint());return;}
    const path=ownProfile?.avatar_path;
    if(!path){$('communityAvatarInput')?.click();return;}
    const urlOf=await signedMany([path]);
    openViewer(urlOf(path),'Tu foto de perfil',`<label class="btn" for="communityAvatarInput">Cambiar foto</label><button class="btn ghost" type="button" data-viewer-remove-avatar>Quitar foto</button>`);
    $('communityPhotoViewerActions').querySelector('[data-viewer-remove-avatar]')?.addEventListener('click',()=>{closeViewer();removeAvatar();});
  }

  // «Mi físico» propio: una cosa por sección; sin Plus, cambio cada 30 días (lo controla el servidor).
  async function loadOwnPhysique(){
    const root=$('communityPhysiqueEdit');if(!root)return;
    const card=$('communityPhysiqueCard');
    if(!authReady()){root.innerHTML='<p class="muted small">Iniciá sesión para subir tus fotos.</p>';return;}
    if(extrasEnabled===false){if(card)card.hidden=true;return;}
    const r=await client.from('community_physique').select('kind,before_path,after_path,photo_path,description,changed_at').eq('user_id',user.id);
    if(r.error){if(missingExtras(r.error)){extrasEnabled=false;if(card)card.hidden=true;}else setStatus('communityPhysiqueStatus',friendlySupabaseError(r.error,'cargar «Mi físico»'));return;}
    extrasEnabled=true;if(card)card.hidden=false;
    ownPhysique={pair:null,single:null};(r.data||[]).forEach(x=>{ownPhysique[x.kind]=x;});
    const pair=ownPhysique.pair,single=ownPhysique.single,urlOf=await signedMany([pair?.before_path,pair?.after_path,single?.photo_path]);
    const wait=row=>{if(!row?.changed_at||ownPlus())return '';const next=new Date(Date.parse(row.changed_at)+30*864e5);return next>new Date()?`<small class="muted">Podés cambiarla desde el ${esc(next.toLocaleDateString(undefined,{day:'numeric',month:'short'}))} (con Plus, cuando quieras).</small>`:'';};
    const hasPair=pair?.before_path&&pair?.after_path,hasSingle=single?.photo_path;
    root.innerHTML=`<section class="cm-phys-slot"><h4>Antes y después</h4>${hasPair?`<div class="cm-phys-pair"><button type="button" data-phys-view="${esc(pair.before_path)}" data-caption="Antes"><img src="${esc(urlOf(pair.before_path))}" alt="Antes"><span>Antes</span></button><button type="button" data-phys-view="${esc(pair.after_path)}" data-caption="Después"><img src="${esc(urlOf(pair.after_path))}" alt="Después"><span>Después</span></button></div>`:'<p class="muted small">Todavía no subiste tu antes y después.</p>'}
        <div class="btn-row"><button class="btn btn-sm" type="button" data-phys-upload="pair">${hasPair?'Cambiar antes y después':'Subir antes y después'}</button>${hasPair?'<button class="btn ghost btn-sm" type="button" data-phys-remove="pair">Quitar</button>':''}</div>${hasPair?wait(pair):''}</section>
      <section class="cm-phys-slot"><h4>Una foto</h4>${hasSingle?`<div class="cm-phys-single"><button type="button" data-phys-view="${esc(single.photo_path)}" data-caption="${esc(single.description||'Mi físico')}"><img src="${esc(urlOf(single.photo_path))}" alt="Mi físico"></button></div>${single.description?`<p class="small">${esc(single.description)}</p>`:''}`:'<p class="muted small">Todavía no subiste una foto de tu físico.</p>'}
        <div class="btn-row"><button class="btn btn-sm" type="button" data-phys-upload="single">${hasSingle?'Cambiar foto':'Subir una foto'}</button>${hasSingle?'<button class="btn ghost btn-sm" type="button" data-phys-remove="single">Quitar</button>':''}</div>${hasSingle?wait(single):''}</section>`;
    bindPhysiqueViews(root,urlOf);
    root.querySelectorAll('[data-phys-upload]').forEach(b=>b.addEventListener('click',()=>startPhysiqueUpload(b.dataset.physUpload)));
    root.querySelectorAll('[data-phys-remove]').forEach(b=>b.addEventListener('click',()=>removePhysique(b.dataset.physRemove)));
    loadPhysiqueHistory();
  }
  function ownPlus(){try{return Boolean(window.FittFormaAds?.isPlus?.());}catch{return false;}}
  function bindPhysiqueViews(root,urlOf){root.querySelectorAll('[data-phys-view]').forEach(b=>b.addEventListener('click',()=>openViewer(urlOf(b.dataset.physView),b.dataset.caption||'')));}
  let physiquePending=null;
  function startPhysiqueUpload(kind){
    if(!authReady()){toast(authHint());return;}
    // Aviso antes de subir nada (el servidor igual lo controla): sin Plus, una vez cada 30 días por sección.
    const row=ownPhysique[kind],has=row&&(row.photo_path||row.before_path);
    if(has&&row.changed_at&&!ownPlus()&&Date.parse(row.changed_at)>Date.now()-30*864e5){setStatus('communityPhysiqueStatus','Sin membresía Plus podés cambiar esta sección una vez cada 30 días. Con Plus, cuando quieras. Igual podés quitarla.');return;}
    physiquePending={kind,before:null};
    if(kind==='pair'){setStatus('communityPhysiqueStatus','Elegí primero la foto de ANTES.');$('communityPhysiqueBefore').click();}
    else $('communityPhysiqueSingle').click();
  }
  async function physiqueFileChosen(input){
    const file=input.files?.[0];input.value='';if(!file||!physiquePending)return;
    if(input.id==='communityPhysiqueBefore'){physiquePending.before=file;setStatus('communityPhysiqueStatus','Ahora elegí la foto de DESPUÉS.');$('communityPhysiqueAfter').click();return;}
    const kind=physiquePending.kind,before=physiquePending.before;physiquePending=null;
    if(!confirm(tr('¿Publicar esta foto en «Mi físico»? Confirmá que sos vos y que tenés derecho a publicarla.')))return;
    let description='';if(kind==='single')description=String(prompt(tr('Descripción (opcional, hasta 300 caracteres):'))??'').trim().slice(0,300);
    setStatus('communityPhysiqueStatus','Subiendo…');
    const stamp=Date.now().toString(36),paths=kind==='pair'?[`${user.id}/physique/${stamp}-antes.jpg`,`${user.id}/physique/${stamp}-despues.jpg`]:[`${user.id}/physique/${stamp}.jpg`];
    const old=ownPhysique[kind],oldPaths=[old?.before_path,old?.after_path,old?.photo_path].filter(Boolean);
    try{
      if(kind==='pair'){await uploadImage(before,paths[0]);await uploadImage(file,paths[1]);}else await uploadImage(file,paths[0]);
      const row=kind==='pair'?{user_id:user.id,kind,before_path:paths[0],after_path:paths[1],photo_path:null,description:''}:{user_id:user.id,kind,photo_path:paths[0],before_path:null,after_path:null,description};
      const {error}=await client.from('community_physique').upsert(row,{onConflict:'user_id,kind'});
      if(error)throw error;
      // Con v54 las fotos anteriores quedan en el historial privado; sin v54 se borran.
      if(oldPaths.length&&v54Enabled===false)await client.storage.from(bucket).remove(oldPaths).catch(()=>{});
      setStatus('communityPhysiqueStatus','Listo: ya se ve en tu perfil.');toast('«Mi físico» actualizado.');
    }catch(error){
      await client.storage.from(bucket).remove(paths).catch(()=>{});
      setStatus('communityPhysiqueStatus',/physique_wait/.test(String(error?.message))?'Sin membresía Plus podés cambiar esta sección una vez cada 30 días. Con Plus, cuando quieras. Igual podés quitarla.':error?.code?friendlySupabaseError(error,'guardar «Mi físico»'):`No se pudo subir la foto: ${error.message}`);
    }
    loadOwnPhysique();
  }
  async function removePhysique(kind){
    if(!confirm(tr('¿Quitar esta sección de tu perfil? Las fotos se borran.')))return;
    const old=ownPhysique[kind],paths=[old?.before_path,old?.after_path,old?.photo_path].filter(Boolean);
    const {error}=await client.from('community_physique').update({before_path:null,after_path:null,photo_path:null,description:''}).eq('user_id',user.id).eq('kind',kind);
    if(error){setStatus('communityPhysiqueStatus',friendlySupabaseError(error,'quitar la foto'));return;}
    if(paths.length)await client.storage.from(bucket).remove(paths).catch(()=>{});
    setStatus('communityPhysiqueStatus','Sección quitada.');loadOwnPhysique();
  }
  // Bandera propia y ajuste del mapa de músculos.
  async function loadOwnExtras(){
    fillCountryOptions();
    if(!authReady()||extrasEnabled===false)return;
    const r=await client.rpc('community_athlete_extras',{p_user:user.id});
    if(r.error){if(missingExtras(r.error)){extrasEnabled=false;['communityPhysiqueCard'].forEach(id=>{const el=$(id);if(el)el.hidden=true;});}return;}
    extrasEnabled=true;const x=r.data?.[0];
    if($('communityCountry'))$('communityCountry').value=x?.country_code||'';
    if($('communityOwnFlag'))$('communityOwnFlag').innerHTML=flagHtml(x?.country_code);
    if($('communityShowMuscles'))$('communityShowMuscles').checked=x?.show_muscles!==false;
  }
  async function saveCountry(code){
    if(!authReady()||extrasEnabled===false)return;
    const {error}=await client.from('community_profiles').update({country_code:code||null}).eq('user_id',user.id);
    if(error){setStatus('communityProfileStatus',missingExtras(error)?'La bandera necesita la actualización v53.1 de la base de datos.':friendlySupabaseError(error,'guardar la bandera'));return;}
    if($('communityOwnFlag'))$('communityOwnFlag').innerHTML=flagHtml(code);
  }
  async function setShowMuscles(on){
    if(!authReady())return;
    await syncStats(true);
    const {error}=await client.from('community_athlete_stats').update({show_muscles:!!on}).eq('user_id',user.id);
    if(error){setStatus('communityStatsStatus',missingExtras(error)?'El mapa de músculos necesita la actualización v53.1 de la base de datos.':friendlySupabaseError(error,'guardar la preferencia del mapa'));if($('communityShowMuscles'))$('communityShowMuscles').checked=!on;return;}
    const msg=on?'Tu mapa de músculos se muestra en tu perfil.':'Ocultaste tu mapa de músculos.';setStatus('communityStatsStatus',msg);toast(msg);
  }
  // Secciones del perfil de otra persona: «Mi físico» y mapa de músculos.
  async function profileExtrasHtml(uid,p){
    if(extrasEnabled===false||!p.can_view)return {html:'',urlOf:()=>''};
    const [x,f]=await Promise.all([client.rpc('community_athlete_extras',{p_user:uid}),client.from('community_physique').select('kind,before_path,after_path,photo_path,description').eq('user_id',uid)]);
    if(x.error&&missingExtras(x.error)){extrasEnabled=false;return {html:'',urlOf:()=>''};}
    extrasEnabled=true;
    const ex=x.data?.[0]||{},rows=f.data||[],pair=rows.find(r=>r.kind==='pair'&&r.before_path&&r.after_path),single=rows.find(r=>r.kind==='single'&&r.photo_path);
    const urlOf=await signedMany([pair?.before_path,pair?.after_path,single?.photo_path]);
    let html='';
    if(pair||single)html+=`<section class="cm-section cm-physique"><h4>${p.is_self?'Mi físico':'Físico'}</h4><div class="cm-phys-show">${pair?`<div class="cm-phys-pair"><button type="button" data-phys-view="${esc(pair.before_path)}" data-caption="Antes"><img src="${esc(urlOf(pair.before_path))}" alt="Antes"><span>Antes</span></button><button type="button" data-phys-view="${esc(pair.after_path)}" data-caption="Después"><img src="${esc(urlOf(pair.after_path))}" alt="Después"><span>Después</span></button></div>`:''}${single?`<div class="cm-phys-single"><button type="button" data-phys-view="${esc(single.photo_path)}" data-caption="${esc(single.description||'')}"><img src="${esc(urlOf(single.photo_path))}" alt="Foto de físico"></button>${single.description?`<p class="small">${esc(single.description)}</p>`:''}</div>`:''}</div><p class="muted small cm-footnote">Fotos compartidas por la persona. Tocá una para verla en grande.</p></section>`;
    html+=muscleMapSection(ex.muscle_ranks,p);
    return {html,urlOf,country:ex.country_code};
  }
  function muscleMapSection(ranks,p){
    const A=window.FittFormaAnatomy,R=MRK();
    if(!ranks||typeof ranks!=='object'||!Object.keys(ranks).length||!A?.muscleFillSvg||!R)return '';
    const fills={};for(const [id,v] of Object.entries(ranks)){const n=Number(v);if(n>=0&&R.RANKS[n])fills[id]=R.RANKS[n].color;}
    const names=A.MUSCLES||{};
    const top=Object.entries(ranks).filter(([,v])=>Number(v)>=0).sort((a,b)=>b[1]-a[1]).slice(0,3);
    return `<section class="cm-section cm-muscles"><h4>Mapa de músculos</h4><div class="cm-muscle-map">${A.muscleFillSvg(fills,{label:`Rango por músculo de ${p.display_name||p.username}`})}</div>${top.length?`<ul class="cm-muscle-top">${top.map(([id,v])=>`<li>${rankChip(Number(v),22)}<span>${esc(names[id]||id)}</span></li>`).join('')}</ul>`:'<p class="muted small">Todavía no tiene músculos con rango.</p>'}<p class="muted small cm-footnote">Rango de cada músculo según las series completadas (constancia y volumen de entrenamiento), no tamaño ni fuerza.</p></section>`;
  }

  // ---------- v54: reto de la semana, evolución semanal, avisos e historial privado de «Mi físico» ----------
  let v54Enabled=null;
  const noteV54=error=>{if(isMissingFunction(error)||/community_notifications|community_physique_history|community_week|community_weekly/.test(String(error?.message||''))){v54Enabled=false;return true;}return false;};
  function daysLeftInWeek(){const d=new Date().getDay();return d===0?0:7-d;}
  // Reto de la semana entre amigos: más días activos de lunes a domingo. Lo ordena el servidor.
  async function loadChallenge(){
    const box=$('communityChallenge');if(!box)return;
    if(!authReady()||v54Enabled===false){box.hidden=true;return;}
    const [b,w]=await Promise.all([client.rpc('community_week_board',{p_category:'active',p_scope:'friends',p_limit:10}),client.rpc('community_week_winners')]);
    if(b.error){if(noteV54(b.error))box.hidden=true;return;}
    v54Enabled=true;box.hidden=false;
    const rows=b.data||[],winners=w.data||[],urlOf=await signedMany(rows.map(x=>x.avatar_path).concat(winners.map(x=>x.avatar_path)));
    const left=daysLeftInWeek(),mine=rows.find(x=>x.is_self);
    const list=rows.map(x=>{const v=Number(x.value)||0;return `<li class="cm-ch-row${x.is_self?' is-self':''}"><button type="button" data-community-open-user="${esc(x.user_id)}"><span class="cm-board-pos">${Number(x.pos)}</span>${avatarHtml(x,urlOf)}<span class="cm-ch-who"><strong>${esc(x.is_self?'Vos':(x.display_name||x.username))}</strong><span class="cm-ch-bar" aria-hidden="true"><i style="width:${Math.round(Math.min(7,v)/7*100)}%"></i></span></span><b>${v} de 7</b></button></li>`;}).join('');
    const prev=winners.length?`<p class="cm-ch-prev"><svg class="cm-ch-trophy" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5v1a3 3 0 0 0 3 3M16 6h3v1a3 3 0 0 1-3 3M12 13v4M9 20h6M10 17h4"/></svg> Semana pasada: ${winners.map(x=>`<strong>${esc(x.is_self?'Vos':(x.display_name||x.username))}</strong>`).join(', ')} con ${Number(winners[0].active_days)} ${Number(winners[0].active_days)===1?'día activo':'días activos'}.</p>`:'';
    box.innerHTML=`<div class="cm-ch-head"><div><small class="muted">Reto de la semana</small><h4>Más días activos</h4></div><span class="cm-ch-left">${left?`Quedan ${left} ${left===1?'día':'días'}`:'Último día'}</span></div>
      ${rows.length?`<ol class="cm-ch-list">${list}</ol>`:'<p class="muted small">Todavía nadie de tus amigos entrenó esta semana. ¡Arrancá vos!</p>'}
      ${mine?'':'<p class="muted small">Registrá un entrenamiento o una actividad para entrar al reto.</p>'}${prev}
      <p class="muted small cm-footnote">Cuenta días distintos con al menos un entrenamiento o actividad, de lunes a domingo, entre vos y las personas que seguís que muestran sus estadísticas.</p>`;
    bindPeople(box);
  }
  // Evolución semanal (últimas 8 semanas) para la comparación: misma métrica y semana para las dos personas.
  async function evolutionHtml(meId,otherId,otherName){
    if(v54Enabled===false)return '';
    const [a,b]=await Promise.all([client.rpc('community_weekly_history',{p_user:meId,p_weeks:8}),client.rpc('community_weekly_history',{p_user:otherId,p_weeks:8})]);
    if(a.error||b.error){noteV54(a.error||b.error);return '';}
    v54Enabled=true;
    const S=AS(),weeks=[];const monday=new Date(S.weekStart(localDateKey())+'T12:00:00');
    for(let i=7;i>=0;i--){const d=new Date(monday);d.setDate(d.getDate()-7*i);weeks.push(localDateKey(d));}
    const mine=new Map((a.data||[]).map(x=>[x.week_start,x])),theirs=new Map((b.data||[]).map(x=>[x.week_start,x]));
    const enough=[...mine.keys()].length>=2&&[...theirs.keys()].length>=2;
    if(!enough)return `<section class="cm-section"><h4>Evolución semanal</h4><p class="muted small">La evolución aparece cuando las dos personas tengan datos de al menos dos semanas. Se guarda una foto de las estadísticas cada semana.</p></section>`;
    const chart=(key,label,max,fmt)=>{const top=Math.max(max,...weeks.map(w=>Math.max(Number(mine.get(w)?.[key])||0,Number(theirs.get(w)?.[key])||0)))||1;
      return `<div class="cm-evo"><div class="cm-evo-head"><strong>${esc(label)}</strong><span class="cm-evo-legend"><i class="is-me"></i>Vos <i></i>${esc(otherName)}</span></div><div class="cm-evo-bars" role="img" aria-label="${esc(label)}: últimas 8 semanas">${weeks.map(w=>{const m=mine.get(w),t=theirs.get(w);const bar=(row,cls)=>row?`<i class="${cls}" style="height:${Math.max(4,Math.round((Number(row[key])||0)/top*100))}%" title="${esc(fmt(row[key]))}"></i>`:`<i class="${cls} is-empty" title="Sin datos disponibles"></i>`;return `<span class="cm-evo-wk">${bar(m,'is-me')}${bar(t,'')}<small>${esc(new Date(w+'T12:00:00').toLocaleDateString(undefined,{day:'numeric',month:'numeric'}))}</small></span>`;}).join('')}</div></div>`;};
    return `<section class="cm-section"><h4>Evolución semanal</h4>${chart('active_days','Días activos por semana',7,v=>`${Number(v)||0} días`)}${chart('workouts','Entrenamientos y actividades por semana',1,v=>String(Number(v)||0))}<p class="muted small cm-footnote">Cada barra es una semana (de lunes a domingo). Una barra gris significa «Sin datos disponibles» para esa semana: no se estima.</p></section>`;
  }
  // Avisos (campanita): te siguen, te piden seguirte, aceptan tu solicitud, te escriben o te superan en el rango.
  let alertsTimer=null;
  async function loadAlertCount(){
    const badge=$('communityAlertsBadge');if(!badge)return;
    if(!authReady()||v54Enabled===false){badge.hidden=true;return;}
    const r=await client.from('community_notifications').select('id',{count:'exact',head:true}).eq('user_id',user.id).is('read_at',null);
    if(r.error){noteV54(r.error);badge.hidden=true;if(v54Enabled===false&&$('communityTabAlerts'))$('communityTabAlerts').hidden=true;return;}
    v54Enabled=true;const n=Number(r.count)||0;badge.hidden=!n;badge.textContent=n>9?'9+':String(n);
  }
  const ALERT_TEXT={follow:'empezó a seguirte',follow_request:'quiere seguirte',follow_accepted:'aceptó tu solicitud',message:'te escribió',rank_passed:'te superó en el rango general'};
  async function loadAlerts(){
    const root=$('communityAlerts');if(!root)return;
    if(!authReady()){root.innerHTML='<div class="empty"><p>Iniciá sesión para ver tus avisos.</p></div>';return;}
    root.innerHTML='<div class="cm-skeleton" aria-hidden="true"><i></i><i></i></div>';
    const r=await client.rpc('community_notifications_list',{p_limit:40});
    if(r.error){noteV54(r.error);root.innerHTML=`<div class="empty"><p>${esc(v54Enabled===false?V54_HINT:friendlySupabaseError(r.error,'cargar tus avisos'))}</p></div>`;return;}
    v54Enabled=true;const rows=r.data||[],urlOf=await signedMany(rows.map(x=>x.avatar_path));
    root.innerHTML=rows.length?`<ul class="cm-alerts">${rows.map(x=>`<li class="${x.read_at?'':'is-new'}"><button type="button" data-alert-kind="${esc(x.kind)}" data-alert-actor="${esc(x.actor_id)}">${avatarHtml(x,urlOf)}<span><strong>${esc(x.display_name||x.username)}</strong> ${esc(ALERT_TEXT[x.kind]||'')}<small class="muted">${esc(timeAgo(x.created_at))}</small></span></button></li>`).join('')}</ul>`:'<div class="empty cm-empty"><strong>No tenés avisos</strong><p>Acá vas a ver cuando alguien te siga, te escriba o te supere en el ranking.</p></div>';
    root.querySelectorAll('[data-alert-kind]').forEach(b=>b.addEventListener('click',async()=>{
      const kind=b.dataset.alertKind,actor=b.dataset.alertActor;
      if(kind==='message'){showCommunitySubView('messages');await loadChatContacts();openChat(actor);}
      else if(kind==='follow_request'){showCommunitySubView('profile');$('communityFollowRequests')?.scrollIntoView({behavior:'smooth',block:'center'});}
      else openUser(actor);
    }));
    // Al abrir la lista se marcan como leídos (en la base).
    if(rows.some(x=>!x.read_at)){await client.from('community_notifications').update({read_at:new Date().toISOString()}).eq('user_id',user.id).is('read_at',null);loadAlertCount();}
  }
  function startAlertPoll(){if(alertsTimer)return;alertsTimer=setInterval(()=>{if(document.visibilityState==='visible'&&authReady()&&v54Enabled!==false&&document.getElementById('view-community')?.classList.contains('active'))loadAlertCount();},60000);}
  // Historial privado de «Mi físico»: solo lo ve la persona; puede borrar cada entrada (y sus fotos).
  async function loadPhysiqueHistory(){
    const root=$('communityPhysiqueHistory');if(!root)return;
    if(!authReady()||v54Enabled===false){root.hidden=true;return;}
    const r=await client.from('community_physique_history').select('id,kind,before_path,after_path,photo_path,description,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(24);
    if(r.error){noteV54(r.error);root.hidden=true;return;}
    v54Enabled=true;const rows=r.data||[];root.hidden=false;
    if(!rows.length){root.innerHTML='<h4>Historial privado</h4><p class="muted small">Cuando cambies una foto, la anterior se guarda acá. Solo la ves vos.</p>';return;}
    const urlOf=await signedMany(rows.flatMap(x=>[x.before_path,x.after_path,x.photo_path]));
    root.innerHTML=`<h4>Historial privado <small class="muted">solo lo ves vos</small></h4><ul class="cm-phys-history">${rows.map(x=>{const imgs=[x.before_path,x.after_path,x.photo_path].filter(Boolean);return `<li><div class="cm-phys-hthumbs">${imgs.map(pth=>`<button type="button" data-phys-view="${esc(pth)}" data-caption="${esc(dateLabel(String(x.created_at).slice(0,10)))}" aria-label="Ver foto del ${esc(dateLabel(String(x.created_at).slice(0,10)))}"><img src="${esc(urlOf(pth))}" alt=""></button>`).join('')}</div><small>${esc(x.kind==='pair'?'Antes y después':'Una foto')} · ${esc(dateLabel(String(x.created_at).slice(0,10)))}</small><button class="btn ghost btn-sm" type="button" data-phys-history-delete="${esc(x.id)}">Borrar</button></li>`;}).join('')}</ul>`;
    bindPhysiqueViews(root,urlOf);
    root.querySelectorAll('[data-phys-history-delete]').forEach(b=>b.addEventListener('click',async()=>{
      if(!confirm(tr('¿Borrar estas fotos de tu historial? No se pueden recuperar.')))return;
      const row=rows.find(x=>String(x.id)===b.dataset.physHistoryDelete),paths=[row?.before_path,row?.after_path,row?.photo_path].filter(Boolean);
      const {error}=await client.from('community_physique_history').delete().eq('id',row.id).eq('user_id',user.id);
      if(error){setStatus('communityPhysiqueStatus',friendlySupabaseError(error,'borrar del historial'));return;}
      if(paths.length)await client.storage.from(bucket).remove(paths).catch(()=>{});
      loadPhysiqueHistory();
    }));
  }

  // ---------- Comparación: «Tu progreso» y «Progreso de tu amigo», misma métrica, unidad y período ----------
  function compareValue(row,v){
    if(v==null)return 'Sin datos disponibles';
    if(row.kind==='text')return LEVEL_LABEL[v]||'Sin datos disponibles';
    if(row.kind==='rank')return MRK()?.RANKS?.[v]?.name||'Sin entrenar';
    if(row.key==='best_plank_seconds')return formatMetric('plank',v);
    if(row.key==='run_km_30d')return formatMetric('running',v);
    return `${Number(v).toLocaleString(undefined,{maximumFractionDigits:1})}${row.unit?' '+row.unit:''}`;
  }
  // v61: el versus también compara músculo por músculo (rango del Mapa de avances de cada persona, publicado por ella).
  async function muscleCompareHtml(uid,them){
    const A=window.FittFormaAnatomy,R=MRK();if(extrasEnabled===false||!A?.muscleFillSvg||!R)return '';
    const [x,y]=await Promise.all([client.rpc('community_athlete_extras',{p_user:user.id}),client.rpc('community_athlete_extras',{p_user:uid})]);
    if((x.error&&missingExtras(x.error))||(y.error&&missingExtras(y.error))){extrasEnabled=false;return '';}
    const clean=r=>{const o={};for(const [k,v] of Object.entries(r&&typeof r==='object'?r:{})){const n=Number(v);if(Number.isInteger(n)&&R.RANKS[n])o[k]=n;}return o;};
    const mine=clean(x.data?.[0]?.muscle_ranks),theirs=clean(y.data?.[0]?.muscle_ranks),name=esc(them.display_name||them.username);
    if(!Object.keys(mine).length&&!Object.keys(theirs).length)return `<section class="cm-section cm-muscle-vs"><h4>Músculos</h4><p class="muted small">Ninguno de los dos tiene músculos con rango todavía.</p></section>`;
    const fills=r=>Object.fromEntries(Object.entries(r).map(([k,v])=>[k,R.RANKS[v].color]));
    const names=A.MUSCLES||{},ids=[...new Set([...Object.keys(mine),...Object.keys(theirs)])].filter(id=>names[id]);
    ids.sort((a,b)=>Math.max(mine[b]??-1,theirs[b]??-1)-Math.max(mine[a]??-1,theirs[a]??-1)||String(names[a]).localeCompare(names[b]));
    let win=0,lose=0,tie=0;
    const rows=ids.map(id=>{const m=mine[id],t=theirs[id],mv=m??-1,tv=t??-1;if(mv>tv)win++;else if(tv>mv)lose++;else tie++;
      const cell=v=>v==null?'<span class="cm-mvs-none">Sin entrenar</span>':rankChip(v,20);
      return `<li class="cm-mvs-row${mv>tv?' is-mine':tv>mv?' is-theirs':''}"><strong>${esc(names[id])}</strong><span class="cm-mvs-cell is-me">${cell(m)}</span><span class="cm-mvs-cell">${cell(t)}</span></li>`;}).join('');
    return `<section class="cm-section cm-muscle-vs"><h4>Músculos</h4>
      <div class="cm-mvs-maps"><figure>${A.muscleFillSvg(fills(mine),{label:'Tu rango por músculo'})}<figcaption>Vos</figcaption></figure><figure>${A.muscleFillSvg(fills(theirs),{label:`Rango por músculo de ${them.display_name||them.username}`})}<figcaption>${name}</figcaption></figure></div>
      <p class="cm-mvs-sum">${win} ${win===1?'músculo':'músculos'} a tu favor · ${lose} a favor de ${name} · ${tie} ${tie===1?'empate':'empates'}</p>
      <ul class="cm-mvs-list"><li class="cm-mvs-row cm-mvs-head" aria-hidden="true"><span></span><span>Vos</span><span>${name}</span></li>${rows}</ul>
      <p class="muted small">Rango del Mapa de avances (series efectivas de cada músculo, de Bronce a Leyenda). Cada persona lo publica desde su app.</p></section>`;
  }
  async function openCompare(uid){
    if(!authReady()){toast(authHint());return;}
    compareUser=uid;showCommunitySubView('compare');const root=$('communityCompare');root.innerHTML='<div class="cm-skeleton" aria-hidden="true"><i></i><i></i><i></i></div>';
    await syncStats();
    const [a,b]=await Promise.all([client.rpc('community_athlete_profile',{p_user:user.id}),client.rpc('community_athlete_profile',{p_user:uid})]);
    if(compareUser!==uid)return;
    if(a.error||b.error){const err=a.error||b.error;root.innerHTML=`<div class="empty"><p>${esc(isMissingFunction(err)?V53_HINT:friendlySupabaseError(err,'comparar el progreso'))}</p></div>`;return;}
    const me=a.data?.[0],them=b.data?.[0];
    if(!me||!them){root.innerHTML='<div class="empty"><strong>No se puede comparar</strong><p>El perfil no está disponible.</p></div>';return;}
    const urlOf=await signedMany([me.avatar_path,them.avatar_path]),theirName=esc(them.display_name||them.username);
    const head=`<div class="cm-vs"><div class="cm-vs-side is-me">${avatarHtml(me,urlOf,'lg')}<strong>Tu progreso</strong><small class="muted">@${esc(me.username)}</small></div><span class="cm-vs-mid" aria-hidden="true">VS</span><div class="cm-vs-side">${avatarHtml(them,urlOf,'lg')}<strong>Progreso de ${theirName}</strong><small class="muted">@${esc(them.username)}</small></div></div>`;
    let body='';
    if(me.stats_public===false)body=`<div class="notice"><strong>Tus estadísticas están ocultas.</strong><p class="small">Para comparar, las dos personas tienen que mostrarlas. Podés activarlas en Mi perfil.</p><button class="btn btn-sm" type="button" data-community-go="profile">Ir a Mi perfil</button></div>`;
    else if(!them.can_view||!them.stats_visible)body=`<div class="notice"><strong>No hay datos para comparar.</strong><p class="small">${!them.can_view?'Es un perfil privado: cuando acepte tu solicitud vas a poder comparar.':`${theirName} no comparte sus estadísticas de entrenamiento.`}</p></div>`;
    else{
      const rows=AS().compare(me,them);
      body=`<ul class="cm-compare-list">${rows.map(row=>{
        const both=row.mine!=null&&row.theirs!=null&&row.kind!=='text';
        const max=both?Math.max(Number(row.mine),Number(row.theirs),row.kind==='rank'?8:0)||1:1;
        const bar=v=>both?`<span class="cm-cmp-bar"><i style="width:${Math.max(4,Math.round(Number(v)/max*100))}%"></i></span>`:'';
        const lead=both?(row.diff>0?`Vos +${compareValue({...row,kind:'num'},Math.abs(row.diff))}`:row.diff<0?`${esc(them.display_name||them.username)} +${compareValue({...row,kind:'num'},Math.abs(row.diff))}`:'Empate'):'';
        return `<li class="cm-cmp-row"><div class="cm-cmp-label"><strong>${esc(row.label)}</strong><small class="muted">${esc(row.period)}</small></div><div class="cm-cmp-vals"><span class="is-me${row.mine==null?' is-empty':''}">${esc(compareValue(row,row.mine))}${bar(row.mine)}</span><span class="${row.theirs==null?'is-empty':''}">${esc(compareValue(row,row.theirs))}${bar(row.theirs)}</span></div>${lead&&row.kind!=='rank'?`<small class="cm-cmp-lead">${esc(lead)}</small>`:''}</li>`;}).join('')}</ul>
        ${await muscleCompareHtml(uid,them)}
        ${await evolutionHtml(user.id,uid,them.display_name||them.username)}
        <p class="muted small cm-footnote">Se compara la misma métrica, con la misma unidad y el mismo período, con los registros de cada persona en la app. Cuando a alguien le falta un dato se muestra «Sin datos disponibles»: no se estima. La app publica solo los últimos 30 días, así que no hay comparación por semana. No es un diagnóstico médico ni una medición de masa muscular: sirve para motivarse y ponerse objetivos.</p>`;
    }
    root.innerHTML=head+body+`<div class="btn-row"><button class="btn ghost" type="button" data-compare-profile>Ver el perfil de ${theirName}</button></div>`;
    bindGo(root);root.querySelector('[data-compare-profile]')?.addEventListener('click',()=>openUser(uid));
  }
  // Perfil sin la migración v53 (datos de v50): sin estadísticas.
  async function openUserLegacy(uid,opts={}){
    if(!client||!uid)return;if(user&&uid===user.id&&!opts.asOthers){showCommunitySubView('profile');return;}
    viewedUser=uid;showCommunitySubView('user');const root=$('communityUserProfile');root.dataset.owner=uid;root.innerHTML='<p class="muted small">Cargando perfil…</p>';
    const {data:p,error}=await client.from('community_profiles').select(profileCols()).eq('user_id',uid).maybeSingle();
    if(error||!p){
      // v50: perfil privado (o sin acceso al contenido): datos básicos y aviso claro, sin exponer publicaciones.
      const b=await client.rpc('community_profile_basic',{p_user:uid});const bp=b.data?.[0];
      if(!bp){root.innerHTML='<div class="empty"><strong>Perfil no disponible</strong><p>Puede haber sido eliminado o haber un bloqueo entre las cuentas.</p></div>';return;}
      const urlOfB=await signedMany([bp.avatar_path]),fs=bp.follow_status||'';
      root.innerHTML=`<div class="community-profile-header">${avatarHtml(bp,urlOfB,'lg')}<div class="community-profile-id"><strong>${esc(bp.display_name||bp.username)}</strong><span class="muted small">@${esc(bp.username)} · Privado</span></div></div><div class="notice community-private-notice"><strong>Este perfil es privado.</strong><p class="small">${fs==='pending'?'Tu solicitud está pendiente: vas a ver sus publicaciones cuando la acepte.':'Seguilo y, cuando acepte tu solicitud, vas a ver sus publicaciones, su descripción y sus insignias.'}</p></div>${user?`<div class="btn-row"><button class="btn${fs?' secondary':''}" type="button" data-user-follow>${fs==='pending'?'Cancelar solicitud':'Solicitar seguir'}</button><button class="btn ghost" type="button" data-community-block>Bloquear</button></div>`:''}`;
      root.querySelector('[data-user-follow]')?.addEventListener('click',e=>toggleFollow(uid,e.currentTarget));root.querySelector('[data-community-block]')?.addEventListener('click',()=>blockUser(uid));return;
    }
    const [stats,follow,back]=await Promise.all([client.rpc('community_profile_stats',{p_user:uid}),user?client.from('community_follows').select('status').eq('follower_id',user.id).eq('following_id',uid).maybeSingle():Promise.resolve({data:null}),user?client.from('community_follows').select('status').eq('follower_id',uid).eq('following_id',user.id).maybeSingle():Promise.resolve({data:null})]);
    const s=stats.data?.[0]||null,state=follow.data?.status||'',mutual=state==='accepted'&&back.data?.status==='accepted';
    const canSee=p.visibility==='public'||state==='accepted';
    const urlOf=await signedMany([p.avatar_path]);
    root.innerHTML=`<div class="community-profile-header">${avatarHtml(p,urlOf,'lg')}<div class="community-profile-id"><strong>${esc(p.display_name||p.username)}</strong><span class="muted small">@${esc(p.username)}${p.visibility==='private'?' · Privado':''}</span><div class="community-featured">${featuredHtml(p.featured_badges,26)}</div></div></div>${p.bio?`<p class="community-profile-bio">${esc(p.bio)}</p>`:''}<div class="community-profile-stats">${s?statsHtml(s.posts,s.followers,s.following):'<span class="muted small">Datos de seguidores no disponibles</span>'}</div>${user?`<div class="btn-row community-profile-actions"><button class="btn${state?' secondary':''}" type="button" data-user-follow="${esc(uid)}">${state==='accepted'?'Dejar de seguir':state==='pending'?'Cancelar solicitud':p.visibility==='private'?'Solicitar seguir':'Seguir'}</button>${mutual?`<button class="btn ghost" type="button" data-user-message="${esc(uid)}">Mensaje</button>`:''}<button class="btn ghost" type="button" data-community-block="${esc(uid)}">Bloquear</button></div>`:'<p class="muted small">Iniciá sesión para seguir o escribir.</p>'}<div class="community-section-head"><h4>Publicaciones</h4></div><div class="community-grid" id="communityUserGrid">${canSee?'<p class="muted small">Cargando…</p>':'<div class="empty community-private-lock"><strong>Esta cuenta es privada</strong><p>Seguila para ver sus publicaciones cuando acepte tu solicitud.</p></div>'}</div>`;
    root.querySelector('[data-user-follow]')?.addEventListener('click',e=>toggleFollow(uid,e.currentTarget));
    root.querySelector('[data-user-message]')?.addEventListener('click',async()=>{showCommunitySubView('messages');await loadChatContacts();openChat(uid);});
    root.querySelector('[data-community-block]')?.addEventListener('click',()=>blockUser(uid));
    if(canSee){const {data:posts}=await client.from('community_posts').select(postSelect()).eq('user_id',uid).order('created_at',{ascending:false}).limit(30);const list=posts||[];const tileUrl=await signedMany(list.flatMap(x=>[x.image_path,(x.post_kind||'transformation')==='transformation'?x.after_path:null]));const grid=$('communityUserGrid');if(grid&&viewedUser===uid){grid.innerHTML=list.length?list.map(x=>gridTile({...x,community_profiles:p},tileUrl)).join(''):'<div class="empty"><p>Todavía no publicó nada.</p></div>';bindGrid(grid);}}
  }
  async function renderOwnGrid(){
    const grid=$('communityOwnGrid');if(!grid)return;
    if(!authReady()){grid.innerHTML='<div class="empty"><p>Iniciá sesión para ver tu perfil social.</p></div>';return;}
    let posts=[];
    if(ownTab==='saved'){
      if(!savedEnabled||schemaV49===false){grid.innerHTML='<div class="empty"><p>Para guardar publicaciones, aplicá la migración v49 de Comunidad en Supabase.</p></div>';return;}
      const s=await client.from('community_saved_posts').select('post_id,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(60);
      const ids=(s.data||[]).map(x=>x.post_id);
      if(ids.length){const r=await client.from('community_posts').select(postSelect()).in('id',ids);const byId=new Map((await withAuthors(r.data||[])).map(x=>[x.id,x]));posts=ids.map(id=>byId.get(id)).filter(Boolean);}
    }else{const r=await client.from('community_posts').select(postSelect()).eq('user_id',user.id).order('created_at',{ascending:false}).limit(60);posts=(r.data||[]).map(x=>({...x,community_profiles:ownProfile}));}
    const urlOf=await signedMany(posts.flatMap(x=>[x.image_path,(x.post_kind||'transformation')==='transformation'?x.after_path:null]));
    grid.innerHTML=posts.length?posts.map(x=>gridTile(x,urlOf)).join(''):`<div class="empty"><p>${ownTab==='saved'?'Todavía no guardaste publicaciones. Tocá el ícono de guardar en el feed.':'Todavía no publicaste nada.'}</p>${ownTab==='saved'?'':'<button class="btn" type="button" data-community-go="publish">Crear una publicación</button>'}</div>`;
    bindGrid(grid);grid.querySelectorAll('[data-community-go]').forEach(b=>b.addEventListener('click',()=>showCommunitySubView(b.dataset.communityGo)));
  }
  // Una publicación abierta desde una grilla, con las mismas acciones que en el feed.
  async function openPostDialog(id){
    dialogPostId=id;
    const dlg=$('communityPostDialog'),body=$('communityPostDialogBody');if(!dlg||!body||!client)return;
    const r=await client.from('community_posts').select(postSelect()).eq('id',id).maybeSingle();
    const data=r.data?(await withAuthors([r.data]))[0]:null;
    if(r.error||!data){toast('La publicación ya no está disponible.');return;}
    const ctx=await bundle([data]);body.innerHTML=renderPostCard(data,ctx);bindFeedActions(body);
    if(typeof dlg.showModal==='function'&&!dlg.open)dlg.showModal();else dlg.setAttribute('open','');
  }

  async function emailLogin(e){e.preventDefault();if(!client)return setStatus('communityEmailStatus',authHint());const email=$('communityEmail').value.trim(),password=$('communityPassword').value;const {error}=await client.auth.signInWithPassword({email,password});if(error){setStatus('communityEmailStatus',`No se pudo iniciar sesión: ${error.message}`);return;}$('communityPassword').value='';setStatus('communityEmailStatus','Sesión iniciada.');}
  async function emailRegister(){if(!client)return setStatus('communityEmailStatus',authHint());const email=$('communityEmail').value.trim(),password=$('communityPassword').value;if(!email||password.length<8)return setStatus('communityEmailStatus','Ingresá un correo válido y una contraseña de al menos 8 caracteres.');const {data,error}=await client.auth.signUp({email,password});if(error){setStatus('communityEmailStatus',`No se pudo crear la cuenta: ${error.message}`);return;}if(data.session)setStatus('communityEmailStatus','Cuenta creada y sesión iniciada.');else setStatus('communityEmailStatus','Cuenta creada. Revisá tu correo para confirmar la dirección antes de iniciar sesión.');}
  async function googleLogin(){if(!client)return setStatus('communityProfileStatus',authHint());const {error}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:window.location.href.split('#')[0]}});if(error)setStatus('communityProfileStatus',`No se pudo iniciar con Google: ${error.message}`);}
  // v53: detecta qué columnas de publicaciones tiene el proyecto (antes lo hacía el feed) y confirma la conexión.
  async function probeSchema(){
    if(!client)return;
    let r=await client.from('community_posts').select(postSelect()).limit(1);
    if(r.error&&isMissingColumn(r.error)&&schemaV49!==false&&/linked_session|featured_badges/.test(String(r.error.message))){schemaV49=false;r=await client.from('community_posts').select(postSelect()).limit(1);}
    if(r.error&&isMissingColumn(r.error)&&schemaV41!==false){markLegacySchema();updateKindAvailability();return;}
    if(r.error){connectionStatus(friendlySupabaseError(r.error,'consultar las publicaciones'));return;}
    if(schemaV41===null){schemaV41=true;updateKindAvailability();}
  }
  function loadCurrentView(){
    if(currentSubView==='world'){loadSuggested();return loadDirectory(true);}
    if(currentSubView==='ranking')return loadRanking();
    if(currentSubView==='friends'){loadChallenge();return loadFriends(true);}
    if(currentSubView==='alerts')return loadAlerts();
    if(currentSubView==='profile'){if(authReady()){loadOwnExtras();loadOwnPhysique();loadOwnBody();}return renderOwnGrid();}
    if(currentSubView==='user'&&viewedUser)return openUser(viewedUser,{asOthers:viewedUser===user?.id});
    if(currentSubView==='compare'&&compareUser)return openCompare(compareUser);
  }
  async function refresh(){if(!client){setControls();return;}if(user){try{await ensureProfile();await loadFollowRequests();}catch(e){setStatus('communityProfileStatus',`No se pudo preparar el perfil: ${e.message}`);}}setControls();await probeSchema();await loadCurrentView();renderStatsNotice();loadAlertCount();startAlertPoll();syncStats().then(()=>{if(currentSubView==='ranking')loadRanking();}).catch(()=>{});await loadChatContacts();await loadBlockedUsers();updateKindAvailability();renderPostPreview();await loadModeration();if(currentSubView==='profile')renderOwnGrid();}
  function init(supabase,userSession,diagnostic=''){client=supabase||null;user=userSession||null;connectionMessage=client?'':String(diagnostic||connectionMessage||'');if(client)connectionStatus('Cliente de Supabase inicializado. Comprobando tablas y permisos de Comunidad…');else configIssueStatus(diagnostic||'Supabase todavía no está conectado.');setControls();if(client)return refresh();return loadCurrentView();}
  async function testConnection(){
    if(!client)return {ok:false,stage:'config',message:authHint()};
    const coreChecks=[['community_profiles','user_id'],['community_posts','id'],['community_follows','follower_id'],['community_likes','post_id'],['community_comments','id']];
    try{
      const coreResults=await Promise.all(coreChecks.map(async([table,column])=>({table,...await client.from(table).select(column,{head:true,count:'exact'}).limit(1)})));
      const failed=coreResults.find(r=>r.error);
      if(failed)return {ok:false,stage:'database',message:friendlySupabaseError(failed.error,`comprobar la tabla ${failed.table}`),table:failed.table};
      // Verify the two read-only RPCs that power discovery/search and feed ranking.
      const functionChecks=await Promise.all([
        {name:'search_community_profiles',run:()=>client.rpc('search_community_profiles',{search_term:'ff'})},
        {name:'community_ranked_post_ids',run:()=>client.rpc('community_ranked_post_ids')}
      ].map(async check=>({name:check.name,...await check.run()})));
      const failedFunction=functionChecks.find(result=>result.error);
      if(failedFunction)return {ok:false,stage:'functions',message:friendlySupabaseError(failedFunction.error,`comprobar la función ${failedFunction.name}`),function:failedFunction.name};
      const warnings=[];
      const v53=await client.rpc('community_people',{p_search:'',p_after:null,p_limit:1,p_scope:'all'});
      if(v53.error)warnings.push(isMissingFunction(v53.error)?V53_HINT:friendlySupabaseError(v53.error,'comprobar el directorio de deportistas'));
      if(authReady()){
        const optionalChecks=[
          ['community_messages',q=>q.or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)],
          ['community_blocks',q=>q.eq('blocker_id',user.id)],
          ['user_app_data',q=>q.eq('user_id',user.id)]
        ];
        const optionalResults=await Promise.all(optionalChecks.map(async([table,filter])=>{let query=client.from(table).select(table==='community_messages'?'id':table==='community_blocks'?'blocker_id':'user_id',{head:true,count:'exact'});query=filter(query);return {table,...await query.limit(1)};}));
        for(const result of optionalResults)if(result.error)warnings.push(friendlySupabaseError(result.error,`comprobar la tabla opcional ${result.table}`));
      }
      const coreMessage='Conexión correcta: URL, clave pública, 5 tablas principales y 2 funciones de búsqueda/ordenamiento de Comunidad responden a consultas de solo lectura.';
      if(warnings.length)return {ok:true,stage:'database',message:coreMessage+' Hay funciones adicionales que requieren revisión: '+warnings.join(' | '),warnings};
      return {ok:true,stage:'database',message:coreMessage+(authReady()?' También se comprobaron chat, bloqueos y sincronización de la cuenta.':' Iniciá sesión para comprobar además chat, bloqueos y sincronización de la cuenta.')};
    }catch(error){return {ok:false,stage:'network',message:friendlySupabaseError(error,'comprobar la conexión con Supabase')};}
  }
  function setSession(supabase,userSession){client=supabase||client;const wasId=user?.id;user=userSession||null;if(user&&user.id!==wasId){ownStats=null;ownStatsLoaded=false;statsSig='';setTimeout(()=>{syncStats().catch?.(()=>{});syncBody();},1500);ownBody=null;ownBodyLoaded=false;}if(!user){ownProfile=null;stopChatPoll();['communityChatMessages','communityReportsList'].forEach(id=>{const el=$(id);if(el)el.innerHTML='';});if($('communityChatText'))$('communityChatText').value='';if($('communityModerationCard'))$('communityModerationCard').hidden=true;if($('communityDisplayName'))$('communityDisplayName').value='';if($('communityUsername'))$('communityUsername').value='';if($('communityBio'))$('communityBio').value='';if($('communityVisibility'))$('communityVisibility').value='private';if($('communityOwnName'))$('communityOwnName').textContent='Tu perfil';if($('communityOwnAvatar'))$('communityOwnAvatar').innerHTML='<span aria-hidden="true">FF</span>';if($('communityOwnHandle'))$('communityOwnHandle').textContent='';if($('communityOwnBio'))$('communityOwnBio').textContent='';if($('communityOwnFeatured'))$('communityOwnFeatured').innerHTML='';if($('communityOwnStats'))$('communityOwnStats').innerHTML=statsHtml(0,0,0);if($('communityConversations'))$('communityConversations').innerHTML='';if($('communityFollowRequests'))$('communityFollowRequests').textContent='Iniciá sesión para administrar solicitudes.';if($('communitySearchResults'))$('communitySearchResults').innerHTML='';if($('communityBlockedList'))$('communityBlockedList').textContent='Iniciá sesión para administrar los bloqueos.';}setControls();updateKindAvailability();ownStats=null;ownStatsLoaded=false;statsSig='';friendPositions=new Map();ownPhysique={pair:null,single:null};if($('communityAlertsBadge'))$('communityAlertsBadge').hidden=true;if($('communityChallenge'))$('communityChallenge').hidden=true;if($('communityOwnFlag'))$('communityOwnFlag').innerHTML='';if($('communityPhysiqueEdit'))$('communityPhysiqueEdit').innerHTML='';reflectStatsToggles();renderStatsNotice();if(client)Promise.resolve().then(()=>refresh());else loadCurrentView();}
  const communityViews=['world','ranking','friends','publish','messages','profile','user','compare','alerts'];
  const MAIN_TABS=['world','ranking','friends'];
  function showCommunitySubView(name,focusTab=false){
    if(name==='feed'||name==='explore')name='world';
    if(!communityViews.includes(name))name='world';
    const previous=currentSubView;currentSubView=name;setTimeout(renderAvatarOffer,0);if(!['user','compare'].includes(name))lastTab=name;
    if(name!=='messages')stopChatPoll();
    const activeTab=MAIN_TABS.includes(name)?name:['user','compare'].includes(name)&&MAIN_TABS.includes(lastTab)?lastTab:name;
    document.querySelectorAll('[data-community-tab]').forEach(button=>{
      const selected=button.dataset.communityTab===activeTab;
      if(button.getAttribute('role')==='tab'){button.setAttribute('aria-selected',selected?'true':'false');button.tabIndex=selected||(!MAIN_TABS.includes(activeTab)&&button.dataset.communityTab==='world')?0:-1;}
      else button.setAttribute('aria-pressed',selected?'true':'false');
      button.classList.toggle('is-active',selected);if(selected&&focusTab)button.focus();
    });
    document.querySelectorAll('[data-community-panel]').forEach(panel=>{
      const active=panel.dataset.communityPanel===name;panel.hidden=!active;panel.classList.toggle('is-active',active);
    });
    renderStatsNotice();
    if(name==='world'&&previous!=='world'&&client){loadDirectory(true);loadSuggested();}
    else if(name==='ranking'&&client)loadRanking();
    else if(name==='friends'&&client){loadFriends(true);loadChallenge();}
    else if(name==='alerts'&&client)loadAlerts();
    else if(name==='messages'&&client){loadChatContacts();}
    else if(name==='profile'){renderOwnGrid();fillCountryOptions();if(authReady()){loadFollowRequests();loadBlockedUsers();loadModeration();refreshOwnCounts();syncFeaturedBadges();syncStats();loadOwnExtras();loadOwnPhysique();loadOwnBody().then(syncBody);}}
    else if(name==='publish'){fillAchievementOptions();fillSessionOptions();renderPostPreview();}
    if(name!==previous)document.getElementById('view-community')?.scrollIntoView?.({block:'start'});
  }
  function bindCommunitySubnavigation(){
    document.querySelectorAll('[data-community-tab]').forEach(button=>button.addEventListener('click',()=>showCommunitySubView(button.dataset.communityTab)));
    const tabs=[...document.querySelectorAll('[role="tab"][data-community-tab]')];
    tabs.forEach((button,index)=>button.addEventListener('keydown',event=>{
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();
      let next=index;
      if(event.key==='ArrowLeft')next=(index-1+tabs.length)%tabs.length;else if(event.key==='ArrowRight')next=(index+1)%tabs.length;else if(event.key==='Home')next=0;else next=tabs.length-1;
      showCommunitySubView(tabs[next].dataset.communityTab,true);
    }));
    showCommunitySubView('world');
  }
  function bind(){
    bindCommunitySubnavigation();
    $('communityRetryConnection')?.addEventListener('click',async()=>{const button=$('communityRetryConnection');if(button)button.disabled=true;connectionStatus('Revisando la configuración y la conexión…');try{if(typeof window.FittFormaRetrySupabase==='function'){const result=await window.FittFormaRetrySupabase();if(!result?.ok&&result?.message)configIssueStatus(result.message);else if(result?.ok){const check=await testConnection();connectionStatus(check.message);if(check.ok)await loadCurrentView();}}else connectionStatus('La función de comprobación no está disponible. Publicá la última versión y recargá la página.');}catch(error){connectionStatus(`Falló la comprobación: ${error.message||'error desconocido'}`);}finally{if(button)button.disabled=false;}});
    document.querySelectorAll('[data-own-tab]').forEach(b=>b.addEventListener('click',()=>{ownTab=b.dataset.ownTab;document.querySelectorAll('[data-own-tab]').forEach(x=>{const on=x===b;x.classList.toggle('is-active',on);x.setAttribute('aria-pressed',String(on));});renderOwnGrid();}));
    document.querySelector('[data-community-home]')?.addEventListener('click',()=>showCommunitySubView('world'));
    $('communityUserBack')?.addEventListener('click',()=>showCommunitySubView(lastTab||'world'));$('communityCompareBack')?.addEventListener('click',()=>viewedUser&&viewedUser===compareUser?openUser(viewedUser):showCommunitySubView(lastTab||'world'));
    document.querySelectorAll('[data-ranking-scope]').forEach(b=>b.addEventListener('click',()=>{rankScope=b.dataset.rankingScope;document.querySelectorAll('[data-ranking-scope]').forEach(x=>{const on=x===b;x.classList.toggle('active',on);x.setAttribute('aria-pressed',String(on));});loadRanking();}));
    $('communityFriendsMore')?.addEventListener('click',()=>loadFriends(false));
    document.querySelectorAll('[data-ranking-period]').forEach(b=>b.addEventListener('click',()=>{rankPeriod=b.dataset.rankingPeriod;loadRanking();}));
    document.querySelectorAll('#view-community [data-community-go]').forEach(b=>b.addEventListener('click',()=>showCommunitySubView(b.dataset.communityGo)));
    $('communityViewOwnPublic')?.addEventListener('click',()=>{if(authReady())openUser(user.id,{asOthers:true});else toast(authHint());});
    $('communityStatsPublic')?.addEventListener('change',async e=>{const ok=await setStatsPublic(e.target.checked);if(!ok)reflectStatsToggles();});
    $('communityStatsNoticeOk')?.addEventListener('click',()=>{setNotice('1');renderStatsNotice();syncStats();});
    $('communityStatsNoticeHide')?.addEventListener('click',()=>setStatsPublic(false));
    $('communityOwnAvatarBtn')?.addEventListener('click',ownAvatarTapped);
    $('communityPhotoViewer')?.addEventListener('click',e=>{if(e.target.closest('[data-close-viewer]')||e.target===e.currentTarget)closeViewer();});
    ['communityPhysiqueBefore','communityPhysiqueAfter','communityPhysiqueSingle'].forEach(id=>$(id)?.addEventListener('change',e=>physiqueFileChosen(e.target)));
    $('communityShowMuscles')?.addEventListener('change',e=>setShowMuscles(e.target.checked));
    BODY_FIELDS.forEach(([k,id])=>$(id)?.addEventListener('change',e=>setBodyField(k,e.target.checked)));
    $('communityEditProfileToggle')?.addEventListener('click',e=>{const box=$('communityProfileEditor');const open=!box.classList.contains('is-open');box.classList.toggle('is-open',open);e.currentTarget.setAttribute('aria-expanded',String(open));if(open)box.scrollIntoView({behavior:'smooth',block:'start'});});
    $('communityChatWho')?.addEventListener('click',e=>{const uid=e.currentTarget.dataset.uid;if(uid)openUser(uid);});
    $('communityAvatarInput')?.addEventListener('change',e=>changeAvatar(e.target.files?.[0]));$('communityAvatarRemove')?.addEventListener('click',removeAvatar);$('communityPeopleMore')?.addEventListener('click',()=>loadDirectory(false));
    $('communityChatBack')?.addEventListener('click',closeChat);
    $('communityPostDialog')?.addEventListener('click',e=>{if(e.target.closest('[data-close-post-dialog]')||e.target===e.currentTarget)$('communityPostDialog').close();});
    $('communityProfileForm')?.addEventListener('submit',saveProfile);$('communityPostForm')?.addEventListener('submit',createPost);$('communitySearchForm')?.addEventListener('submit',searchUsers);$('communityClearSearch')?.addEventListener('click',clearSearch);$('communityGoogleLogin')?.addEventListener('click',googleLogin);$('communityEmailAuthForm')?.addEventListener('submit',emailLogin);$('communityEmailRegister')?.addEventListener('click',emailRegister);$('communityChatContact')?.addEventListener('change',e=>{if(e.target.value)openChat(e.target.value);});$('communityChatForm')?.addEventListener('submit',sendMessage);$('communityChatRefresh')?.addEventListener('click',loadChatContacts);$('communityChatDeleteConversation')?.addEventListener('click',deleteConversation);$('communityChatBlockContact')?.addEventListener('click',()=>blockUser($('communityChatContact')?.value));$('communitySignOut')?.addEventListener('click',async()=>{if(client){const {error}=await client.auth.signOut();if(error)setStatus('communityProfileStatus',error.message);}});
    document.querySelectorAll('[data-post-kind]').forEach((b,i,all)=>{b.addEventListener('click',()=>setPostKind(b.dataset.postKind));b.addEventListener('keydown',e=>{const d=e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0;if(!d)return;e.preventDefault();const next=all[(i+d+all.length)%all.length];setPostKind(next.dataset.postKind);next.focus();});});
    $('communityTextPostForm')?.addEventListener('submit',createKindPost);$('communityAchievementPostForm')?.addEventListener('submit',createKindPost);
    ['communityTextBody','communityTextImage','communityAchievementSelect','communityAchievementComment','communityLinkSession'].forEach(id=>{const el=$(id);if(el){el.addEventListener('input',renderPostPreview);el.addEventListener('change',renderPostPreview);}});
    window.addEventListener('fittforma:badgeschange',()=>{fillAchievementOptions();renderPostPreview();syncFeaturedBadges();if(currentSubView==='profile')renderOwnHeader();});
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&currentSubView==='messages'&&!$('communityChatView')?.hidden)loadMessages(true);});
    setPostKind('text');$('communityReportsList')?.addEventListener('click',moderationAction);
    const today=localDateKey();if($('communityEndDate'))$('communityEndDate').value=today;if($('communityStartDate'))$('communityStartDate').value=today;
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
  window.FittFormaCommunity={init,setSession,refresh,loadChatContacts,loadMessages,loadBlockedUsers,testConnection,syncStats,setStatsPublic,show:name=>showCommunitySubView(name),openProfile:uid=>openUser(uid),syncBody:()=>syncBody(),setAvatar:changeAvatar};
})();
