/* FittForma AI v40 — comunidad online, privacidad, bloqueos y ranking orgánico. Requiere supabase/community.sql. */
(()=>{
  'use strict';
  const $=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let client=null,user=null,searchTerm='',loading=false;
  const messageAttempts=[];
  const bucket='community-media';
  const setStatus=(id,msg)=>{const el=$(id);if(el)el.textContent=msg;};
  const initials=name=>String(name||'FF').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase()||'FF';
  const dateLabel=value=>{if(!value)return '';const d=new Date(value+'T12:00:00');return Number.isNaN(d.getTime())?value:d.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'});};
  function status(message){setStatus('communityFeedStatus',message);}
  function authReady(){return !!client&&!!user;}
  function authHint(){return client?'Iniciá sesión desde Perfil para publicar, comentar o seguir personas.':'La comunidad requiere configurar Supabase y aplicar supabase/community.sql.';}
  function setControls(){
    const ready=!!client,logged=!!user;
    ['communityProfileForm','communityPostForm'].forEach(id=>{const form=$(id);if(form)form.querySelectorAll('input,textarea,select,button').forEach(el=>{if(id==='communityPostForm'&&el.id==='communityPublish')el.disabled=!logged;});});
    if($('communityGoogleLogin'))$('communityGoogleLogin').disabled=!ready||logged;
    if($('communitySignOut'))$('communitySignOut').hidden=!logged;
    if(!ready){status('Sin conexión configurada. Aplicá el esquema y configurá Supabase para activar la comunidad.');setStatus('communityProfileStatus',authHint());}
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
      if(!client){status('Configurá Supabase para ver publicaciones compartidas.');return;}
      status('Cargando transformaciones…');
      const selectPosts='id,user_id,description,exercises_text,nutrition_text,running_text,start_date,end_date,before_path,after_path,visibility,created_at,community_profiles!inner(user_id,display_name,username,bio,visibility)';
      let rankByPost={},rankedIds=[];
      try{const ranked=await client.rpc('community_ranked_post_ids');if(!ranked.error&&ranked.data){ranked.data.forEach((r,index)=>{rankByPost[r.post_id]={index,isPro:!!r.is_pro,followerCount:Number(r.follower_count)||0,activityScore:Number(r.activity_score)||0};});rankedIds=ranked.data.map(r=>r.post_id);}}catch{}
      let query=client.from('community_posts').select(selectPosts);
      if(searchTerm){const term=searchTerm.replace(/^@/,'').replace(/[,%()]/g,'');query=query.ilike('community_profiles.username',`%${term}%`).order('created_at',{ascending:false}).limit(20);}
      else if(rankedIds.length)query=query.in('id',rankedIds.slice(0,30));
      else query=query.order('created_at',{ascending:false}).limit(30);
      const {data,error}=await query;if(error)throw error;
      let posts=data||[];posts.sort((a,b)=>(rankByPost[a.id]?.index??9999)-(rankByPost[b.id]?.index??9999));
      const ids=posts.map(p=>p.id);
      let likes=[],comments=[],following=[];
      if(ids.length){const requests=[client.from('community_likes').select('post_id,user_id').in('post_id',ids),client.from('community_comments').select('id,post_id,user_id,body,created_at,community_profiles(display_name,username)').in('post_id',ids).order('created_at',{ascending:true})];if(user)requests.push(client.from('community_follows').select('following_id,status').eq('follower_id',user.id));const results=await Promise.all(requests);if(!results[0].error)likes=results[0].data||[];if(!results[1].error)comments=results[1].data||[];if(user&&!results[2].error)following=results[2].data||[];}
      const likedSet=new Set(likes.filter(x=>x.user_id===user?.id).map(x=>x.post_id));
      const followStatus=new Map(following.map(x=>[x.following_id,x.status]));
      const countBy={};likes.forEach(x=>countBy[x.post_id]=(countBy[x.post_id]||0)+1);
      const markup=[];
      for(const p of posts){
        const profile=Array.isArray(p.community_profiles)?p.community_profiles[0]:p.community_profiles;
        const [before,after]=await Promise.all([signed(p.before_path),signed(p.after_path)]);
        const postComments=comments.filter(c=>c.post_id===p.id);
        const profileName=profile?.display_name||profile?.username||'Usuario';
        const owner=user?.id===p.user_id;
        const followState=followStatus.get(p.user_id)||'';
        const isFollowing=followState==='accepted';
        const isPending=followState==='pending';
        const duration=p.start_date&&p.end_date?`${dateLabel(p.start_date)} – ${dateLabel(p.end_date)}`:dateLabel(p.created_at?.slice(0,10));
        const tags=[p.exercises_text?`Rutina: ${p.exercises_text}`:'',p.nutrition_text?`Alimentación: ${p.nutrition_text}`:'',p.running_text?`Actividad: ${p.running_text}`:''].filter(Boolean);
        const commentHtml=postComments.map(c=>{const cp=Array.isArray(c.community_profiles)?c.community_profiles[0]:c.community_profiles;return `<div class="community-comment"><strong>${esc(cp?.display_name||cp?.username||'Usuario')}</strong> ${esc(c.body)}${user?.id===c.user_id?` <button class="btn ghost" type="button" data-community-delete-comment="${esc(c.id)}">Borrar</button>`:''}</div>`;}).join('');
        const rank=rankByPost[p.id]||{isPro:false,followerCount:0,activityScore:0};
        markup.push(`<article class="card community-post" data-community-post="${esc(p.id)}"><div class="community-post-head"><div class="community-avatar">${esc(initials(profileName))}</div><div class="community-author"><strong>${esc(profileName)} ${rank.isPro?'<span class="community-pro-badge">PRO</span>':''} <span class="muted">@${esc(profile?.username||'usuario')}</span></strong><small>${esc(duration)}${p.visibility==='followers'?' · Seguidores':''}<span class="community-follower-count">· ${rank.followerCount} seguidores</span></small></div>${owner?'':`${user?`<button class="btn ghost" type="button" data-community-follow="${esc(p.user_id)}" data-following="${isFollowing?'yes':isPending?'pending':'no'}">${isFollowing?'Siguiendo':isPending?'Solicitud enviada':'Seguir'}</button><button class="btn ghost" type="button" data-community-block="${esc(p.user_id)}">Bloquear</button>`:''}`}</div><div class="community-photos">${before?`<div class="community-photo"><img loading="lazy" src="${esc(before)}" alt="Foto de antes"><span>ANTES</span></div>`:'<div class="community-photo"><span>ANTES · imagen no disponible</span></div>'}${after?`<div class="community-photo"><img loading="lazy" src="${esc(after)}" alt="Foto de después"><span>DESPUÉS</span></div>`:'<div class="community-photo"><span>DESPUÉS · imagen no disponible</span></div>'}</div><div class="community-post-body">${p.description?`<p>${esc(p.description)}</p>`:''}${tags.length?`<div class="community-tags">${tags.map(t=>`<span>${esc(t)}</span>`).join('')}</div>`:''}<p class="muted small">Información compartida por el usuario; no está verificada automáticamente por FittForma.</p></div><div class="community-actions"><button class="btn ${likedSet.has(p.id)?'':'secondary'}" type="button" data-community-like="${esc(p.id)}">♥ ${likedSet.has(p.id)?'Te gusta':'Me gusta'} · ${countBy[p.id]||0}</button>${owner?'':`<button class="btn ghost" type="button" data-community-report="${esc(p.id)}">Denunciar</button>`}${owner?`<button class="btn ghost" type="button" data-community-delete-post="${esc(p.id)}">Eliminar publicación</button>`:''}</div><div class="community-comments"><strong>Comentarios (${postComments.length})</strong>${commentHtml||'<p class="muted small">Todavía no hay comentarios.</p>'}${user?`<form class="community-comment-form" data-community-comment-form="${esc(p.id)}"><input name="body" maxlength="500" required placeholder="Escribí un comentario…" aria-label="Escribí un comentario"><button class="btn secondary" type="submit">Enviar</button></form>`:`<p class="muted small">Iniciá sesión para comentar.</p>`}</div></article>`);
      }
      $('communityFeed').innerHTML=markup.join('')||'<div class="empty"><strong>No hay transformaciones para mostrar</strong><p>Probá otra búsqueda o publicá la primera transformación.</p></div>';
      status(`${posts.length} publicación(es) cargadas.`);bindFeedActions();
    }catch(error){status(`No se pudo cargar el feed: ${error.message||'revisá el esquema de Supabase y sus permisos.'}`);}
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
    if(!start||!end||end<start||end>new Date().toISOString().slice(0,10)){setStatus('communityPostStatus','Revisá las fechas: la final debe ser igual o posterior a la inicial y no futura.');return;}
    const btn=$('communityPublish');btn.disabled=true;setStatus('communityPostStatus','Subiendo fotos…');let beforePath='',afterPath='';
    try{
      const postId=crypto.randomUUID();beforePath=await uploadImage(beforeFile,`${user.id}/${postId}/before.jpg`);afterPath=await uploadImage(afterFile,`${user.id}/${postId}/after.jpg`);
      const profile=await ensureProfile();const visibility=profile.visibility==='public'&&$('communityPostPublic').checked?'public':'followers';
      const {error}=await client.from('community_posts').insert({id:postId,user_id:user.id,description:$('communityPostDescription').value.trim(),exercises_text:$('communityPostExercises').value.trim(),nutrition_text:$('communityPostNutrition').value.trim(),running_text:$('communityPostRunning').value.trim(),start_date:start,end_date:end,before_path:beforePath,after_path:afterPath,visibility});
      if(error)throw error;$('communityPostForm').reset();setStatus('communityPostStatus','¡Transformación publicada!');await loadFeed();
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
    async function deletePost(id){if(!confirm('¿Eliminar esta publicación y sus fotos?'))return;const {data,error}=await client.from('community_posts').select('before_path,after_path').eq('id',id).eq('user_id',user.id).maybeSingle();if(error||!data){status(error?.message||'No se encontró la publicación.');return;}const {error:delError}=await client.from('community_posts').delete().eq('id',id).eq('user_id',user.id);if(delError){status(delError.message);return;}await client.storage.from(bucket).remove([data.before_path,data.after_path].filter(Boolean));await loadFeed();}
  async function reportPost(id){if(!authReady())return alert(authHint());const reason=prompt('Motivo de la denuncia (spam, acoso, contenido inapropiado, otro):');if(!reason)return;const {error}=await client.from('community_reports').insert({reporter_id:user.id,post_id:id,reason:reason.trim().slice(0,300)});if(error)status(error.code==='23505'?'Ya enviaste una denuncia por esta publicación.':`No se pudo enviar la denuncia: ${error.message}`);else status('Denuncia enviada. Gracias por ayudar a cuidar la comunidad.');}
  async function deleteComment(id){if(!confirm('¿Borrar tu comentario?'))return;const {error}=await client.from('community_comments').delete().eq('id',id).eq('user_id',user.id);if(error)status(error.message);else await loadFeed();}
  function bindFeedActions(){
    $('communityFeed').querySelectorAll('[data-community-like]').forEach(b=>b.addEventListener('click',()=>toggleLike(b.dataset.communityLike)));
    $('communityFeed').querySelectorAll('[data-community-follow]').forEach(b=>b.addEventListener('click',()=>toggleFollow(b.dataset.communityFollow,b)));
    $('communityFeed').querySelectorAll('[data-community-block]').forEach(b=>b.addEventListener('click',()=>blockUser(b.dataset.communityBlock)));
    $('communityFeed').querySelectorAll('[data-community-delete-post]').forEach(b=>b.addEventListener('click',()=>deletePost(b.dataset.communityDeletePost)));
    $('communityFeed').querySelectorAll('[data-community-report]').forEach(b=>b.addEventListener('click',()=>reportPost(b.dataset.communityReport)));
    $('communityFeed').querySelectorAll('[data-community-delete-comment]').forEach(b=>b.addEventListener('click',()=>deleteComment(b.dataset.communityDeleteComment)));
    $('communityFeed').querySelectorAll('[data-community-comment-form]').forEach(form=>form.addEventListener('submit',e=>{e.preventDefault();const input=form.elements.body;addComment(form.dataset.communityCommentForm,input.value);}));
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
    if(select.value)await loadMessages();else $('communityChatMessages').innerHTML='<p class="muted small">Elegí un contacto para abrir la conversación.</p>';
  }
  async function loadMessages(){
    const target=$('communityChatContact')?.value,root=$('communityChatMessages');if(!root)return;
    if(!authReady()||!target){root.innerHTML='<p class="muted small">Elegí un contacto mutuo.</p>';return;}
    const {data,error}=await client.from('community_messages').select('id,sender_id,recipient_id,body,created_at').or(`and(sender_id.eq.${user.id},recipient_id.eq.${target}),and(sender_id.eq.${target},recipient_id.eq.${user.id})`).order('created_at',{ascending:true}).limit(200);
    if(error){root.innerHTML='<p class="muted small">No se pudo abrir el chat. Comprobá que ejecutaste la actualización v40 del esquema de Supabase.</p>';setStatus('communityChatStatus',error.message);return;}
    root.innerHTML=(data||[]).map(m=>`<div class="community-chat-message ${m.sender_id===user.id?'mine':''}">${esc(m.body)}<small>${m.sender_id===user.id?'Vos':'Contacto'} · ${esc(new Date(m.created_at).toLocaleString())}</small></div>`).join('')||'<p class="muted small">Todavía no hay mensajes. ¡Saludá!</p>';
    root.scrollTop=root.scrollHeight;
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
  async function searchUsers(e){e.preventDefault();searchTerm=$('communitySearch').value.trim();if(!client){status(authHint());return;}const root=$('communitySearchResults');root.innerHTML='';if(searchTerm){const term=searchTerm.replace(/^@/,'').replace(/[,%()]/g,'');const {data,error}=await client.rpc('search_community_profiles',{search_term:term});if(error){status(`No se pudo buscar: ${error.message}`);return;}if(!data?.length){status('No se encontraron perfiles públicos coincidentes.');searchTerm='';await loadFeed();return;}root.innerHTML=data.map(p=>`<article class="card"><div class="community-profile-top"><div class="community-avatar">${esc(initials(p.display_name))}</div><div style="flex:1;min-width:0"><strong>${esc(p.display_name)}</strong><div class="muted small">@${esc(p.username)}</div><p>${esc(p.bio||(p.visibility==='private'?'Perfil privado · su contenido requiere aprobación para verlo.':'Sin descripción todavía.'))}</p></div>${user&&user.id!==p.user_id?`<div class="btn-row"><button class="btn secondary" type="button" data-community-search-follow="${esc(p.user_id)}">${p.visibility==='private'?'Solicitar seguir':'Seguir'}</button><button class="btn ghost" type="button" data-community-search-block="${esc(p.user_id)}">Bloquear</button></div>`:''}</div></article>`).join('');root.querySelectorAll('[data-community-search-follow]').forEach(b=>b.addEventListener('click',()=>toggleFollow(b.dataset.communitySearchFollow,b)));root.querySelectorAll('[data-community-search-block]').forEach(b=>b.addEventListener('click',()=>blockUser(b.dataset.communitySearchBlock)));status(`Perfiles encontrados: ${data.length}. Los perfiles privados muestran solo datos básicos y requieren aprobación para ver su contenido.`);}await loadFeed();}
  async function emailLogin(e){e.preventDefault();if(!client)return setStatus('communityEmailStatus',authHint());const email=$('communityEmail').value.trim(),password=$('communityPassword').value;const {error}=await client.auth.signInWithPassword({email,password});if(error){setStatus('communityEmailStatus',`No se pudo iniciar sesión: ${error.message}`);return;}$('communityPassword').value='';setStatus('communityEmailStatus','Sesión iniciada.');}
  async function emailRegister(){if(!client)return setStatus('communityEmailStatus',authHint());const email=$('communityEmail').value.trim(),password=$('communityPassword').value;if(!email||password.length<8)return setStatus('communityEmailStatus','Ingresá un correo válido y una contraseña de al menos 8 caracteres.');const {data,error}=await client.auth.signUp({email,password});if(error){setStatus('communityEmailStatus',`No se pudo crear la cuenta: ${error.message}`);return;}if(data.session)setStatus('communityEmailStatus','Cuenta creada y sesión iniciada.');else setStatus('communityEmailStatus','Cuenta creada. Revisá tu correo para confirmar la dirección antes de iniciar sesión.');}
  async function googleLogin(){if(!client)return setStatus('communityProfileStatus',authHint());const {error}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:window.location.href.split('#')[0]}});if(error)setStatus('communityProfileStatus',`No se pudo iniciar con Google: ${error.message}`);}
  async function refresh(){if(!client){setControls();return;}if(user){try{await ensureProfile();await loadFollowRequests();}catch(e){setStatus('communityProfileStatus',`No se pudo preparar el perfil: ${e.message}`);}}setControls();await loadFeed();await loadChatContacts();await loadBlockedUsers();}
  function init(supabase,userSession){client=supabase||null;user=userSession||null;setControls();if(client)refresh();else loadFeed();}
  function setSession(supabase,userSession){client=supabase||client;user=userSession||null;if(!user){if($('communityDisplayName'))$('communityDisplayName').value='';if($('communityUsername'))$('communityUsername').value='';if($('communityBio'))$('communityBio').value='';if($('communityVisibility'))$('communityVisibility').value='private';if($('communityOwnName'))$('communityOwnName').textContent='Tu perfil';if($('communityOwnAvatar'))$('communityOwnAvatar').textContent='FF';if($('communityOwnStats'))$('communityOwnStats').textContent='0 publicaciones · 0 seguidores';if($('communityFollowRequests'))$('communityFollowRequests').textContent='Iniciá sesión para administrar solicitudes.';if($('communitySearchResults'))$('communitySearchResults').innerHTML='';if($('communityBlockedList'))$('communityBlockedList').textContent='Iniciá sesión para administrar los bloqueos.';}setControls();if(client)Promise.resolve().then(()=>refresh());else loadFeed();}
  function bind(){
    $('communityProfileForm')?.addEventListener('submit',saveProfile);$('communityPostForm')?.addEventListener('submit',createPost);$('communityRefresh')?.addEventListener('click',()=>loadFeed());$('communitySearchForm')?.addEventListener('submit',searchUsers);$('communityClearSearch')?.addEventListener('click',()=>{searchTerm='';$('communitySearch').value='';$('communitySearchResults').innerHTML='';loadFeed();});$('communityGoogleLogin')?.addEventListener('click',googleLogin);$('communityEmailAuthForm')?.addEventListener('submit',emailLogin);$('communityEmailRegister')?.addEventListener('click',emailRegister);$('communityChatContact')?.addEventListener('change',loadMessages);$('communityChatForm')?.addEventListener('submit',sendMessage);$('communityChatRefresh')?.addEventListener('click',loadChatContacts);$('communityChatDeleteConversation')?.addEventListener('click',deleteConversation);$('communityChatBlockContact')?.addEventListener('click',()=>blockUser($('communityChatContact')?.value));$('communitySignOut')?.addEventListener('click',async()=>{if(client){const {error}=await client.auth.signOut();if(error)setStatus('communityProfileStatus',error.message);}});
    const today=new Date().toISOString().slice(0,10);if($('communityEndDate'))$('communityEndDate').value=today;if($('communityStartDate'))$('communityStartDate').value=today;
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
  window.FittFormaCommunity={init,setSession,refresh,loadChatContacts,loadMessages,loadBlockedUsers};
})();
