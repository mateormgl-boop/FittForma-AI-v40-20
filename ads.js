/* FittForma AI v40.21 — Google Ad Manager web ads. Ads stay off until configured. */
(() => {
  const config = window.FittFormaAdsConfig || {};
  const DAILY_KEY = 'fittforma-ai-ad-usage-v1';
  const FREE_DAILY = 6, REWARD_CREDITS = 3, MAX_REWARDS_DAILY = 3;
  let gptPromise = null, rewardedSlot = null, rewardedReady = null, rewardGranted = false;
  // El contador diario sigue la fecha local del usuario; UTC adelantaba el día en Uruguay durante la noche.
  const dateKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const configured = () => Boolean(config.enabled && config.networkCode && config.rewardedSlot);
  const adsConfigured = () => Boolean(config.enabled && config.networkCode && Object.values(config.displaySlots || {}).some(Boolean));
  function usage(){
    let v={date:dateKey(),questions:0,credits:0,rewards:0};
    try{const raw=JSON.parse(localStorage.getItem(DAILY_KEY)||'null');if(raw&&raw.date===dateKey())v={...v,...raw};}catch{}
    return v;
  }
  function store(v){try{localStorage.setItem(DAILY_KEY,JSON.stringify(v));}catch{}}
  function loadGpt(){
    if(gptPromise)return gptPromise;
    gptPromise=new Promise((resolve,reject)=>{
      if(window.googletag&&window.googletag.apiReady){resolve(window.googletag);return;}
      window.googletag=window.googletag||{cmd:[]};
      const script=document.createElement('script');script.async=true;script.src='https://securepubads.g.doubleclick.net/tag/js/gpt.js';
      script.onload=()=>resolve(window.googletag);script.onerror=()=>reject(new Error('No se pudo cargar el servicio de anuncios.'));
      document.head.appendChild(script);
    });
    return gptPromise;
  }
  function initDisplay(){
    if(!adsConfigured())return;
    loadGpt().then(gpt=>gpt.cmd.push(()=>{
      const pubads=gpt.pubads();pubads.enableSingleRequest();pubads.collapseEmptyDivs();const displayIds=[];
      for(const [key,path] of Object.entries(config.displaySlots||{})){
        if(!path)continue;
        const id=key==='home'?'adContentHome':key==='nutrition'?'adContentNutrition':'';
        const outer=document.getElementById(key==='home'?'adSlotHome':'adSlotNutrition');if(!id||!document.getElementById(id)||!outer)continue;
        const slot=gpt.defineSlot(path,[[320,100],[300,250],[728,90]],id);if(!slot)continue;
        slot.addService(pubads);outer.classList.add('is-visible');displayIds.push(id);
      }
      gpt.enableServices();displayIds.forEach(id=>gpt.display(id));
    })).catch(()=>{});
  }
  function renderCoachUsage(){
    const text=document.getElementById('coachUsageText'),button=document.getElementById('watchRewardedAd');if(!text||!button)return;
    if(!configured()){
      text.textContent='Publicidad aún no configurada. El entrenador sigue disponible y no se muestran anuncios ficticios.';button.hidden=true;return;
    }
    const v=usage(),left=Math.max(0,FREE_DAILY-v.questions)+v.credits;
    text.textContent=left>0?`Consultas IA disponibles hoy: ${left}. Las consultas gratuitas se renuevan cada día.`:'Llegaste al límite de consultas gratuitas de hoy. Si querés, podés ver un anuncio voluntario para obtener 3 consultas más.';
    button.hidden=left>0||v.rewards>=MAX_REWARDS_DAILY;
    button.disabled=false;
    if(v.rewards>=MAX_REWARDS_DAILY&&left===0)text.textContent='Llegaste al límite diario de anuncios recompensados. Las consultas gratuitas se renuevan mañana.';
  }
  function canAskCoach(){if(!configured())return true;const v=usage();return v.questions<FREE_DAILY||v.credits>0;}
  function recordCoachSuccess(){if(!configured())return;const v=usage();if(v.questions<FREE_DAILY)v.questions++;else if(v.credits>0)v.credits--;store(v);renderCoachUsage();}
  async function showRewarded(){
    if(!configured()){renderCoachUsage();return false;}
    const v=usage();if(v.rewards>=MAX_REWARDS_DAILY){renderCoachUsage();return false;}
    const gpt=await loadGpt();
    return new Promise(resolve=>gpt.cmd.push(()=>{
      rewardGranted=false;rewardedReady=null;
      rewardedSlot=gpt.defineOutOfPageSlot(config.rewardedSlot,gpt.enums.OutOfPageFormat.REWARDED);
      if(!rewardedSlot){renderCoachUsage();resolve(false);return;}
      rewardedSlot.addService(gpt.pubads());
      const onReady=event=>{if(event.slot!==rewardedSlot)return;rewardedReady=event;const shown=event.makeRewardedVisible();if(!shown){cleanup();resolve(false);}};
      const onGranted=event=>{if(event.slot!==rewardedSlot)return;rewardGranted=true;const current=usage();current.credits+=REWARD_CREDITS;current.rewards++;store(current);renderCoachUsage();};
      const onClosed=event=>{if(event.slot!==rewardedSlot)return;cleanup();renderCoachUsage();resolve(rewardGranted);};
      const cleanup=()=>{gpt.pubads().removeEventListener('rewardedSlotReady',onReady);gpt.pubads().removeEventListener('rewardedSlotGranted',onGranted);gpt.pubads().removeEventListener('rewardedSlotClosed',onClosed);if(rewardedSlot){gpt.destroySlots([rewardedSlot]);rewardedSlot=null;}};
      gpt.pubads().addEventListener('rewardedSlotReady',onReady);gpt.pubads().addEventListener('rewardedSlotGranted',onGranted);gpt.pubads().addEventListener('rewardedSlotClosed',onClosed);
      gpt.display(rewardedSlot);
      window.setTimeout(()=>{if(!rewardedReady&&!rewardGranted){cleanup();renderCoachUsage();resolve(false);}},15000);
    }));
  }
  function init(){initDisplay();const button=document.getElementById('watchRewardedAd');if(button)button.addEventListener('click',async()=>{button.disabled=true;const ok=await showRewarded().catch(()=>false);if(ok&&window.toast)window.toast('¡Listo! Se agregaron 3 consultas IA.');else if(!ok&&window.toast)window.toast('No hay un anuncio disponible ahora. No se descontaron consultas.');button.disabled=false;renderCoachUsage();});renderCoachUsage();}
  window.FittFormaAds=Object.freeze({init,canAskCoach,recordCoachSuccess,renderCoachUsage,showRewarded});
})();
