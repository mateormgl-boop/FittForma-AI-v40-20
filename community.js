/* FittForma AI v41.0 — comunidad online, privacidad, bloqueos y ranking orgánico. Requiere supabase/community.sql. */
(()=>{
  'use strict';
  const $=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let client=null,user=null,searchTerm='',loading=false,feedSort='activity',connectionMessage='',currentSubView='feed';
  // null = sin comprobar; false = el proyecto todavía no aplicó la migración v41 (solo transformaciones).
  const SCHEMA_KEY='fittforma-community-schema-v41';
  let schemaV41=(()=>{try{return sessionStorage.getItem(SCHEMA_KEY)==='0'?false:null;}catch{return null;}})(),ownVisibility='private',postKind='text';
  const markLegacySchema=()=>{schemaV41=false;try{sessionStorage.setItem(SCHEMA_KEY,'0');}catch{}};
  const V41_COLS=',post_kind,image_path,achievement,updated_at';
  const MIGRATION_HINT='Para publicar texto o logros, aplicá en Supabase supabase/migrations/2026-10-17_v41_posts_achievements_unread.sql.';
  const isMissingColumn=error=>String(error?.code||'')==='42703'||/column .* does not exist|could not find the .* column/i.test(String(error?.message||''));
  const messageAttempts=[];
  const bucket='community-media';
  const localDateKey=(date=new Date())=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const setStatus=(id,msg)=>{const el=$(id);if(el)el.textContent=msg;};
  const initials=name=>String(name||'FF').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase()||'FF';
  const dateLabel=value=>{if(!value)return '';const d=new Date(value+'T12:00:00');return Number.isNaN(d.getTime())?value:d.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'});};
  function status(message){const target=currentSubView==='explore'?'communityExploreStatus':currentSubView==='publish'?'communityPostStatus':currentSubView==='messages'?'communityChatStatus':currentSubView==='profile'?'communityProfileStatus':'communityFeedStatus';setStatus(target,message);}
  function connectionStatus(message){setStatus('communityConnectionStatus',message);}
  function authReady(){return !!client&&!!user;}
  function authHint(){return client?'Iniciá sesión desde Perfil para publicar, comentar o seguir personas.':(connectionMessage||'No se conectó Supabase. Tocá “Comprobar conexión” para revisar la configuración.');}
  function friendlySupabaseError(error,context='la comunidad'){const code=String(error?.code||''),message=String(error?.message||'Error desconocido');if(code==='PGRST201'||/more than one relationship was found/i.test(message))return `Supabase encontró más de una relación posible al ${context}. Esta versión identifica la clave foránea explícita; si el error continúa, revisá el nombre de la relación en los detalles. Detalle: ${message}`;if(code==='PGRST202'||/could not find the function|function .* does not exist|schema cache.*function/i.test(message))return `Supabase respondió, pero falta o no está publicada una función necesaria para ${context}. Revisá la versión de community.sql aplicada en este proyecto y los permisos EXECUTE. Detalle: ${message}`;if(code==='42P01'||code==='PGRST205'||/relation .* does not exist|could not find the table/i.test(message))return `Supabase respondió, pero falta una tabla necesaria para ${context}. Revisá que community.sql se haya ejecutado completamente en este mismo proyecto. Detalle: ${message}`;if(code==='42501'||/row-level security|permission denied|not allowed/i.test(message))return `Supabase está conectado, pero las políticas/permisos RLS impiden ${context}. No vuelvas a ejecutar SQL a ciegas; revisá el código ${code||'de permisos'} y el detalle: ${message}`;if(/failed to fetch|network|fetcherror|load failed/i.test(message))return `No se pudo llegar a Supabase desde el navegador. Revisá conexión, URL del proyecto y consola del navegador. Detalle: ${message}`;return `No se pudo completar ${context}.${code?` Código ${code}.`:''} Detalle: ${message}`;}
  function setControls(){
    const ready=!!client,logged=!!user;
    ['communityProfileForm','communityPostForm'].forEach(id=>{const form=$(id);if(form)form.querySelectorAll('input,textarea,select,button').forEach(el=>{if(id==='communityPostForm'&&el.id==='communityPublish')el.disabled=!logged;});});
    if($('communityGoogleLogin'))$('communityGoogleLogin').disabled=!ready||logged;
    if($('communitySignOut'))$('communitySignOut').hidden=!logged;
    if(!ready){status(authHint());setStatus('communityProfileStatus',authHint());}
    else if(!logged){setStatus('communityProfileStatus','Iniciá sesión por correo en Perfil o usá Google para crear tu perfil comunitario.');}
    else setStatus('communityProfileStatus','Sesión online: '+(user.email||'cuenta conectada')+'.');
  }
  async function ensureProfile(){
    if(!authReady())throw new Error(authHint());
    const {data,error}=await client.from('community_profiles').select('*').eq('user_id',user.id).maybeSingle();
    if(error)throw error;
    if(data){fillProfile(data);return data;}
    const display=(user.user_metadata?.full_name||user.user_metadata?.name||user.email?.split('@')[0]||'Usuario').slice(0,60);
    const username=(String(user.user_metadata?.preferred_username||user.email?.split('@')[0]||'usuario').toLowerCase().replace(/[^a-z0-9_.-]/g,'').slice(0,20)+'_'+user.id.slice(0,4)).slice(0,24);
    const payload={user_id:user.id,display_name:display,username, bio:'',visibility:'private'};
    const result=await client.from('community_profiles').upsert(payload,{onConflict:'user_id'}).select('*').single();
    if(result.error)throw result.error;fillProfile(result.data);return result.data;
  }
  function fillProfile(p){
    if(!$('communityDisplayName'))return;
    ownVisibility=p.visibility==='public'?'public':'private';
    $('communityDisplayName').value=p.display_name||'';$('communityUsername').value=p.username||'';$('communityBio').value=p.bio||'';$('communityVisibility').value=p.visibility||'private';
    $('communityOwnName').textContent=p.display_name||p.username||'Tu perfil';$('communityOwnAvatar').textContent=initials(p.display_name||p.username);
    $('communityOwnStats').textContent=`${p.post_count||0} publicaciones · ${p.follower_count||0} seguidores`;
    if(client&&user?.id===p.user_id)refreshOwnCounts();
  }
  async function refreshOwnCounts(){if(!client||!user)return;try{const [posts,followers]=await Promise.all([client.from('community_posts').select('id',{count:'exact',head:true}).eq('user_id',user.id),client.from('community_follows').select('follower_id',{count:'exact',head:true}).eq('following_id',user.id).eq('status','accepted')]);if($('communityOwnStats'))$('communityOwnStats').textContent=`${posts.count||0} publicaciones · ${followers.count||0} seguidores`;}catch{}}
  async function loadFollowRequests(){const root=$('communityFollowRequests');if(!root)return;if(!authReady()){root.textContent='Iniciá sesión para administrar solicitudes.';return;}const {data,error}=await client.from('community_follows').select('follower_id,created_at,community_profiles!community_follows_follower_id_fkey(user_id,display_name,username,bio)').eq('following_id',user.id).eq('status','pending').order('created_at',{ascending:false}).limit(30);if(error){root.textContent='No se pudieron cargar las solicitudes: '+error.message;return;}if(!data?.length){root.textContent='No hay solicitudes pendientes.';return;}root.innerHTML=data.map(row=>{const profile=Array.isArray(row.community_profiles)?row.community_profiles[0]:row.community_profiles;return `<div class="community-comment"><strong>${esc(profile?.display_name||'Usuario')}</strong> <span class="muted">@${esc(profile?.username||row.follower_id.slice(0,8))}</span><div class="btn-row" style="margin-top:7px"><button class="btn secondary" type="button" data-community-accept="${esc(row.follower_id)}">Aceptar</button><button class="btn ghost" type="button" data-community-reject="${esc(row.follower_id)}">Rechazar</button></div></div>`;}).join('');root.querySelectorAll('[data-community-accept]').forEach(b=>b.addEventListener('click',()=>resolveFollow(b.dataset.communityAccept,true)));root.querySelectorAll('[data-community-reject]').forEach(b=>b.addEventListener('click',()=>resolveFollow(b.dataset.communityReject,false)));}
  async function resolveFollow(followerId,accept){const result=accept?await client.from('community_follows').update({status:'accepted'}).eq('follower_id',followerId).eq('following_id',user.id).eq('status','pending'):await client.from('community_follows').delete().eq('follower_id',followerId).eq('following_id',user.id).eq('status','pending');if(result.error){status('No se pudo actualizar la solicitud: '+result.error.message);return;}await loadFollowRequests();await loadFeed();}
  async function signed(path){if(!path)return '';const {data,error}=await client.storage.from(bucket).createSignedUrl(path,600);if(error){console.warn('No se pudo abrir una imagen de comunidad:',error.message);return '';}return data?.signedUrl||'';}
  async function loadFeed(){
    if(loading)return;loading=true;
    try{
      if(!client){status(authHint());return;}
      status('Cargando publicaciones…');
      const extra=schemaV41===false?'':V41_COLS;
      const selectPosts='id,user_id,description,exercises_text,nutrition_text,running_text,start_date,end_date,before_path,after_path,visibility,created_at'+extra+',community_profiles!community_posts_user_id_fkey!inner(user_id,display_name,username,bio,visibility)';
      let rankByPost={},rankedIds=[];
      try{const ranked=await client.rpc('community_ranked_post_ids');if(!ranked.error&&ranked.data){ranked.data.forEach((r,index)=>{rankByPost[r.post_id]={index,isPro:!!r.is_pro,followerCount:Number(r.follower_count)||0,activityScore:Number(r.activity_score)||0};});rankedIds=ranked.data.map(r=>r.post_id);}}catch{}
      let query=client.from('community_posts').select(selectPosts);
      if(searchTerm){const term=searchTerm.replace(/^@/,'').replace(/[,%()]/g,'');query=query.ilike('community_profiles.username',`%${term}%`).order('created_at',{ascending:false}).limit(20);}
      else if(rankedIds.length)query=query.in('id',rankedIds.slice(0,30));
      else query=query.order('created_at',{ascending:false}).limit(30);
      let {data,error}=await query;
      // En proyectos donde el esquema haya quedado con una FK adicional o un nombre distinto,
      // evitamos depender del embed ambiguo: consultamos posts y perfiles por separado, bajo RLS.
      if(error&&(error.code==='PGRST201'||error.code==='PGRST200')){
        let fallbackQuery=client.from('community_posts').select('id,user_id,description,exercises_text,nutrition_text,running_text,start_date,end_date,before_path,after_path,visibility,created_at'+extra);
        if(searchTerm){
          const term=searchTerm.replace(/^@/,'').replace(/[,%()]/g,'');
          const profileResult=await client.from('community_profiles').select('user_id').ilike('username',`%${term}%`).limit(30);
          if(profileResult.error)throw profileResult.error;
          const matchingUsers=(profileResult.data||[]).map(row=>row.user_id);
          if(!matchingUsers.length){data=[];error=null;}
          else fallbackQuery=fallbackQuery.in('user_id',matchingUsers).order('created_at',{ascending:false}).limit(20);
        }else if(rankedIds.length)fallbackQuery=fallbackQuery.in('id',rankedIds.slice(0,30));
        else fallbackQuery=fallbackQuery.order('created_at',{ascending:false}).limit(30);
        if(error){const fallback=await fallbackQuery;if(fallback.error)throw fallback.error;data=fallback.data||[];const authorIds=[...new Set(data.map(row=>row.user_id))];if(authorIds.length){const profileResult=await client.from('community_profiles').select('user_id,display_name,username,bio,visibility').in('user_id',authorIds);if(profileResult.error)throw profileResult.error;const byUser=new Map((profileResult.data||[]).map(profile=>[profile.user_id,profile]));data=data.filter(post=>byUser.has(post.user_id)).map(post=>({...post,community_profiles:byUser.get(post.user_id)}));}else data=[];error=null;}
      }
      if(error&&schemaV41!==false&&isMissingColumn(error)){markLegacySchema();loading=false;updateKindAvailability();return loadFeed();}
      if(error)throw error;
      if(schemaV41===null){schemaV41=true;updateKindAvailability();}
      let posts=data||[];
      if(feedSort==='recent')posts.sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')));
      else if(feedSort==='likes'){const counts={};(await client.from('community_likes').select('post_id').in('post_id',posts.map(p=>p.id))).data?.forEach(x=>counts[x.post_id]=(counts[x.post_id]||0)+1);posts.sort((a,b)=>(counts[b.id]||0)-(counts[a.id]||0)||String(b.created_at||'').localeCompare(String(a.created_at||'')));}
      else posts.sort((a,b)=>(rankByPost[a.id]?.index??9999)-(rankByPost[b.id]?.index??9999));
      const ids=posts.map(p=>p.id);
      let likes=[],comments=[],following=[];
      if(ids.length){
        const requests=[client.from('community_likes').select('post_id,user_id').in('post_id',ids),client.from('community_comments').select('id,post_id,user_id,body,created_at,community_profiles!community_comments_user_id_fkey(display_name,username)').in('post_id',ids).order('created_at',{ascending:true})];
        if(user)requests.push(client.from('community_follows').select('following_id,status').eq('follower_id',user.id));
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
        if(user&&results[2]&&!results[2].error)following=results[2].data||[];
      }
      const likedSet=new Set(likes.filter(x=>x.user_id===user?.id).map(x=>x.post_id));
      const followStatus=new Map(following.map(x=>[x.following_id,x.status]));
      const countBy={};likes.forEach(x=>countBy[x.post_id]=(countBy[x.post_id]||0)+1);
      const markup=[];
      for(const p of posts){
        const profile=Array.isArray(p.community_profiles)?p.community_profiles[0]:p.community_profiles;
        const kind=p.post_kind||'transformation';
        const [before,after,single]=await Promise.all([kind==='transformation'?signed(p.before_path):'',kind==='transformation'?signed(p.after_path):'',p.image_path?signed(p.image_path):'']);
        const postComments=comments.filter(c=>c.post_id===p.id);
        const profileName=profile?.display_name||profile?.username||'Usuario';
        const owner=user?.id===p.user_id;
        const followState=followStatus.get(p.user_id)||'';
        const isFollowing=followState==='accepted';
        const isPending=followState==='pending';
        const duration=kind==='transformation'&&p.start_date&&p.end_date?`${dateLabel(p.start_date)} – ${dateLabel(p.end_date)}`:dateLabel(p.created_at?.slice(0,10))+(p.updated_at?' · editado':'');
        const kindLabel=kind==='achievement'?'Logro':kind==='text'?'Publicación':'Transformación';
        const media=kind==='transformation'?`<div class="community-photos">${before?`<div class="community-photo"><img loading="lazy" src="${esc(before)}" alt="Foto de antes de ${esc(profileName)}"><span>ANTES</span></div>`:'<div class="community-photo"><span>ANTES · imagen no disponible</span></div>'}${after?`<div class="community-photo"><img loading="lazy" src="${esc(after)}" alt="Foto de después de ${esc(profileName)}"><span>DESPUÉS</span></div>`:'<div class="community-photo"><span>DESPUÉS · imagen no disponible</span></div>'}</div>`:(single?`<div class="community-single-photo"><img loading="lazy" src="${esc(single)}" alt="Foto compartida por ${esc(profileName)}"></div>`:'');
        const achievementHtml=kind==='achievement'&&p.achievement?achievementCard(p.achievement):'';
        const tags=[p.exercises_text?`Rutina: ${p.exercises_text}`:'',p.nutrition_text?`Alimentación: ${p.nutrition_text}`:'',p.running_text?`Actividad: ${p.running_text}`:''].filter(Boolean);
        const commentHtml=postComments.map(c=>{const cp=Array.isArray(c.community_profiles)?c.community_profiles[0]:c.community_profiles;return `<div class="community-comment"><strong>${esc(cp?.display_name||cp?.username||'Usuario')}</strong> ${esc(c.body)}${user?.id===c.user_id?` <button class="btn ghost" type="button" data-community-delete-comment="${esc(c.id)}">Borrar</button>`:''}</div>`;}).join('');
        const rank=rankByPost[p.id]||{isPro:false,followerCount:0,activityScore:0};
        markup.push(`<article class="card community-post" data-community-post="${esc(p.id)}"><div class="community-post-head"><div class="community-avatar">${esc(initials(profileName))}</div><div class="community-author"><strong>${esc(profileName)} ${rank.isPro?'<span class="community-pro-badge">PRO</span>':''} <span class="muted">@${esc(profile?.username||'usuario')}</span></strong><small>${esc(duration)}${p.visibility==='followers'?' · Seguidores':''}<span class="community-follower-count">· ${rank.followerCount} seguidores</span></small></div>${owner?'':`${user?`<button class="btn ghost" type="button" data-community-follow="${esc(p.user_id)}" data-following="${isFollowing?'yes':isPending?'pending':'no'}">${isFollowing?'Siguiendo':isPending?'Solicitud enviada':'Seguir'}</button><button class="btn ghost" type="button" data-community-block="${esc(p.user_id)}">Bloquear</button>`:''}`}</div>${media}<div class="community-post-body"><span class="community-kind">${kindLabel}</span>${achievementHtml}${p.description?`<p data-community-post-text>${esc(p.description)}</p>`:''}${tags.length?`<div class="community-tags">${tags.map(t=>`<span>${esc(t)}</span>`).join('')}</div>`:''}<p class="muted small">Información compartida por el usuario; no está verificada automáticamente por FittForma.</p></div><div class="community-actions"><button class="btn ${likedSet.has(p.id)?'':'secondary'}" type="button" data-community-like="${esc(p.id)}">♥ ${likedSet.has(p.id)?'Te gusta':'Me gusta'} · ${countBy[p.id]||0}</button>${owner?'':`<button class="btn ghost" type="button" data-community-report="${esc(p.id)}">Denunciar</button>`}${owner&&schemaV41?`<button class="btn ghost" type="button" data-community-edit-post="${esc(p.id)}" data-kind="${esc(kind)}">Editar texto</button>`:''}${owner?`<button class="btn ghost" type="button" data-community-delete-post="${esc(p.id)}">Eliminar</button>`:''}</div><div class="community-comments"><strong>Comentarios (${postComments.length})</strong>${commentHtml||'<p class="muted small">Todavía no hay comentarios.</p>'}${user?`<form class="community-comment-form" data-community-comment-form="${esc(p.id)}"><input name="body" maxlength="500" required placeholder="Escribí un comentario…" aria-label="Escribí un comentario"><button class="btn secondary" type="submit">Enviar</button></form>`:`<p class="muted small">Iniciá sesión para comentar.</p>`}</div></article>`);
      }
      const outputRoot=searchTerm&&$('communitySearchPosts')?$('communitySearchPosts'):$('communityFeed');
      if(outputRoot)outputRoot.innerHTML=markup.join('')||(searchTerm?'<div class="empty"><strong>No hay publicaciones que coincidan</strong><p>Probá otra búsqueda o seguí explorando perfiles.</p></div>':'<div class="empty"><strong>Tu feed está vacío por ahora</strong><p>Seguí perfiles desde Explorar o compartí tu primer logro.</p><button class="btn" type="button" data-community-go="publish">Crear una publicación</button></div>');
      status(`${posts.length} publicación(es) cargadas.`);connectionStatus('Supabase responde correctamente: el feed de Comunidad se pudo consultar.');bindFeedActions(outputRoot||$('communityFeed'));
    }catch(error){const message=friendlySupabaseError(error,'cargar el feed de la comunidad');status(message);connectionStatus(message);}
    finally{loading=false;}
  }
  async function saveProfile(e){e.preventDefault();if(!authReady()){setStatus('communityProfileStatus',authHint());return;}
    const display=$('communityDisplayName').value.trim(),username=$('communityUsername').value.trim().toLowerCase(),bio=$('communityBio').value.trim(),visibility=$('communityVisibility').value;
    if(display.length<1||!/^[a-z0-9_.-]{3,24}$/.test(username)){setStatus('communityProfileStatus','Revisá el nombre y el usuario (3–24 caracteres permitidos).');return;}
    setStatus('communityProfileStatus','Guardando perfil…');
    const {data,error}=await client.from('community_profiles').upsert({user_id:user.id,display_name:display,username,bio,visibility,updated_at:new Date().toISOString()},{onConflict:'user_id'}).select('*').single();
    if(error){setStatus('communityProfileStatus',error.message.includes('unique')?'Ese usuario ya está ocupado. Elegí otro.':`No se pudo guardar: ${error.message}`);return;}fillProfile(data);setStatus('communityProfileStatus','Perfil guardado. Privacidad: '+(visibility==='public'?'público':'privado')+'.');await loadFeed();
  }
  async function prepareImage(file){
    if(!file)throw new Error('Elegí las dos fotos de antes y después.');
    if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Las fotos deben ser JPG, PNG o WebP.');
    if(file.size>8*1024*1024)throw new Error('Cada foto original debe pesar como máximo 8 MB.');
    // Reencode on-device to JPEG: reduces upload size and strips EXIF metadata (including possible GPS data).
    let bitmap;try{bitmap=await createImageBitmap(file);}catch{throw new Error('No se pudo procesar la foto en este navegador. Probá con un JPG, PNG o WebP más simple.');}
    try{const scale=Math.min(1,1800/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)throw new Error('No se pudo preparar la imagen.');ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('No se pudo comprimir la foto.')),'image/jpeg',0.86));return new File([blob],'fittforma-photo.jpg',{type:'image/jpeg',lastModified:Date.now()});}finally{bitmap.close?.();}
  }
  async function uploadImage(file,path){
    const processed=await prepareImage(file);const options={cacheControl:'600',upsert:false,contentType:'image/jpeg'};const {error}=await client.storage.from(bucket).upload(path,processed,options);if(error)throw error;return path;
  }
  async function createPost(e){e.preventDefault();if(!authReady()){setStatus('communityPostStatus',authHint());return;}
    const beforeFile=$('communityBeforePhoto').files?.[0],afterFile=$('communityAfterPhoto').files?.[0],start=$('communityStartDate').value,end=$('communityEndDate').value;
    if(!beforeFile||!afterFile){setStatus('communityPostStatus','Elegí una foto de antes y una de después.');return;}
    if(!start||!end||end<start||end>localDateKey()){setStatus('communityPostStatus','Revisá las fechas: la final debe ser igual o posterior a la inicial y no futura.');return;}
    const btn=$('communityPublish');btn.disabled=true;setStatus('communityPostStatus','Subiendo fotos…');let beforePath='',afterPath='';
    try{
      const postId=crypto.randomUUID();beforePath=await uploadImage(beforeFile,`${user.id}/${postId}/before.jpg`);afterPath=await uploadImage(afterFile,`${user.id}/${postId}/after.jpg`);
      const profile=await ensureProfile();const visibility=profile.visibility==='public'&&$('communityPostPublic').checked?'public':'followers';
      const {error}=await client.from('community_posts').insert({id:postId,user_id:user.id,description:$('communityPostDescription').value.trim(),exercises_text:$('communityPostExercises').value.trim(),nutrition_text:$('communityPostNutrition').value.trim(),running_text:$('communityPostRunning').value.trim(),start_date:start,end_date:end,before_path:beforePath,after_path:afterPath,visibility});
      if(error)throw error;$('communityPostForm').reset();setStatus('communityPostStatus','¡Transformación publicada!');showCommunitySubView('feed');await loadFeed();
    }catch(error){if(beforePath||afterPath){try{await client.storage.from(bucket).remove([beforePath,afterPath].filter(Boolean));}catch{}}setStatus('communityPostStatus',`No se pudo publicar: ${error.message||'revisá las políticas de Supabase.'}`);}
    finally{btn.disabled=false;}
  }
  async function toggleLike(postId){if(!authReady())return alert(authHint());const {data,error}=await client.from('community_likes').select('post_id').eq('post_id',postId).eq('user_id',user.id).maybeSingle();if(error){status(error.message);return;}const result=data?await client.from('community_likes').delete().eq('post_id',postId).eq('user_id',user.id):await client.from('community_likes').insert({post_id:postId,user_id:user.id});if(result.error)status(`No se pudo actualizar el me gusta: ${result.error.message}`);else await loadFeed();}
  async function addComment(postId,body){if(!authReady())return alert(authHint());const text=String(body||'').trim();if(!text||text.length>500)return;const {error}=await client.from('community_comments').insert({post_id:postId,user_id:user.id,body:text});if(error)status(`No se pudo comentar: ${error.message}`);else await loadFeed();}
  async function toggleFollow(target,button){if(!authReady())return alert(authHint());if(target===user.id)return;const {data,error}=await client.from('community_follows').select('follower_id,following_id,status').eq('follower_id',user.id).eq('following_id',target).maybeSingle();if(error){status(error.message);return;}let result;if(data)result=await client.from('community_follows').delete().eq('follower_id',user.id).eq('following_id',target);else{
      // La base de datos decide si el seguimiento queda aceptado o pendiente según la privacidad.
      result=await client.from('community_follows').insert({follower_id:user.id,following_id:target,status:'pending'}).select('status').single();
    }if(result.error)status(`No se pudo actualizar el seguimiento: ${result.error.message}`);else{if(!data&&button)button.textContent=result.data?.status==='accepted'?'Siguiendo':'Solicitud enviada';await loadFeed();}}
  async function blockUser(target){
    if(!authReady())return alert(authHint());if(!target||target===user.id)return;
    if(!confirm('¿Bloquear a esta persona? Dejarán de verse entre ustedes en la comunidad, se eliminará el seguimiento mutuo y no podrán enviarse mensajes. Podés desbloquearla desde tu perfil.'))return;
    const {error}=await client.from('community_blocks').insert({blocker_id:user.id,blocked_id:target});
    if(error){status(error.message.includes('duplicate')?'Esta persona ya está bloqueada.':`No se pudo bloquear: ${error.message}`);return;}
    status('Usuario bloqueado. El seguimiento entre ambas cuentas fue eliminado.');
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
    async function deletePost(id){if(!confirm('¿Eliminar esta publicación? También se borran sus fotos, me gusta y comentarios.'))return;const {data,error}=await client.from('community_posts').select('before_path,after_path'+(schemaV41?',image_path':'')).eq('id',id).eq('user_id',user.id).maybeSingle();if(error||!data){status(error?.message||'No se encontró la publicación.');return;}const {error:delError}=await client.from('community_posts').delete().eq('id',id).eq('user_id',user.id);if(delError){status(delError.message);return;}const paths=[data.before_path,data.after_path,data.image_path].filter(Boolean);if(paths.length)await client.storage.from(bucket).remove(paths);await loadFeed();}
  async function reportPost(id){if(!authReady())return alert(authHint());const reason=prompt('Motivo de la denuncia (spam, acoso, contenido inapropiado, otro):');if(!reason)return;const {error}=await client.from('community_reports').insert({reporter_id:user.id,post_id:id,reason:reason.trim().slice(0,300)});if(error)status(error.code==='23505'?'Ya enviaste una denuncia por esta publicación.':`No se pudo enviar la denuncia: ${error.message}`);else status('Denuncia enviada. Gracias por ayudar a cuidar la comunidad.');}
  async function deleteComment(id){if(!confirm('¿Borrar tu comentario?'))return;const {error}=await client.from('community_comments').delete().eq('id',id).eq('user_id',user.id);if(error)status(error.message);else await loadFeed();}
  function achievementCard(a){
    const E=window.FittFormaBadgeEngine,level=Math.min(12,Math.max(1,Number(a?.level)||1));
    const rank=E?E.rankForLevel(level-1):{label:String(a?.rank||''),key:String(a?.rank||'bronze'),numeral:''};
    const medal=E?E.medalSvg({rankKey:rank.key,numeral:rank.numeral,glyph:E.glyphFor({category:a?.category}),size:56,title:rank.label}):'';
    const goal=E?E.formatValue(a?.threshold,a?.measure):String(a?.threshold??'');
    const gps=a?.evidence==='gps_device';
    return `<div class="community-achievement">${medal}<div class="community-achievement-copy"><small>Insignia obtenida</small><strong>${esc(a?.exerciseName||'Desafío')} · ${esc(rank.label)}</strong><span>Meta del nivel: ${esc(goal)} · ${esc(dateLabel(a?.earnedAt))}</span><span class="ff-evidence ${gps?'is-gps':''}">${gps?'Ruta GPS según el dispositivo del autor':'Declarada por el autor'}</span></div></div>`;
  }
  function startEditPost(button){
    const id=button.dataset.communityEditPost,article=button.closest('[data-community-post]');if(!article||article.querySelector('.community-edit-form'))return;
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
  function renderPostPreview(){
    const root=$('communityPostPreview');if(!root)return;
    const audience=ownVisibility==='public'?'Visible para cualquier persona (perfil público)':'Visible solo para tus seguidores aceptados (perfil privado)';
    let inner='';
    if(postKind==='text'){
      const text=$('communityTextBody')?.value.trim()||'',file=$('communityTextImage')?.files?.[0];
      if($('communityTextCount'))$('communityTextCount').textContent=String(($('communityTextBody')?.value||'').length);
      if($('communityTextConsentRow'))$('communityTextConsentRow').hidden=!file;
      inner=text||file?`${text?`<p>${esc(text)}</p>`:''}${file?'<p class="muted small">Incluye 1 foto (recomprimida y sin metadatos).</p>':''}`:'<p class="muted small">Escribí algo para ver la vista previa.</p>';
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
        const body=$('communityTextBody').value.trim(),file=$('communityTextImage').files?.[0];
        if(!body)throw new Error('Escribí el texto de la publicación.');
        if(file){if(!$('communityTextPhotoConsent').checked)throw new Error('Confirmá que tenés derecho a publicar la foto.');setStatus('communityComposeStatus','Subiendo foto…');imagePath=await uploadImage(file,`${user.id}/${postId}/image.jpg`);}
        row={id:postId,user_id:user.id,post_kind:'text',description:body,image_path:imagePath,visibility};
      }else{
        const badge=shareableBadges().find(x=>x.key===$('communityAchievementSelect').value);
        if(!badge)throw new Error('Elegí una insignia para compartir.');
        row={id:postId,user_id:user.id,post_kind:'achievement',description:$('communityAchievementComment').value.trim(),achievement:badge.payload,visibility};
      }
      const {error}=await client.from('community_posts').insert(row);
      if(error)throw error;
      (postKind==='text'?$('communityTextPostForm'):$('communityAchievementPostForm')).reset();
      setStatus('communityComposeStatus','Publicado.');renderPostPreview();showCommunitySubView('feed');await loadFeed();
    }catch(error){
      if(imagePath){try{await client.storage.from(bucket).remove([imagePath]);}catch(cleanupError){console.warn('No se pudo limpiar la foto subida:',cleanupError);}}
      setStatus('communityComposeStatus',error?.code?friendlySupabaseError(error,'publicar'):`No se pudo publicar: ${error.message}`);
    }finally{button.disabled=!authReady()||schemaV41===false;}
  }
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
  function bindFeedActions(root=$('communityFeed')){
    if(!root)return;
    root.querySelectorAll('[data-community-like]').forEach(b=>b.addEventListener('click',()=>toggleLike(b.dataset.communityLike)));
    root.querySelectorAll('[data-community-follow]').forEach(b=>b.addEventListener('click',()=>toggleFollow(b.dataset.communityFollow,b)));
    root.querySelectorAll('[data-community-block]').forEach(b=>b.addEventListener('click',()=>blockUser(b.dataset.communityBlock)));
    root.querySelectorAll('[data-community-edit-post]').forEach(b=>b.addEventListener('click',()=>startEditPost(b)));
    root.querySelectorAll('[data-community-go]').forEach(b=>b.addEventListener('click',()=>showCommunitySubView(b.dataset.communityGo)));
    root.querySelectorAll('[data-community-delete-post]').forEach(b=>b.addEventListener('click',()=>deletePost(b.dataset.communityDeletePost)));
    root.querySelectorAll('[data-community-report]').forEach(b=>b.addEventListener('click',()=>reportPost(b.dataset.communityReport)));
    root.querySelectorAll('[data-community-delete-comment]').forEach(b=>b.addEventListener('click',()=>deleteComment(b.dataset.communityDeleteComment)));
    root.querySelectorAll('[data-community-comment-form]').forEach(form=>form.addEventListener('submit',e=>{e.preventDefault();const input=form.elements.body;addComment(form.dataset.communityCommentForm,input.value);}));
  }
  async function loadChatContacts(){
    const select=$('communityChatContact');if(!select)return;
    if(!authReady()){select.innerHTML='<option value="">Iniciá sesión para chatear</option>';setStatus('communityChatStatus','Iniciá sesión para usar los mensajes privados.');return;}
    setStatus('communityChatStatus','Buscando contactos que se siguen mutuamente…');
    const [outgoing,incoming]=await Promise.all([
      client.from('community_follows').select('following_id,community_profiles!community_follows_following_id_fkey(user_id,display_name,username)').eq('follower_id',user.id).eq('status','accepted').limit(500),
      client.from('community_follows').select('follower_id,community_profiles!community_follows_follower_id_fkey(user_id,display_name,username)').eq('following_id',user.id).eq('status','accepted').limit(500)
    ]);
    if(outgoing.error||incoming.error){setStatus('communityChatStatus','No se pudieron cargar contactos. Aplicá la actualización v40 del esquema de Supabase.');return;}
    const follows=new Set((outgoing.data||[]).map(x=>x.following_id));
    const mutual=(incoming.data||[]).filter(x=>follows.has(x.follower_id)).map(x=>({id:x.follower_id,profile:Array.isArray(x.community_profiles)?x.community_profiles[0]:x.community_profiles}));
    const old=select.value;select.innerHTML='<option value="">Elegí un contacto mutuo</option>'+mutual.map(x=>`<option value="${esc(x.id)}">${esc(x.profile?.display_name||x.profile?.username||'Usuario')} (@${esc(x.profile?.username||'usuario')})</option>`).join('');
    if(mutual.some(x=>x.id===old))select.value=old;
    setStatus('communityChatStatus',mutual.length?`${mutual.length} contacto(s) disponible(s). El chat se habilita solo con seguimiento mutuo aceptado.`:'Todavía no tenés contactos con seguimiento mutuo aceptado.');
    if(select.value)await loadMessages();else{$('communityChatMessages').innerHTML='<p class="muted small">Elegí un contacto para abrir la conversación.</p>';await loadUnread();}
  }
  async function loadMessages(){
    const target=$('communityChatContact')?.value,root=$('communityChatMessages');if(!root)return;
    if(!authReady()||!target){root.innerHTML='<p class="muted small">Elegí un contacto mutuo.</p>';return;}
    const {data,error}=await client.from('community_messages').select('id,sender_id,recipient_id,body,created_at').or(`and(sender_id.eq.${user.id},recipient_id.eq.${target}),and(sender_id.eq.${target},recipient_id.eq.${user.id})`).order('created_at',{ascending:true}).limit(200);
    if(error){root.innerHTML='<p class="muted small">No se pudo abrir el chat. Comprobá que ejecutaste la actualización v40 del esquema de Supabase.</p>';setStatus('communityChatStatus',error.message);return;}
    root.innerHTML=(data||[]).map(m=>`<div class="community-chat-message ${m.sender_id===user.id?'mine':''}">${esc(m.body)}<small>${m.sender_id===user.id?'Vos':'Contacto'} · ${esc(new Date(m.created_at).toLocaleString())}</small></div>`).join('')||'<p class="muted small">Todavía no hay mensajes. ¡Saludá!</p>';
    root.scrollTop=root.scrollHeight;
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
  async function searchUsers(e){e.preventDefault();searchTerm=$('communitySearch').value.trim();if(!client){status(authHint());return;}const root=$('communitySearchResults'),postRoot=$('communitySearchPosts');root.innerHTML='';if(postRoot)postRoot.innerHTML='';if(!searchTerm){status('Escribí un nombre o @usuario para explorar perfiles y publicaciones.');return;}const term=searchTerm.replace(/^@/,'').replace(/[,%()]/g,'');const {data,error}=await client.rpc('search_community_profiles',{search_term:term});if(error){status(friendlySupabaseError(error,'buscar perfiles'));return;}if(!data?.length){root.innerHTML='<div class="empty"><strong>No encontramos perfiles</strong><p>Probá con otro apodo o nombre de usuario.</p></div>';status('No se encontraron perfiles públicos coincidentes.');await loadFeed();return;}root.innerHTML=data.map(p=>`<article class="card community-search-person"><div class="community-profile-top"><div class="community-avatar">${esc(initials(p.display_name))}</div><div style="flex:1;min-width:0"><strong>${esc(p.display_name)}</strong><div class="muted small">@${esc(p.username)}</div><p>${esc(p.bio||(p.visibility==='private'?'Perfil privado · su contenido requiere aprobación para verlo.':'Sin descripción todavía.'))}</p></div>${user&&user.id!==p.user_id?`<div class="btn-row"><button class="btn secondary" type="button" data-community-search-follow="${esc(p.user_id)}">${p.visibility==='private'?'Solicitar seguir':'Seguir'}</button><button class="btn ghost" type="button" data-community-search-block="${esc(p.user_id)}">Bloquear</button></div>`:''}</div></article>`).join('');root.querySelectorAll('[data-community-search-follow]').forEach(b=>b.addEventListener('click',()=>toggleFollow(b.dataset.communitySearchFollow,b)));root.querySelectorAll('[data-community-search-block]').forEach(b=>b.addEventListener('click',()=>blockUser(b.dataset.communitySearchBlock)));status(`Perfiles encontrados: ${data.length}. Los perfiles privados muestran solo datos básicos y requieren aprobación para ver su contenido.`);await loadFeed();}
  async function emailLogin(e){e.preventDefault();if(!client)return setStatus('communityEmailStatus',authHint());const email=$('communityEmail').value.trim(),password=$('communityPassword').value;const {error}=await client.auth.signInWithPassword({email,password});if(error){setStatus('communityEmailStatus',`No se pudo iniciar sesión: ${error.message}`);return;}$('communityPassword').value='';setStatus('communityEmailStatus','Sesión iniciada.');}
  async function emailRegister(){if(!client)return setStatus('communityEmailStatus',authHint());const email=$('communityEmail').value.trim(),password=$('communityPassword').value;if(!email||password.length<8)return setStatus('communityEmailStatus','Ingresá un correo válido y una contraseña de al menos 8 caracteres.');const {data,error}=await client.auth.signUp({email,password});if(error){setStatus('communityEmailStatus',`No se pudo crear la cuenta: ${error.message}`);return;}if(data.session)setStatus('communityEmailStatus','Cuenta creada y sesión iniciada.');else setStatus('communityEmailStatus','Cuenta creada. Revisá tu correo para confirmar la dirección antes de iniciar sesión.');}
  async function googleLogin(){if(!client)return setStatus('communityProfileStatus',authHint());const {error}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:window.location.href.split('#')[0]}});if(error)setStatus('communityProfileStatus',`No se pudo iniciar con Google: ${error.message}`);}
  async function refresh(){if(!client){setControls();return;}if(user){try{await ensureProfile();await loadFollowRequests();}catch(e){setStatus('communityProfileStatus',`No se pudo preparar el perfil: ${e.message}`);}}setControls();await loadFeed();await loadChatContacts();await loadBlockedUsers();updateKindAvailability();renderPostPreview();}
  function init(supabase,userSession,diagnostic=''){client=supabase||null;user=userSession||null;connectionMessage=client?'':String(diagnostic||connectionMessage||'');connectionStatus(client?'Cliente de Supabase inicializado. Comprobando tablas y permisos de Comunidad…':(diagnostic||'Supabase todavía no está conectado.'));setControls();if(client)return refresh();return loadFeed();}
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
  function setSession(supabase,userSession){client=supabase||client;user=userSession||null;if(!user){if($('communityDisplayName'))$('communityDisplayName').value='';if($('communityUsername'))$('communityUsername').value='';if($('communityBio'))$('communityBio').value='';if($('communityVisibility'))$('communityVisibility').value='private';if($('communityOwnName'))$('communityOwnName').textContent='Tu perfil';if($('communityOwnAvatar'))$('communityOwnAvatar').textContent='FF';if($('communityOwnStats'))$('communityOwnStats').textContent='0 publicaciones · 0 seguidores';if($('communityFollowRequests'))$('communityFollowRequests').textContent='Iniciá sesión para administrar solicitudes.';if($('communitySearchResults'))$('communitySearchResults').innerHTML='';if($('communityBlockedList'))$('communityBlockedList').textContent='Iniciá sesión para administrar los bloqueos.';}setControls();updateKindAvailability();if(client)Promise.resolve().then(()=>refresh());else loadFeed();}
  const communityViews=['feed','explore','publish','messages','profile'];
  function showCommunitySubView(name,focusTab=false){
    if(!communityViews.includes(name))name='feed';
    const previous=currentSubView;currentSubView=name;
    document.querySelectorAll('[data-community-tab]').forEach(button=>{
      const selected=button.dataset.communityTab===name;
      button.setAttribute('aria-selected',selected?'true':'false');button.tabIndex=selected?0:-1;
      button.classList.toggle('is-active',selected);if(selected&&focusTab)button.focus();
    });
    document.querySelectorAll('[data-community-panel]').forEach(panel=>{
      const active=panel.dataset.communityPanel===name;panel.hidden=!active;panel.classList.toggle('is-active',active);
    });
    if(name==='feed'&&previous!=='feed'){
      searchTerm='';if($('communitySearch'))$('communitySearch').value='';if($('communitySearchResults'))$('communitySearchResults').innerHTML='';if($('communitySearchPosts'))$('communitySearchPosts').innerHTML='';
      if(client)loadFeed();
    }else if(name==='messages'&&client){loadChatContacts();}
    else if(name==='profile'&&authReady()){loadFollowRequests();loadBlockedUsers();}
    else if(name==='publish'){fillAchievementOptions();renderPostPreview();}
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
    $('communityRetryConnection')?.addEventListener('click',async()=>{const button=$('communityRetryConnection');if(button)button.disabled=true;connectionStatus('Revisando la configuración y la conexión…');try{if(typeof window.FittFormaRetrySupabase==='function'){const result=await window.FittFormaRetrySupabase();if(!result?.ok&&result?.message)connectionStatus(result.message);else if(result?.ok){const check=await testConnection();connectionStatus(check.message);if(check.ok)await loadFeed();}}else connectionStatus('La función de comprobación no está disponible. Publicá la última versión y recargá la página.');}catch(error){connectionStatus(`Falló la comprobación: ${error.message||'error desconocido'}`);}finally{if(button)button.disabled=false;}});$('communityFeedSort')?.addEventListener('change',e=>{feedSort=e.target.value;loadFeed();});$('communityProfileForm')?.addEventListener('submit',saveProfile);$('communityPostForm')?.addEventListener('submit',createPost);$('communityRefresh')?.addEventListener('click',()=>loadFeed());$('communitySearchForm')?.addEventListener('submit',searchUsers);$('communityClearSearch')?.addEventListener('click',()=>{searchTerm='';$('communitySearch').value='';$('communitySearchResults').innerHTML='';if($('communitySearchPosts'))$('communitySearchPosts').innerHTML='<div class="empty"><p>Los resultados aparecerán acá después de buscar.</p></div>';status('Escribí un nombre o @usuario para explorar perfiles y publicaciones.');});$('communityGoogleLogin')?.addEventListener('click',googleLogin);$('communityEmailAuthForm')?.addEventListener('submit',emailLogin);$('communityEmailRegister')?.addEventListener('click',emailRegister);$('communityChatContact')?.addEventListener('change',loadMessages);$('communityChatForm')?.addEventListener('submit',sendMessage);$('communityChatRefresh')?.addEventListener('click',loadChatContacts);$('communityChatDeleteConversation')?.addEventListener('click',deleteConversation);$('communityChatBlockContact')?.addEventListener('click',()=>blockUser($('communityChatContact')?.value));$('communitySignOut')?.addEventListener('click',async()=>{if(client){const {error}=await client.auth.signOut();if(error)setStatus('communityProfileStatus',error.message);}});
    document.querySelectorAll('[data-post-kind]').forEach((b,i,all)=>{b.addEventListener('click',()=>setPostKind(b.dataset.postKind));b.addEventListener('keydown',e=>{const d=e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0;if(!d)return;e.preventDefault();const next=all[(i+d+all.length)%all.length];setPostKind(next.dataset.postKind);next.focus();});});
    $('communityTextPostForm')?.addEventListener('submit',createKindPost);$('communityAchievementPostForm')?.addEventListener('submit',createKindPost);
    ['communityTextBody','communityTextImage','communityAchievementSelect','communityAchievementComment'].forEach(id=>{const el=$(id);if(el){el.addEventListener('input',renderPostPreview);el.addEventListener('change',renderPostPreview);}});
    window.addEventListener('fittforma:badgeschange',()=>{fillAchievementOptions();renderPostPreview();});
    setPostKind('text');
    const today=localDateKey();if($('communityEndDate'))$('communityEndDate').value=today;if($('communityStartDate'))$('communityStartDate').value=today;
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
  window.FittFormaCommunity={init,setSession,refresh,loadChatContacts,loadMessages,loadBlockedUsers,testConnection};
})();
