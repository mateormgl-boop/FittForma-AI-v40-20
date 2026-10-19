/* FittForma AI v49 — comunidad online: feed con novedades de quienes seguís, explorar, crear, mensajes y perfiles
 * sociales. Privacidad, bloqueos, moderación y ranking orgánico. Requiere supabase/community.sql y las migraciones.
 * Todo lo que se muestra sale de la base (RLS): no hay seguidores, publicaciones ni mensajes simulados. */
(()=>{
  'use strict';
  const $=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let client=null,user=null,searchTerm='',loading=false,feedSort='activity',connectionMessage='',currentSubView='feed',feedLimit=30,exploreFilter='all',ownTab='posts',ownProfile=null,exploreLoaded=false,chatPoll=null,lastTab='feed';
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
  function status(message){const target=currentSubView==='explore'?'communityExploreStatus':currentSubView==='publish'?'communityComposeStatus':currentSubView==='messages'?'communityChatStatus':currentSubView==='profile'?'communityProfileStatus':'communityFeedStatus';setStatus(target,message);}
  // Si la conexión está bien, el aviso se oculta (queda el texto para lectores de pantalla); si hay un problema, se muestra con el botón para comprobar.
  function connectionStatus(message){const el=$('communityConnectionStatus');if(!el)return;el.removeAttribute('data-state');setStatus('communityConnectionStatus',message);const ok=/correctamente|Conexión correcta/.test(String(message));el.closest('.community-connection-row')?.classList.toggle('is-ok',ok);}
  // Sin configuración: mensaje claro para quien usa la app y el detalle técnico plegado para quien la administra.
  function configIssueStatus(detail){const el=$('communityConnectionStatus');if(!el)return;el.closest('.community-connection-row')?.classList.remove('is-ok');el.dataset.state='warn';el.textContent='';const p=document.createElement('span');p.textContent='La comunidad en línea no está disponible ahora. El resto de la app funciona normal y tus datos siguen en este dispositivo.';el.append(p);if(detail){const d=document.createElement('details'),s=document.createElement('summary'),t=document.createElement('p');s.textContent='Detalle técnico';t.textContent=detail;d.append(s,t);el.append(d);console.warn('Comunidad:',detail);}}
  function authReady(){return !!client&&!!user;}
  function authHint(){return client?'Iniciá sesión desde Perfil para publicar, comentar o seguir personas.':(connectionMessage?'La comunidad en línea no está disponible ahora. El detalle está en el aviso de conexión de arriba.':'No se conectó Supabase. Tocá “Comprobar conexión” para revisar la configuración.');}
  function friendlySupabaseError(error,context='la comunidad'){const code=String(error?.code||''),message=String(error?.message||'Error desconocido');if(code==='PGRST201'||/more than one relationship was found/i.test(message))return `Supabase encontró más de una relación posible al ${context}. Esta versión identifica la clave foránea explícita; si el error continúa, revisá el nombre de la relación en los detalles. Detalle: ${message}`;if(code==='PGRST202'||/could not find the function|function .* does not exist|schema cache.*function/i.test(message))return `Supabase respondió, pero falta o no está publicada una función necesaria para ${context}. Revisá la versión de community.sql aplicada en este proyecto y los permisos EXECUTE. Detalle: ${message}`;if(code==='42P01'||code==='PGRST205'||/relation .* does not exist|could not find the table/i.test(message))return `Supabase respondió, pero falta una tabla necesaria para ${context}. Revisá que community.sql se haya ejecutado completamente en este mismo proyecto. Detalle: ${message}`;if(code==='42501'||/row-level security|permission denied|not allowed/i.test(message))return `Supabase está conectado, pero las políticas/permisos RLS impiden ${context}. No vuelvas a ejecutar SQL a ciegas; revisá el código ${code||'de permisos'} y el detalle: ${message}`;if(/failed to fetch|network|fetcherror|load failed/i.test(message))return `No se pudo llegar a Supabase desde el navegador. Revisá conexión, URL del proyecto y consola del navegador. Detalle: ${message}`;return `No se pudo completar ${context}.${code?` Código ${code}.`:''} Detalle: ${message}`;}
  const toast=msg=>{try{window.toast?.(msg);}catch{}};
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
  function featuredHtml(list,size=18){const E=window.FittFormaBadgeEngine;if(!E||!Array.isArray(list))return '';return list.slice(0,3).map(b=>{const level=Math.min(12,Math.max(1,Number(b?.level)||1)),rank=E.rankForLevel(level-1);return `<span class="community-mini-badge" title="${esc(b?.exerciseName||'')} · ${esc(rank.label)}">${E.medalSvg({rankKey:rank.key,numeral:rank.numeral,glyph:E.glyphFor({id:b?.exerciseId,name:b?.exerciseName,category:b?.category,measure:b?.measure}),category:b?.category,size,title:`${b?.exerciseName||''} · ${rank.label}`})}</span>`;}).join('');}
  // #hashtags clicables (se buscan en Explorar). El texto se escapa antes.
  function richText(text){return esc(text).replace(/(^|[\s(])#([\p{L}\p{N}_]{2,30})/gu,(m,pre,tag)=>`${pre}<button type="button" class="community-hashtag" data-community-hashtag="${tag}">#${tag}</button>`);}

  async function ensureProfile(){
    if(!authReady())throw new Error(authHint());
    const {data,error}=await client.from('community_profiles').select('*').eq('user_id',user.id).maybeSingle();
    if(error)throw error;
    if(data){fillProfile(data);return data;}
    // Nunca se usa el correo para el nombre visible ni el usuario (la búsqueda lo expondría).
    const display=String(user.user_metadata?.full_name||user.user_metadata?.name||'Atleta FittForma').slice(0,60);
    const username=(String(user.user_metadata?.preferred_username||'atleta').toLowerCase().replace(/[^a-z0-9_.-]/g,'').slice(0,15)+'_'+user.id.replace(/-/g,'').slice(0,8)).slice(0,24);
    const payload={user_id:user.id,display_name:display,username, bio:'',visibility:'private'};
    const result=await client.from('community_profiles').upsert(payload,{onConflict:'user_id'}).select('*').single();
    if(result.error)throw result.error;fillProfile(result.data);return result.data;
  }
  function fillProfile(p){
    if(!$('communityDisplayName'))return;
    ownProfile=p;
    if(schemaV49===null)schemaV49=Object.prototype.hasOwnProperty.call(p,'featured_badges');
    ownVisibility=p.visibility==='public'?'public':'private';
    $('communityDisplayName').value=p.display_name||'';$('communityUsername').value=p.username||'';$('communityBio').value=p.bio||'';$('communityVisibility').value=p.visibility||'private';
    $('communityOwnName').textContent=p.display_name||p.username||'Tu perfil';
    if($('communityOwnHandle'))$('communityOwnHandle').textContent=p.username?`@${p.username}`:'';
    if($('communityOwnBio'))$('communityOwnBio').textContent=p.bio||'';
    renderOwnHeader();
    if(client&&user?.id===p.user_id){refreshOwnCounts();syncFeaturedBadges();}
  }
  async function renderOwnHeader(){
    const p=ownProfile;const avatar=$('communityOwnAvatar');if(!avatar)return;
    const urlOf=p?.avatar_path?await signedMany([p.avatar_path]):null;
    avatar.outerHTML=avatarHtml(p||{display_name:'FF'},urlOf,'lg').replace('<span class="community-avatar','<span id="communityOwnAvatar" class="community-avatar');
    const tab=$('communityTabAvatar');const url=p?.avatar_path&&urlOf?urlOf(p.avatar_path):'';
    if(tab){tab.classList.toggle('has-photo',Boolean(url));if(url)tab.innerHTML=`<img src="${esc(url)}" alt="">`;}
    const featured=$('communityOwnFeatured');if(featured)featured.innerHTML=featuredHtml(p?.featured_badges?.length?p.featured_badges:(window.FittFormaFeaturedBadgesPayload?.()||[]),26);
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
  async function loadFollowRequests(){const root=$('communityFollowRequests');if(!root)return;if(!authReady()){root.textContent='Iniciá sesión para administrar solicitudes.';return;}const {data,error}=await client.from('community_follows').select('follower_id,created_at,community_profiles!community_follows_follower_id_fkey(user_id,display_name,username,bio)').eq('following_id',user.id).eq('status','pending').order('created_at',{ascending:false}).limit(30);if(error){root.textContent='No se pudieron cargar las solicitudes: '+error.message;return;}if(!data?.length){root.textContent='No hay solicitudes pendientes.';return;}root.innerHTML=data.map(row=>{const profile=Array.isArray(row.community_profiles)?row.community_profiles[0]:row.community_profiles;return `<div class="community-comment"><strong>${esc(profile?.display_name||'Usuario')}</strong> <span class="muted">@${esc(profile?.username||row.follower_id.slice(0,8))}</span><div class="btn-row" style="margin-top:7px"><button class="btn secondary" type="button" data-community-accept="${esc(row.follower_id)}">Aceptar</button><button class="btn ghost" type="button" data-community-reject="${esc(row.follower_id)}">Rechazar</button></div></div>`;}).join('');root.querySelectorAll('[data-community-accept]').forEach(b=>b.addEventListener('click',()=>resolveFollow(b.dataset.communityAccept,true)));root.querySelectorAll('[data-community-reject]').forEach(b=>b.addEventListener('click',()=>resolveFollow(b.dataset.communityReject,false)));}
  async function resolveFollow(followerId,accept){const result=accept?await client.from('community_follows').update({status:'accepted'}).eq('follower_id',followerId).eq('following_id',user.id).eq('status','pending'):await client.from('community_follows').delete().eq('follower_id',followerId).eq('following_id',user.id).eq('status','pending');if(result.error){status('No se pudo actualizar la solicitud: '+result.error.message);return;}await loadFollowRequests();await loadFeed();refreshOwnCounts();}

  // ---------- Publicaciones ----------
  function postSelect(){const extra=schemaV41===false?'':V41_COLS;return 'id,user_id,description,exercises_text,nutrition_text,running_text,start_date,end_date,before_path,after_path,visibility,created_at'+extra+(schemaV49===false?'':',linked_session');}
  function profileCols(){return 'user_id,display_name,username,bio,visibility,avatar_path'+(schemaV49===false?'':',featured_badges');}
  async function myFollowing(){if(!authReady())return new Map();const {data,error}=await client.from('community_follows').select('following_id,status').eq('follower_id',user.id);return new Map((error?[]:data||[]).map(x=>[x.following_id,x.status]));}
  // Me gusta, comentarios, seguimiento, guardadas e imágenes de un conjunto de publicaciones (todo bajo RLS).
  async function bundle(posts){
    const ids=posts.map(p=>p.id);let likes=[],comments=[],followStatus=new Map(),saved=new Set();
    if(ids.length){
      const requests=[client.from('community_likes').select('post_id,user_id').in('post_id',ids),client.from('community_comments').select('id,post_id,user_id,body,created_at,community_profiles!community_comments_user_id_fkey(display_name,username)').in('post_id',ids).order('created_at',{ascending:true})];
      const results=await Promise.all(requests);
      if(!results[0].error)likes=results[0].data||[];
      if(!results[1].error)comments=results[1].data||[];
      else if(results[1].error.code==='PGRST201'||results[1].error.code==='PGRST200'){
        // Recuperación para comentarios si la FK también es ambigua en un esquema antiguo.
        const plainComments=await client.from('community_comments').select('id,post_id,user_id,body,created_at').in('post_id',ids).order('created_at',{ascending:true});
        if(!plainComments.error){
          const commentAuthors=[...new Set((plainComments.data||[]).map(comment=>comment.user_id))];
          let commentProfiles=[];
          if(commentAuthors.length){const profileResult=await client.from('community_profiles').select('user_id,display_name,username').in('user_id',commentAuthors);if(!profileResult.error)commentProfiles=profileResult.data||[];}
          const profilesByUser=new Map(commentProfiles.map(profile=>[profile.user_id,profile]));
          comments=(plainComments.data||[]).map(comment=>({...comment,community_profiles:profilesByUser.get(comment.user_id)||null}));
        }else console.warn('No se pudieron cargar comentarios de Comunidad:',plainComments.error.message);
      }else console.warn('No se pudieron cargar comentarios de Comunidad:',results[1].error.message);
      if(user){followStatus=await myFollowing();
        if(savedEnabled&&schemaV49!==false){const s=await client.from('community_saved_posts').select('post_id').eq('user_id',user.id).in('post_id',ids);if(s.error){savedEnabled=false;}else saved=new Set((s.data||[]).map(x=>x.post_id));}}
    }
    const paths=[];for(const p of posts){const kind=p.post_kind||'transformation';if(kind==='transformation')paths.push(p.before_path,p.after_path);if(p.image_path)paths.push(p.image_path);const prof=Array.isArray(p.community_profiles)?p.community_profiles[0]:p.community_profiles;if(prof?.avatar_path)paths.push(prof.avatar_path);}
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
    const commentHtml=postComments.map((c,i)=>{const cp=Array.isArray(c.community_profiles)?c.community_profiles[0]:c.community_profiles;return `<div class="community-comment"${i<postComments.length-2?' data-older-comment hidden':''}><strong>${esc(cp?.display_name||cp?.username||'Usuario')}</strong> ${esc(c.body)}${user?.id===c.user_id?` <button class="btn ghost btn-sm" type="button" data-community-delete-comment="${esc(c.id)}">Borrar</button>`:''}</div>`;}).join('');
    const rank=rankByPost[p.id]||{isPro:false,followerCount:0,activityScore:0};
    const liked=ctx.likedSet.has(p.id),saved=ctx.saved.has(p.id),likes=ctx.countBy[p.id]||0;
    const menu=`<details class="community-post-menu"><summary aria-label="Más opciones de la publicación">${ICON.more}</summary><div class="community-menu" role="menu">${owner?'':`<button class="btn ghost" type="button" data-community-report="${esc(p.id)}">Denunciar</button>${user?`<button class="btn ghost" type="button" data-community-block="${esc(p.user_id)}">Bloquear</button>`:''}`}${owner&&schemaV41?`<button class="btn ghost" type="button" data-community-edit-post="${esc(p.id)}" data-kind="${esc(kind)}">Editar texto</button>`:''}${owner?`<button class="btn ghost" type="button" data-community-delete-post="${esc(p.id)}">Eliminar</button>`:''}</div></details>`;
    const actions=`<div class="community-actions" role="group" aria-label="Acciones"><button class="community-action${liked?' is-on':''}" type="button" data-community-like="${esc(p.id)}" aria-pressed="${liked}" aria-label="${liked?'Quitar me gusta':'Me gusta'}">${ICON.heart}<span data-like-count>${likes}</span></button><button class="community-action" type="button" data-community-focus-comment="${esc(p.id)}" aria-label="Comentar">${ICON.comment}<span>${postComments.length}</span></button><button class="community-action" type="button" data-community-share="${esc(p.id)}" aria-label="Compartir">${ICON.share}</button>${user&&savedEnabled&&schemaV49!==false?`<button class="community-action community-save${saved?' is-on':''}" type="button" data-community-save="${esc(p.id)}" aria-pressed="${saved}" aria-label="${saved?'Quitar de guardadas':'Guardar'}">${ICON.save}</button>`:''}</div>`;
    const bodyHtml=`<div class="community-post-body">${kindLabel?`<span class="community-kind">${kindLabel}</span>`:''}${achievementHtml}${p.description?`<p data-community-post-text>${richText(p.description)}</p>`:''}${linkedSessionHtml(p.linked_session)}${tags.length?`<div class="community-tags">${tags.map(t=>`<span>${esc(t)}</span>`).join('')}</div>`:''}<p class="muted small community-disclaimer">Información compartida por el usuario; no está verificada automáticamente por FittForma.</p></div>`;
    // Con foto: foto, acciones y texto. Sin foto: el texto va primero y las acciones debajo.
    const content=media?`${media}${actions}${bodyHtml}`:`${bodyHtml}${actions}`;
    return `<article class="card community-post" data-community-post="${esc(p.id)}"><div class="community-post-head"><button type="button" class="community-author-btn" data-community-open-user="${esc(p.user_id)}" aria-label="Ver el perfil de ${esc(profileName)}">${avatarHtml(profile,urlOf)}</button><div class="community-author"><strong><button type="button" class="community-author-name" data-community-open-user="${esc(p.user_id)}">${esc(profileName)}</button>${featuredHtml(profile?.featured_badges,18)}${rank.isPro?'<span class="community-pro-badge">PRO</span>':''}</strong><small>@${esc(profile?.username||'usuario')} · ${esc(when)}${p.visibility==='followers'?' · Seguidores':''}</small></div>${owner||!user||isFollowing?'':`<button class="btn ghost btn-sm community-follow-btn" type="button" data-community-follow="${esc(p.user_id)}" data-following="${isPending?'pending':'no'}">${isPending?'Solicitud enviada':'Seguir'}</button>`}${menu}</div>${content}<div class="community-comments">${postComments.length>2?`<button class="community-more-comments" type="button" data-community-show-comments>Ver los ${postComments.length} comentarios</button>`:''}${commentHtml}${user?`<form class="community-comment-form" data-community-comment-form="${esc(p.id)}"><input name="body" maxlength="500" required placeholder="Agregá un comentario…" aria-label="Escribí un comentario"><button class="btn secondary btn-sm" type="submit">Enviar</button></form>`:`<p class="muted small">Iniciá sesión para comentar.</p>`}</div></article>`;
  }
  async function loadFeed(){
    if(loading)return;loading=true;
    try{
      if(!client){status('');return;}
      status('Cargando publicaciones…');
      const selectPosts=postSelect()+`,community_profiles!community_posts_user_id_fkey!inner(${profileCols()})`;
      let rankByPost={},rankedIds=[];
      try{const ranked=await client.rpc('community_ranked_post_ids');if(!ranked.error&&ranked.data){ranked.data.forEach((r,index)=>{rankByPost[r.post_id]={index,isPro:!!r.is_pro,followerCount:Number(r.follower_count)||0,activityScore:Number(r.activity_score)||0};});rankedIds=ranked.data.map(r=>r.post_id);}}catch{}
      const following=feedSort==='following'&&!searchTerm&&user?[...(await myFollowing()).entries()].filter(([,s])=>s==='accepted').map(([id])=>id):null;
      const hashtag=searchTerm.startsWith('#')?searchTerm.slice(1).replace(/[^\p{L}\p{N}_]/gu,''):'';
      let query=client.from('community_posts').select(selectPosts);
      if(searchTerm&&hashtag)query=query.ilike('description',`%#${hashtag}%`).order('created_at',{ascending:false}).limit(30);
      else if(searchTerm){const term=searchTerm.replace(/^@/,'').replace(/[,%()]/g,'');query=query.ilike('community_profiles.username',`%${term}%`).order('created_at',{ascending:false}).limit(20);}
      else if(following)query=query.in('user_id',[...following,user.id]).order('created_at',{ascending:false}).limit(feedLimit);
      else if(feedSort==='recent')query=query.order('created_at',{ascending:false}).limit(feedLimit);
      else if(rankedIds.length)query=query.in('id',rankedIds.slice(0,feedLimit));
      else query=query.order('created_at',{ascending:false}).limit(feedLimit);
      let {data,error}=await query;
      // En proyectos donde el esquema haya quedado con una FK adicional o un nombre distinto,
      // evitamos depender del embed ambiguo: consultamos posts y perfiles por separado, bajo RLS.
      if(error&&(error.code==='PGRST201'||error.code==='PGRST200')){
        let fallbackQuery=client.from('community_posts').select(postSelect());
        if(searchTerm&&!hashtag){
          const term=searchTerm.replace(/^@/,'').replace(/[,%()]/g,'');
          const profileResult=await client.from('community_profiles').select('user_id').ilike('username',`%${term}%`).limit(30);
          if(profileResult.error)throw profileResult.error;
          const matchingUsers=(profileResult.data||[]).map(row=>row.user_id);
          if(!matchingUsers.length){data=[];error=null;}
          else fallbackQuery=fallbackQuery.in('user_id',matchingUsers).order('created_at',{ascending:false}).limit(20);
        }else if(hashtag)fallbackQuery=fallbackQuery.ilike('description',`%#${hashtag}%`).order('created_at',{ascending:false}).limit(30);
        else if(rankedIds.length)fallbackQuery=fallbackQuery.in('id',rankedIds.slice(0,feedLimit));
        else fallbackQuery=fallbackQuery.order('created_at',{ascending:false}).limit(feedLimit);
        if(error){const fallback=await fallbackQuery;if(fallback.error)throw fallback.error;data=fallback.data||[];const authorIds=[...new Set(data.map(row=>row.user_id))];if(authorIds.length){const profileResult=await client.from('community_profiles').select(profileCols()).in('user_id',authorIds);if(profileResult.error)throw profileResult.error;const byUser=new Map((profileResult.data||[]).map(profile=>[profile.user_id,profile]));data=data.filter(post=>byUser.has(post.user_id)).map(post=>({...post,community_profiles:byUser.get(post.user_id)}));}else data=[];error=null;}
      }
      if(error&&isMissingColumn(error)){
        if(schemaV49!==false&&/linked_session|featured_badges/.test(String(error.message))){schemaV49=false;loading=false;return loadFeed();}
        if(schemaV41!==false){markLegacySchema();loading=false;updateKindAvailability();return loadFeed();}
      }
      if(error)throw error;
      if(schemaV41===null){schemaV41=true;updateKindAvailability();}
      let posts=data||[];
      if(feedSort==='recent'||following||searchTerm)posts.sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')));
      else posts.sort((a,b)=>(rankByPost[a.id]?.index??9999)-(rankByPost[b.id]?.index??9999));
      const ctx=await bundle(posts);
      const outputRoot=searchTerm&&$('communitySearchPosts')?$('communitySearchPosts'):$('communityFeed');
      if(outputRoot)outputRoot.innerHTML=posts.map(p=>renderPostCard(p,ctx,rankByPost)).join('')||(searchTerm?'<div class="empty"><strong>No hay publicaciones que coincidan</strong><p>Probá otra búsqueda o seguí explorando perfiles.</p></div>':following?'<div class="empty"><strong>Todavía no hay publicaciones de personas que seguís</strong><p>Buscá perfiles en Explorar y seguí a quienes te inspiren.</p><button class="btn" type="button" data-community-go="explore">Explorar</button></div>':'<div class="empty"><strong>Tu feed está vacío por ahora</strong><p>Seguí perfiles desde Explorar o compartí tu primer logro.</p><button class="btn" type="button" data-community-go="publish">Crear una publicación</button></div>');
      if(!searchTerm){renderStories(posts,ctx);const more=$('communityLoadMore');if(more)more.hidden=posts.length<feedLimit;}
      status(`${posts.length} publicación(es) cargadas.`);window.dispatchEvent(new CustomEvent('fittforma:feedrendered'));connectionStatus('Supabase responde correctamente: el feed de Comunidad se pudo consultar.');bindFeedActions(outputRoot||$('communityFeed'));
    }catch(error){const message=friendlySupabaseError(error,'cargar el feed de la comunidad');status(message);connectionStatus(message);}
    finally{loading=false;}
  }
  // Novedades: personas que seguís (aceptadas) que publicaron en las últimas 48 h. No son historias efímeras nuevas:
  // abren el perfil y sus publicaciones reales.
  function renderStories(posts,ctx){
    const root=$('communityStories');if(!root)return;
    const cutoff=Date.now()-48*3600*1000,seen=new Set(),items=[];
    for(const p of posts){if(p.user_id===user?.id||seen.has(p.user_id))continue;if(ctx.followStatus.get(p.user_id)!=='accepted')continue;if(Date.parse(p.created_at||'')<cutoff)continue;seen.add(p.user_id);items.push(Array.isArray(p.community_profiles)?p.community_profiles[0]:p.community_profiles);if(items.length>=12)break;}
    const own=user?`<button type="button" class="community-story is-own" data-community-go="publish"><span class="community-story-ring">${avatarHtml(ownProfile||{display_name:'Vos'},ctx.urlOf)}<b aria-hidden="true">+</b></span><small>Publicar</small></button>`:'';
    root.innerHTML=own+items.map(pr=>`<button type="button" class="community-story" data-community-open-user="${esc(pr?.user_id)}"><span class="community-story-ring is-new">${avatarHtml(pr,ctx.urlOf)}</span><small>${esc(pr?.username||'usuario')}</small></button>`).join('');
    root.hidden=!own&&!items.length;
    root.querySelectorAll('[data-community-open-user]').forEach(b=>b.addEventListener('click',()=>openUser(b.dataset.communityOpenUser)));
    root.querySelectorAll('[data-community-go]').forEach(b=>b.addEventListener('click',()=>showCommunitySubView(b.dataset.communityGo)));
  }
  async function saveProfile(e){e.preventDefault();if(!authReady()){setStatus('communityProfileStatus',authHint());return;}
    const display=$('communityDisplayName').value.trim(),username=$('communityUsername').value.trim().toLowerCase(),bio=$('communityBio').value.trim(),visibility=$('communityVisibility').value;
    if(display.length<1||!/^[a-z0-9_.-]{3,24}$/.test(username)){setStatus('communityProfileStatus','Revisá el nombre y el usuario (3–24 caracteres permitidos).');return;}
    setStatus('communityProfileStatus','Guardando perfil…');
    const {data,error}=await client.from('community_profiles').upsert({user_id:user.id,display_name:display,username,bio,visibility,updated_at:new Date().toISOString()},{onConflict:'user_id'}).select('*').single();
    if(error){setStatus('communityProfileStatus',error.message.includes('unique')?'Ese usuario ya está ocupado. Elegí otro.':`No se pudo guardar: ${error.message}`);return;}fillProfile(data);setStatus('communityProfileStatus','Perfil guardado. Privacidad: '+(visibility==='public'?'público':'privado')+'.');await loadFeed();
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
  // v49: foto de perfil propia (cuadrada, 512 px, sin metadatos), en la carpeta de la cuenta.
  async function changeAvatar(file){
    if(!authReady()||!file)return;if(schemaV49===false){setStatus('communityProfileStatus','Para usar foto de perfil, aplicá la migración v49 de Comunidad en Supabase.');return;}
    setStatus('communityProfileStatus','Subiendo foto de perfil…');
    const path=`${user.id}/avatar/${Date.now().toString(36)}.jpg`,previous=ownProfile?.avatar_path||'';
    try{
      await uploadImage(file,path,{max:512,square:true});
      const {data,error}=await client.from('community_profiles').update({avatar_path:path,updated_at:new Date().toISOString()}).eq('user_id',user.id).select('*').single();
      if(error)throw error;
      if(previous&&previous!==path)await client.storage.from(bucket).remove([previous]).catch(()=>{});
      fillProfile(data);setStatus('communityProfileStatus','Foto de perfil actualizada.');toast('Foto de perfil actualizada.');
    }catch(error){await client.storage.from(bucket).remove([path]).catch(()=>{});setStatus('communityProfileStatus',error?.code?friendlySupabaseError(error,'guardar la foto de perfil'):`No se pudo guardar la foto: ${error.message}`);}
    finally{if($('communityAvatarInput'))$('communityAvatarInput').value='';}
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
      if(error)throw error;if(photoUnlocked){photoUnlocked=false;window.FittFormaAds?.refresh?.(true);fetch('/api/metrics',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'photo_after_reward'})}).catch(()=>{});}$('communityPostForm').reset();setStatus('communityPostStatus','¡Transformación publicada!');showCommunitySubView('feed');await loadFeed();
    }catch(error){if(beforePath||afterPath){try{await client.storage.from(bucket).remove([beforePath,afterPath].filter(Boolean));}catch{}}if(photoLimitError(error)){setStatus('communityPostStatus','Ya publicaste las fotos de hoy. Tu publicación sigue en el formulario.');photoGate('communityPostStatus');return;}setStatus('communityPostStatus',`No se pudo publicar: ${error.message||'revisá las políticas de Supabase.'}`);}
    finally{btn.disabled=false;}
  }
  // Me gusta y guardar: se actualiza solo el botón (sin volver a dibujar el feed) y solo después de que la base confirma.
  async function toggleLike(postId,button){if(!authReady())return alert(authHint());const {data,error}=await client.from('community_likes').select('post_id').eq('post_id',postId).eq('user_id',user.id).maybeSingle();if(error){status(error.message);return;}const result=data?await client.from('community_likes').delete().eq('post_id',postId).eq('user_id',user.id):await client.from('community_likes').insert({post_id:postId,user_id:user.id});if(result.error){status(`No se pudo actualizar el me gusta: ${result.error.message}`);return;}
    const on=!data;document.querySelectorAll(`[data-community-like="${CSS.escape(postId)}"]`).forEach(b=>{b.classList.toggle('is-on',on);b.setAttribute('aria-pressed',String(on));b.setAttribute('aria-label',on?'Quitar me gusta':'Me gusta');const c=b.querySelector('[data-like-count]');if(c)c.textContent=String(Math.max(0,(Number(c.textContent)||0)+(on?1:-1)));});if(!button)await loadFeed();}
  async function toggleSave(postId){if(!authReady())return alert(authHint());const on=!document.querySelector(`[data-community-save="${CSS.escape(postId)}"]`)?.classList.contains('is-on');const result=on?await client.from('community_saved_posts').insert({user_id:user.id,post_id:postId}):await client.from('community_saved_posts').delete().eq('user_id',user.id).eq('post_id',postId);if(result.error){status(friendlySupabaseError(result.error,'guardar la publicación'));return;}document.querySelectorAll(`[data-community-save="${CSS.escape(postId)}"]`).forEach(b=>{b.classList.toggle('is-on',on);b.setAttribute('aria-pressed',String(on));b.setAttribute('aria-label',on?'Quitar de guardadas':'Guardar');});toast(on?'Publicación guardada.':'Publicación quitada de guardadas.');if(currentSubView==='profile'&&ownTab==='saved')renderOwnGrid();}
  async function sharePost(postId){const article=document.querySelector(`[data-community-post="${CSS.escape(postId)}"]`),author=article?.querySelector('.community-author small')?.textContent?.split('·')[0]?.trim()||'',text=(article?.querySelector('[data-community-post-text]')?.textContent||'').slice(0,140);const url=location.origin+location.pathname;const data={title:'FittForma AI · Comunidad',text:`${author?`${author} en FittForma AI`:'Una publicación en FittForma AI'}${text?`: «${text}»`:''}`,url};try{if(navigator.share){await navigator.share(data);return;}await navigator.clipboard.writeText(`${data.text} ${url}`);toast('Texto y enlace copiados para compartir.');}catch(error){if(error?.name!=='AbortError')toast('No se pudo compartir desde este navegador.');}}
  async function addComment(postId,body){if(!authReady())return alert(authHint());const text=String(body||'').trim();if(!text||text.length>500)return;const {error}=await client.from('community_comments').insert({post_id:postId,user_id:user.id,body:text});if(error)status(`No se pudo comentar: ${error.message}`);else{await loadFeed();if($('communityPostDialog')?.open)openPostDialog(postId);}}
  async function toggleFollow(target,button){if(!authReady())return alert(authHint());if(target===user.id)return;const {data,error}=await client.from('community_follows').select('follower_id,following_id,status').eq('follower_id',user.id).eq('following_id',target).maybeSingle();if(error){status(error.message);return;}let result;if(data)result=await client.from('community_follows').delete().eq('follower_id',user.id).eq('following_id',target);else{
      // La base de datos decide si el seguimiento queda aceptado o pendiente según la privacidad.
      result=await client.from('community_follows').insert({follower_id:user.id,following_id:target,status:'pending'}).select('status').single();
    }if(result.error)status(`No se pudo actualizar el seguimiento: ${result.error.message}`);else{if(!data&&button)button.textContent=result.data?.status==='accepted'?'Siguiendo':'Solicitud enviada';refreshOwnCounts();if(currentSubView==='user')await openUser(target);else if(currentSubView==='explore')loadSuggested();else await loadFeed();}}
  async function blockUser(target){
    if(!authReady())return alert(authHint());if(!target||target===user.id)return;
    if(!confirm('¿Bloquear a esta persona? Dejarán de verse entre ustedes en la comunidad, se eliminará el seguimiento mutuo y no podrán enviarse mensajes. Podés desbloquearla desde tu perfil.'))return;
    const {error}=await client.from('community_blocks').insert({blocker_id:user.id,blocked_id:target});
    if(error){status(error.message.includes('duplicate')?'Esta persona ya está bloqueada.':`No se pudo bloquear: ${error.message}`);return;}
    status('Usuario bloqueado. El seguimiento entre ambas cuentas fue eliminado.');
    if(currentSubView==='user')showCommunitySubView('feed');
    await Promise.all([loadBlockedUsers(),loadFeed(),loadChatContacts()]);
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
    if(!confirm('¿Desbloquear a este usuario? No se restaurará el seguimiento anterior automáticamente.'))return;
    const {error}=await client.from('community_blocks').delete().eq('blocker_id',user.id).eq('blocked_id',target);
    if(error){setStatus('communityProfileStatus',`No se pudo desbloquear: ${error.message}`);return;}
    setStatus('communityProfileStatus','Usuario desbloqueado. El seguimiento no se restaura automáticamente.');
    await Promise.all([loadBlockedUsers(),loadFeed(),loadChatContacts()]);
  }
  async function deleteConversation(){
    if(!authReady())return;const target=$('communityChatContact')?.value;if(!target)return setStatus('communityChatStatus','Elegí una conversación primero.');
    if(!confirm('¿Eliminar todos los mensajes de esta conversación para ambas personas? Esta acción no se puede deshacer.'))return;
    const {error}=await client.from('community_messages').delete().or(`and(sender_id.eq.${user.id},recipient_id.eq.${target}),and(sender_id.eq.${target},recipient_id.eq.${user.id})`);
    if(error){setStatus('communityChatStatus',`No se pudo borrar la conversación: ${error.message}`);return;}
    setStatus('communityChatStatus','Conversación eliminada para ambas personas.');await loadMessages();
  }
  async function deletePost(id){if(!confirm('¿Eliminar esta publicación? También se borran sus fotos, me gusta y comentarios.'))return;const {data,error}=await client.from('community_posts').select('before_path,after_path'+(schemaV41?',image_path':'')).eq('id',id).eq('user_id',user.id).maybeSingle();if(error||!data){status(error?.message||'No se encontró la publicación.');return;}const {error:delError}=await client.from('community_posts').delete().eq('id',id).eq('user_id',user.id);if(delError){status(delError.message);return;}const paths=[data.before_path,data.after_path,data.image_path].filter(Boolean);if(paths.length)await client.storage.from(bucket).remove(paths);$('communityPostDialog')?.close?.();await loadFeed();refreshOwnCounts();}
  async function reportPost(id){if(!authReady())return alert(authHint());const reason=String(prompt('Motivo de la denuncia (spam, acoso, contenido inapropiado, otro):')??'').trim();if(!reason)return;const {error}=await client.from('community_reports').insert({reporter_id:user.id,post_id:id,reason:reason.trim().slice(0,300)});if(error)status(error.code==='23505'?'Ya enviaste una denuncia por esta publicación.':`No se pudo enviar la denuncia: ${error.message}`);else status('Denuncia enviada. Gracias por ayudar a cuidar la comunidad.');}
  async function deleteComment(id){if(!confirm('¿Borrar tu comentario?'))return;const {error}=await client.from('community_comments').delete().eq('id',id).eq('user_id',user.id);if(error)status(error.message);else await loadFeed();}
  function achievementCard(a){
    const E=window.FittFormaBadgeEngine,level=Math.min(12,Math.max(1,Number(a?.level)||1));
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
      status('Publicación actualizada.');await loadFeed();
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
      setStatus('communityComposeStatus','Publicado.');toast('Publicación guardada.');renderPostPreview();showCommunitySubView('feed');await loadFeed();refreshOwnCounts();
    }catch(error){
      if(imagePath){try{await client.storage.from(bucket).remove([imagePath]);}catch(cleanupError){console.warn('No se pudo limpiar la foto subida:',cleanupError);}}
      if(photoLimitError(error)){setStatus('communityComposeStatus','Ya publicaste las fotos de hoy. Tu publicación sigue en el formulario.');photoGate('communityComposeStatus');return;}
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
    if(badge){badge.hidden=!total;badge.textContent=total>99?'99+':String(total);badge.setAttribute('aria-label',`${total} mensaje(s) sin leer`);}
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
      if(!confirm('¿Eliminar esta publicación para todos? También se borran sus fotos, comentarios y me gusta.'))return;b.disabled=true;
      const id=b.dataset.reportRemove,{data}=await client.from('community_posts').select('before_path,after_path,image_path').eq('id',id).maybeSingle();
      // Primero queda registrado que se actuó (las denuncias se conservan sin la publicación; migración v44).
      const marked=await client.from('community_reports').update({status:'actioned'}).eq('post_id',id).eq('status','open').select('id');
      if(marked.error){setStatus('communityProfileStatus',friendlySupabaseError(marked.error,'registrar la resolución'));b.disabled=false;return;}
      const {data:removed,error}=await client.from('community_posts').delete().eq('id',id).select('id');
      if(error||!removed?.length){setStatus('communityProfileStatus',error?friendlySupabaseError(error,'eliminar la publicación'):'No se pudo eliminar la publicación (sin permiso o ya no existe).');b.disabled=false;return;}
      const paths=[data?.before_path,data?.after_path,data?.image_path].filter(Boolean);if(paths.length){const r=await client.storage.from(bucket).remove(paths);if(r.error)console.warn('No se pudieron borrar las fotos de la publicación eliminada:',r.error.message);}
      await loadModeration();await loadFeed();
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
    root.querySelectorAll('[data-community-hashtag]').forEach(b=>b.addEventListener('click',()=>searchHashtag(b.dataset.communityHashtag)));
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
    if(!target)return;const select=$('communityChatContact');if(select&&select.value!==target)select.value=target;
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
  function personCard(p,urlOf){return `<article class="community-person" data-community-open-user="${esc(p.user_id)}"><button type="button" class="community-person-open" data-community-open-user="${esc(p.user_id)}" aria-label="Ver el perfil de ${esc(p.display_name||p.username)}">${avatarHtml(p,urlOf,'lg')}</button><strong>${esc(p.display_name||p.username)}</strong><small class="muted">@${esc(p.username)}</small>${Number.isFinite(Number(p.followers))?`<small class="muted">${Number(p.posts)||0} publicaciones · ${Number(p.followers)||0} seguidores</small>`:''}${user&&user.id!==p.user_id?`<button class="btn btn-sm" type="button" data-community-search-follow="${esc(p.user_id)}">${p.visibility==='private'?'Solicitar seguir':'Seguir'}</button>`:''}</article>`;}
  function bindPeople(root){root.querySelectorAll('button[data-community-open-user]').forEach(b=>b.addEventListener('click',()=>openUser(b.dataset.communityOpenUser)));root.querySelectorAll('[data-community-search-follow]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();toggleFollow(b.dataset.communitySearchFollow,b);}));root.querySelectorAll('[data-community-search-block]').forEach(b=>b.addEventListener('click',()=>blockUser(b.dataset.communitySearchBlock)));}
  async function loadSuggested(){
    const root=$('communitySuggested'),wrap=root?.closest('.community-suggested-wrap');if(!root||!client)return;
    const r=await client.rpc('community_suggested_profiles');
    if(r.error){if(wrap)wrap.hidden=true;if(!isMissingFunction(r.error))console.warn('No se pudieron cargar sugerencias:',r.error.message);return;}
    const list=r.data||[];if(wrap)wrap.hidden=!list.length;
    const urlOf=await signedMany(list.map(x=>x.avatar_path));
    root.innerHTML=list.map(p=>personCard({...p,visibility:'public'},urlOf)).join('');bindPeople(root);
  }
  async function loadExploreGrid(){
    const root=$('communityExploreGrid');if(!root||!client)return;
    let q=client.from('community_posts').select(postSelect()+`,community_profiles!community_posts_user_id_fkey!inner(${profileCols()})`).order('created_at',{ascending:false}).limit(24);
    if(exploreFilter==='transformation')q=q.eq('post_kind','transformation');
    else if(exploreFilter==='achievement')q=q.eq('post_kind','achievement');
    else if(exploreFilter==='photos')q=q.not('image_path','is',null);
    else if(exploreFilter==='workout'&&schemaV49!==false)q=q.not('linked_session','is',null);
    const {data,error}=await q;
    if(error){root.innerHTML='';status(friendlySupabaseError(error,'cargar publicaciones para explorar'));return;}
    const posts=(data||[]).filter(p=>exploreFilter!=='transformation'||true);
    const urlOf=await signedMany(posts.flatMap(p=>[p.image_path,(p.post_kind||'transformation')==='transformation'?p.after_path:null]));
    root.innerHTML=posts.length?posts.map(p=>gridTile(p,urlOf)).join(''):'<div class="empty"><p>No hay publicaciones para este filtro todavía.</p></div>';
    bindGrid(root);
  }
  function gridTile(p,urlOf){const kind=p.post_kind||'transformation',img=urlOf(p.image_path)||(kind==='transformation'?urlOf(p.after_path):'');const E=window.FittFormaBadgeEngine;let inner='';
    if(img)inner=`<img src="${esc(img)}" alt="" loading="lazy" onerror="this.remove()">`;
    else if(kind==='achievement'&&E&&p.achievement){const level=Math.min(12,Math.max(1,Number(p.achievement.level)||1)),rank=E.rankForLevel(level-1);inner=`<span class="community-tile-badge">${E.medalSvg({rankKey:rank.key,numeral:rank.numeral,glyph:E.glyphFor({id:p.achievement.exerciseId,name:p.achievement.exerciseName,category:p.achievement.category,measure:p.achievement.measure}),category:p.achievement.category,size:52})}<small>${esc(p.achievement.exerciseName)}</small></span>`;}
    else inner=`<span class="community-tile-text">${esc(String(p.description||'').slice(0,90))}</span>`;
    const label=kind==='transformation'?'Transformación':kind==='achievement'?'Logro':'Publicación';
    return `<button type="button" class="community-tile${img?'':' is-text'}" data-community-open-post="${esc(p.id)}" aria-label="Abrir ${label.toLowerCase()} de ${esc((Array.isArray(p.community_profiles)?p.community_profiles[0]:p.community_profiles)?.username||'usuario')}">${inner}${kind==='transformation'?'<span class="community-tile-kind">Antes/Después</span>':''}</button>`;}
  function bindGrid(root){root.querySelectorAll('[data-community-open-post]').forEach(b=>b.addEventListener('click',()=>openPostDialog(b.dataset.communityOpenPost)));}
  async function loadExplore(){if(!client){status(authHint());return;}exploreLoaded=true;await Promise.all([loadSuggested(),searchTerm?Promise.resolve():loadExploreGrid()]);}
  function searchHashtag(tag){showCommunitySubView('explore');$('communitySearch').value='#'+tag;$('communitySearchForm').requestSubmit();}
  async function searchUsers(e){e.preventDefault();searchTerm=$('communitySearch').value.trim();if(!client){status(authHint());return;}const root=$('communitySearchResults'),postRoot=$('communitySearchPosts');root.innerHTML='';if(postRoot)postRoot.innerHTML='';if(!searchTerm){status('Buscá personas por nombre o @usuario, o publicaciones por #hashtag.');$('communityExploreGrid').hidden=false;return loadExploreGrid();}$('communityExploreGrid').hidden=true;
    if(searchTerm.startsWith('#')){status(`Publicaciones con ${searchTerm}.`);await loadFeed();return;}
    const term=searchTerm.replace(/^@/,'').replace(/[,%()]/g,'');const {data,error}=await client.rpc('search_community_profiles',{search_term:term});if(error){status(friendlySupabaseError(error,'buscar perfiles'));return;}if(!data?.length){root.innerHTML='<div class="empty"><strong>No encontramos perfiles</strong><p>Probá con otro apodo o nombre de usuario.</p></div>';status('No se encontraron perfiles públicos coincidentes.');await loadFeed();return;}
    const urlOf=await signedMany(data.map(p=>p.avatar_path));
    root.innerHTML=`<div class="community-suggested community-search-people">${data.map(p=>personCard(p,urlOf)).join('')}</div>`;bindPeople(root);status(`Perfiles encontrados: ${data.length}. Los perfiles privados muestran solo datos básicos y requieren aprobación para ver su contenido.`);await loadFeed();}

  // ---------- Perfiles sociales ----------
  let viewedUser=null;
  async function openUser(uid){
    if(!client||!uid)return;if(user&&uid===user.id){showCommunitySubView('profile');return;}
    viewedUser=uid;showCommunitySubView('user');const root=$('communityUserProfile');root.innerHTML='<p class="muted small">Cargando perfil…</p>';
    const {data:p,error}=await client.from('community_profiles').select(profileCols()).eq('user_id',uid).maybeSingle();
    if(error||!p){root.innerHTML='<div class="empty"><strong>Perfil no disponible</strong><p>Puede ser privado, haber sido eliminado o haber un bloqueo entre las cuentas.</p></div>';return;}
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
      if(ids.length){const r=await client.from('community_posts').select(postSelect()+`,community_profiles!community_posts_user_id_fkey!inner(${profileCols()})`).in('id',ids);const byId=new Map((r.data||[]).map(x=>[x.id,x]));posts=ids.map(id=>byId.get(id)).filter(Boolean);}
    }else{const r=await client.from('community_posts').select(postSelect()).eq('user_id',user.id).order('created_at',{ascending:false}).limit(60);posts=(r.data||[]).map(x=>({...x,community_profiles:ownProfile}));}
    const urlOf=await signedMany(posts.flatMap(x=>[x.image_path,(x.post_kind||'transformation')==='transformation'?x.after_path:null]));
    grid.innerHTML=posts.length?posts.map(x=>gridTile(x,urlOf)).join(''):`<div class="empty"><p>${ownTab==='saved'?'Todavía no guardaste publicaciones. Tocá el ícono de guardar en el feed.':'Todavía no publicaste nada.'}</p>${ownTab==='saved'?'':'<button class="btn" type="button" data-community-go="publish">Crear una publicación</button>'}</div>`;
    bindGrid(grid);grid.querySelectorAll('[data-community-go]').forEach(b=>b.addEventListener('click',()=>showCommunitySubView(b.dataset.communityGo)));
  }
  // Una publicación abierta desde una grilla, con las mismas acciones que en el feed.
  async function openPostDialog(id){
    const dlg=$('communityPostDialog'),body=$('communityPostDialogBody');if(!dlg||!body||!client)return;
    const {data,error}=await client.from('community_posts').select(postSelect()+`,community_profiles!community_posts_user_id_fkey!inner(${profileCols()})`).eq('id',id).maybeSingle();
    if(error||!data){toast('La publicación ya no está disponible.');return;}
    const ctx=await bundle([data]);body.innerHTML=renderPostCard(data,ctx);bindFeedActions(body);
    if(typeof dlg.showModal==='function'&&!dlg.open)dlg.showModal();else dlg.setAttribute('open','');
  }

  async function emailLogin(e){e.preventDefault();if(!client)return setStatus('communityEmailStatus',authHint());const email=$('communityEmail').value.trim(),password=$('communityPassword').value;const {error}=await client.auth.signInWithPassword({email,password});if(error){setStatus('communityEmailStatus',`No se pudo iniciar sesión: ${error.message}`);return;}$('communityPassword').value='';setStatus('communityEmailStatus','Sesión iniciada.');}
  async function emailRegister(){if(!client)return setStatus('communityEmailStatus',authHint());const email=$('communityEmail').value.trim(),password=$('communityPassword').value;if(!email||password.length<8)return setStatus('communityEmailStatus','Ingresá un correo válido y una contraseña de al menos 8 caracteres.');const {data,error}=await client.auth.signUp({email,password});if(error){setStatus('communityEmailStatus',`No se pudo crear la cuenta: ${error.message}`);return;}if(data.session)setStatus('communityEmailStatus','Cuenta creada y sesión iniciada.');else setStatus('communityEmailStatus','Cuenta creada. Revisá tu correo para confirmar la dirección antes de iniciar sesión.');}
  async function googleLogin(){if(!client)return setStatus('communityProfileStatus',authHint());const {error}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:window.location.href.split('#')[0]}});if(error)setStatus('communityProfileStatus',`No se pudo iniciar con Google: ${error.message}`);}
  async function refresh(){if(!client){setControls();return;}if(user){try{await ensureProfile();await loadFollowRequests();}catch(e){setStatus('communityProfileStatus',`No se pudo preparar el perfil: ${e.message}`);}}setControls();await loadFeed();await loadChatContacts();await loadBlockedUsers();updateKindAvailability();renderPostPreview();await loadModeration();if(currentSubView==='profile')renderOwnGrid();}
  function init(supabase,userSession,diagnostic=''){client=supabase||null;user=userSession||null;connectionMessage=client?'':String(diagnostic||connectionMessage||'');if(client)connectionStatus('Cliente de Supabase inicializado. Comprobando tablas y permisos de Comunidad…');else configIssueStatus(diagnostic||'Supabase todavía no está conectado.');setControls();if(client)return refresh();return loadFeed();}
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
  function setSession(supabase,userSession){client=supabase||client;user=userSession||null;if(!user){ownProfile=null;stopChatPoll();['communityChatMessages','communityReportsList'].forEach(id=>{const el=$(id);if(el)el.innerHTML='';});if($('communityChatText'))$('communityChatText').value='';if($('communityModerationCard'))$('communityModerationCard').hidden=true;if($('communityDisplayName'))$('communityDisplayName').value='';if($('communityUsername'))$('communityUsername').value='';if($('communityBio'))$('communityBio').value='';if($('communityVisibility'))$('communityVisibility').value='private';if($('communityOwnName'))$('communityOwnName').textContent='Tu perfil';if($('communityOwnAvatar'))$('communityOwnAvatar').innerHTML='<span aria-hidden="true">FF</span>';if($('communityOwnHandle'))$('communityOwnHandle').textContent='';if($('communityOwnBio'))$('communityOwnBio').textContent='';if($('communityOwnFeatured'))$('communityOwnFeatured').innerHTML='';if($('communityOwnStats'))$('communityOwnStats').innerHTML=statsHtml(0,0,0);if($('communityConversations'))$('communityConversations').innerHTML='';if($('communityFollowRequests'))$('communityFollowRequests').textContent='Iniciá sesión para administrar solicitudes.';if($('communitySearchResults'))$('communitySearchResults').innerHTML='';if($('communityBlockedList'))$('communityBlockedList').textContent='Iniciá sesión para administrar los bloqueos.';}setControls();updateKindAvailability();if(client)Promise.resolve().then(()=>refresh());else loadFeed();}
  const communityViews=['feed','explore','publish','messages','profile','user'];
  function showCommunitySubView(name,focusTab=false){
    if(!communityViews.includes(name))name='feed';
    const previous=currentSubView;currentSubView=name;if(name!=='user')lastTab=name;
    if(name!=='messages')stopChatPoll();
    document.querySelectorAll('[data-community-tab]').forEach(button=>{
      const selected=button.dataset.communityTab===name;
      button.setAttribute('aria-selected',selected?'true':'false');button.tabIndex=selected||(name==='user'&&button.dataset.communityTab==='feed')?0:-1;
      button.classList.toggle('is-active',selected);if(selected&&focusTab)button.focus();
    });
    document.querySelectorAll('[data-community-panel]').forEach(panel=>{
      const active=panel.dataset.communityPanel===name;panel.hidden=!active;panel.classList.toggle('is-active',active);
    });
    if(name==='feed'&&previous!=='feed'){
      searchTerm='';if($('communitySearch'))$('communitySearch').value='';if($('communitySearchResults'))$('communitySearchResults').innerHTML='';if($('communitySearchPosts'))$('communitySearchPosts').innerHTML='';if($('communityExploreGrid'))$('communityExploreGrid').hidden=false;
      if(client)loadFeed();
    }else if(name==='messages'&&client){loadChatContacts();}
    else if(name==='explore'&&client){if(!exploreLoaded||!searchTerm)loadExplore();}
    else if(name==='profile'){renderOwnGrid();if(authReady()){loadFollowRequests();loadBlockedUsers();loadModeration();refreshOwnCounts();syncFeaturedBadges();}}
    else if(name==='publish'){fillAchievementOptions();fillSessionOptions();renderPostPreview();}
    if(name!==previous)document.getElementById('view-community')?.scrollIntoView?.({block:'start'});
  }
  function bindCommunitySubnavigation(){
    document.querySelectorAll('[data-community-tab]').forEach((button,index)=>{
      button.addEventListener('click',()=>showCommunitySubView(button.dataset.communityTab));
      button.addEventListener('keydown',event=>{
        if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();
        const tabs=[...document.querySelectorAll('[data-community-tab]')];let next=index;
        if(event.key==='ArrowLeft')next=(index-1+tabs.length)%tabs.length;else if(event.key==='ArrowRight')next=(index+1)%tabs.length;else if(event.key==='Home')next=0;else next=tabs.length-1;
        showCommunitySubView(tabs[next].dataset.communityTab,true);
      });
    });
    showCommunitySubView('feed');
  }
  function bind(){
    bindCommunitySubnavigation();
    $('communityRetryConnection')?.addEventListener('click',async()=>{const button=$('communityRetryConnection');if(button)button.disabled=true;connectionStatus('Revisando la configuración y la conexión…');try{if(typeof window.FittFormaRetrySupabase==='function'){const result=await window.FittFormaRetrySupabase();if(!result?.ok&&result?.message)configIssueStatus(result.message);else if(result?.ok){const check=await testConnection();connectionStatus(check.message);if(check.ok)await loadFeed();}}else connectionStatus('La función de comprobación no está disponible. Publicá la última versión y recargá la página.');}catch(error){connectionStatus(`Falló la comprobación: ${error.message||'error desconocido'}`);}finally{if(button)button.disabled=false;}});
    document.querySelectorAll('[data-feed-mode]').forEach(b=>b.addEventListener('click',()=>{feedSort=b.dataset.feedMode;feedLimit=30;document.querySelectorAll('[data-feed-mode]').forEach(x=>{const on=x===b;x.classList.toggle('is-active',on);x.setAttribute('aria-pressed',String(on));});loadFeed();}));
    $('communityLoadMore')?.addEventListener('click',()=>{feedLimit=Math.min(feedLimit+20,200);loadFeed();});
    document.querySelectorAll('[data-explore-filter]').forEach(b=>b.addEventListener('click',()=>{exploreFilter=b.dataset.exploreFilter;document.querySelectorAll('[data-explore-filter]').forEach(x=>{const on=x===b;x.classList.toggle('is-active',on);x.setAttribute('aria-pressed',String(on));});searchTerm='';if($('communitySearch'))$('communitySearch').value='';if($('communitySearchResults'))$('communitySearchResults').innerHTML='';if($('communitySearchPosts'))$('communitySearchPosts').innerHTML='';$('communityExploreGrid').hidden=false;loadExploreGrid();}));
    document.querySelectorAll('[data-own-tab]').forEach(b=>b.addEventListener('click',()=>{ownTab=b.dataset.ownTab;document.querySelectorAll('[data-own-tab]').forEach(x=>{const on=x===b;x.classList.toggle('is-active',on);x.setAttribute('aria-pressed',String(on));});renderOwnGrid();}));
    document.querySelector('[data-community-home]')?.addEventListener('click',()=>showCommunitySubView('feed'));
    $('communityUserBack')?.addEventListener('click',()=>showCommunitySubView(lastTab||'feed'));
    $('communityEditProfileToggle')?.addEventListener('click',e=>{const box=$('communityProfileEditor');const open=!box.classList.contains('is-open');box.classList.toggle('is-open',open);e.currentTarget.setAttribute('aria-expanded',String(open));if(open)box.scrollIntoView({behavior:'smooth',block:'start'});});
    $('communityAvatarInput')?.addEventListener('change',e=>changeAvatar(e.target.files?.[0]));
    $('communityChatBack')?.addEventListener('click',closeChat);
    $('communityPostDialog')?.addEventListener('click',e=>{if(e.target.closest('[data-close-post-dialog]')||e.target===e.currentTarget)$('communityPostDialog').close();});
    $('communityProfileForm')?.addEventListener('submit',saveProfile);$('communityPostForm')?.addEventListener('submit',createPost);$('communityRefresh')?.addEventListener('click',()=>loadFeed());$('communitySearchForm')?.addEventListener('submit',searchUsers);$('communityClearSearch')?.addEventListener('click',()=>{searchTerm='';$('communitySearch').value='';$('communitySearchResults').innerHTML='';if($('communitySearchPosts'))$('communitySearchPosts').innerHTML='';$('communityExploreGrid').hidden=false;loadExploreGrid();status('Buscá personas por nombre o @usuario, o publicaciones por #hashtag.');});$('communityGoogleLogin')?.addEventListener('click',googleLogin);$('communityEmailAuthForm')?.addEventListener('submit',emailLogin);$('communityEmailRegister')?.addEventListener('click',emailRegister);$('communityChatContact')?.addEventListener('change',e=>{if(e.target.value)openChat(e.target.value);});$('communityChatForm')?.addEventListener('submit',sendMessage);$('communityChatRefresh')?.addEventListener('click',loadChatContacts);$('communityChatDeleteConversation')?.addEventListener('click',deleteConversation);$('communityChatBlockContact')?.addEventListener('click',()=>blockUser($('communityChatContact')?.value));$('communitySignOut')?.addEventListener('click',async()=>{if(client){const {error}=await client.auth.signOut();if(error)setStatus('communityProfileStatus',error.message);}});
    document.querySelectorAll('[data-post-kind]').forEach((b,i,all)=>{b.addEventListener('click',()=>setPostKind(b.dataset.postKind));b.addEventListener('keydown',e=>{const d=e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0;if(!d)return;e.preventDefault();const next=all[(i+d+all.length)%all.length];setPostKind(next.dataset.postKind);next.focus();});});
    $('communityTextPostForm')?.addEventListener('submit',createKindPost);$('communityAchievementPostForm')?.addEventListener('submit',createKindPost);
    ['communityTextBody','communityTextImage','communityAchievementSelect','communityAchievementComment','communityLinkSession'].forEach(id=>{const el=$(id);if(el){el.addEventListener('input',renderPostPreview);el.addEventListener('change',renderPostPreview);}});
    window.addEventListener('fittforma:badgeschange',()=>{fillAchievementOptions();renderPostPreview();syncFeaturedBadges();if(currentSubView==='profile')renderOwnHeader();});
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&currentSubView==='messages'&&!$('communityChatView')?.hidden)loadMessages(true);});
    setPostKind('text');$('communityReportsList')?.addEventListener('click',moderationAction);
    const today=localDateKey();if($('communityEndDate'))$('communityEndDate').value=today;if($('communityStartDate'))$('communityStartDate').value=today;
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
  window.FittFormaCommunity={init,setSession,refresh,loadChatContacts,loadMessages,loadBlockedUsers,testConnection};
})();
