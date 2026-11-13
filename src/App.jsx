import React, { useMemo, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as NativeApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { supabase } from './lib/supabase.js';

const STORAGE_KEY = 'petal_data_v1';
const isUuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value||''));
const PAWLY_WEB_URL = 'https://petal-ruby.vercel.app';
const PAWLY_NATIVE_REDIRECT = 'com.pawlypocket.app://login-callback/';
const isEmptyStarterPet = p => {
  const profile=p?.profile||{};
  const hasProfile=Object.entries(profile).some(([key,value])=>!['sex','sterilized'].includes(key)&&String(value??'').trim()!==''&&!(key==='name'&&value==='Minha pet'));
  return !hasProfile && !['vaccines','heat','health','reproduction','events','feeding','expenses'].some(key=>(p?.[key]||[]).length);
};
const blankPet = () => ({ id: crypto.randomUUID(), profile: { name: 'Minha pet', breed: '', birth: '', sex: 'Fêmea', weight: '', notes: '', photo: '', sterilized: 'Não', microchip: '' }, vaccines: [], heat: [], health: [], reproduction: [], events: [], feeding: [], expenses: [] });
const todayISO = () => new Date().toISOString().slice(0,10);
const addMonthsSafe = (value, months) => { const d=new Date(value+'T12:00:00'), day=d.getDate(); d.setDate(1); d.setMonth(d.getMonth()+months); d.setDate(Math.min(day,new Date(d.getFullYear(),d.getMonth()+1,0).getDate())); return d.toISOString().slice(0,10); };
const nextRecurringDate = x => { if(!x.repeatEnabled||!x.repeatEvery) return ''; let next=x.next||x.date||x.start; if(!next)return ''; let guard=0; while(next<todayISO()&&guard++<240) next=addMonthsSafe(next,Number(x.repeatEvery)||1); if(next===(x.next||x.date||x.start)&&next<=todayISO()) next=addMonthsSafe(next,Number(x.repeatEvery)||1); return next; };
const openFilesDb = () => new Promise((resolve,reject)=>{ if(!('indexedDB' in window)) return reject(new Error('IndexedDB indisponível')); const req=indexedDB.open('pawly-pocket-files',1); req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains('documents')){const os=db.createObjectStore('documents',{keyPath:'id'});os.createIndex('petId','petId');}};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error); });

function readStore() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (Array.isArray(raw.pets) && raw.pets.length) { const pets=raw.pets.map((p,i)=>({ ...blankPet(), ...p, id:p.id||'pet-'+(i+1), profile: { ...blankPet().profile, ...(p.profile || {}) } })); return { ...raw, pets, activePetId: pets.some(p=>p.id===raw.activePetId)?raw.activePetId:pets[0].id }; }
    if (raw.profile || raw.vaccines || raw.heat || raw.health) {
      const pet = { ...blankPet(), ...raw, id: raw.id || crypto.randomUUID() };
      return { pets: [pet], activePetId: pet.id };
    }
  } catch {}
  const pet = blankPet();
  return { pets: [pet], activePetId: pet.id };
}
const nav = [
  ['home','⌂','Visão geral'],['vaccines','♡','Vacinação'],['heat','◉','Controle de cio'],
  ['health','✚','Saúde e histórico'],['reproduction','♧','Reprodução'],['calendar','▦','Calendário'],
  ['pets','♧','Meus pets'],['timeline','◷','Linha do tempo'],['search','⌕','Buscar registros'],['reminders','♧','Central de lembretes'],['documents','▤','Documentos'],['dashboard','⚙','Painel e notificações'],['customize','◐','Personalizar'],['backup','⇧','Backup e dados']
];
const navGroups = [
  {id:'health',title:'Saúde',icon:'♡',items:[['vaccines','♡','Vacinação'],['heat','◉','Controle de cio'],['health','✚','Saúde e histórico']]},
  {id:'routine',title:'Rotina',icon:'▦',items:[['reproduction','♧','Reprodução'],['feeding','◒','Alimentação'],['calendar','▦','Calendário'],['reminders','♧','Central de lembretes']]},
  {id:'management',title:'Gestão',icon:'＄',items:[['expenses','＄','Despesas do pet']]},
  {id:'records',title:'Pets e histórico',icon:'◷',items:[['pets','♧','Meus pets'],['profile','♙','Perfil do pet'],['timeline','◷','Linha do tempo'],['search','⌕','Buscar registros'],['documents','▤','Documentos']]},
  {id:'settings',title:'Configurações',icon:'⚙',items:[['account','♙','Conta e nuvem'],['sharing','♧','Compartilhar pet'],['dashboard','⚙','Painel e notificações'],['customize','◐','Personalizar'],['backup','⇧','Backup e dados']] }
];
const date = value => value ? new Date(value + 'T12:00:00').toLocaleDateString('pt-BR') : '—';
const petAgeLabel = birth => { if(!birth)return 'Idade não informada'; const start=new Date(birth+'T12:00:00'),now=new Date(); if(Number.isNaN(start.getTime())||start>now)return 'Nascimento a conferir'; let years=now.getFullYear()-start.getFullYear(),months=now.getMonth()-start.getMonth(); if(now.getDate()<start.getDate())months--; if(months<0){years--;months+=12;} if(years>0)return years+' ano(s) e '+months+' mês(es)'; if(months>0)return months+' mês(es)'; return Math.max(0,Math.floor((now-start)/86400000))+' dia(s)'; };
const daysBetween = value => Math.floor((new Date().setHours(0,0,0,0) - new Date(value+'T12:00:00').getTime()) / 86400000);
const daysUntil = value => Math.ceil((new Date(value+'T12:00:00').getTime() - new Date().setHours(0,0,0,0)) / 86400000);
function Card({title, children, action}) { return <section className="panel"><div className="panel-head"><h3>{title}</h3>{action}</div>{children}</section>; }
function App() {
  const [store, setStore] = useState(readStore);
  const [page, setPage] = useState('home');
  const [menuOpen, setMenuOpen] = useState(false);
  const [openNavGroup, setOpenNavGroup] = useState('health');
  const [modal, setModal] = useState('');
  const [form, setForm] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [recordFilter, setRecordFilter] = useState('');
  const [calendarCursor, setCalendarCursor] = useState(() => new Date(new Date().getFullYear(),new Date().getMonth(),1));
  const [documents, setDocuments] = useState([]);
  const [dashboardPrefs, setDashboardPrefs] = useState(() => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}').settings?.dashboard || {}; } catch { return {}; } });
  const [dark, setDark] = useState(localStorage.getItem('pawly_theme') === 'dark');
  const [nativeNotificationsEnabled, setNativeNotificationsEnabled] = useState(localStorage.getItem('pawly_native_notifications') === '1');
  const [notificationPrefs, setNotificationPrefs] = useState(() => { try { return { sound: true, vibration: true, ...(JSON.parse(localStorage.getItem('pawly_notification_prefs') || '{}')) }; } catch { return { sound: true, vibration: true }; } });
  const [cameraBusy, setCameraBusy] = useState(false);
  const [updateBusy, setUpdateBusy] = useState(false);
  const [updateStatus, setUpdateStatus] = useState('');
  const [updateVersion, setUpdateVersion] = useState('');
  const [session, setSession] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authConfirmPassword, setAuthConfirmPassword] = useState('');
  const [authFullName, setAuthFullName] = useState('');
  const [authNewPassword, setAuthNewPassword] = useState('');
  const [authMode, setAuthMode] = useState('login');
  const [authBusy, setAuthBusy] = useState(false);
  const [authStatus, setAuthStatus] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [shareMembers, setShareMembers] = useState([]);
  const [shareInvites, setShareInvites] = useState([]);
  const [shareStatus, setShareStatus] = useState('');
  const [cloudReady, setCloudReady] = useState(false);
  const cloudVersions = React.useRef({});
  const authEventSeen = React.useRef(false);
  const [pendingInvite, setPendingInvite] = useState(() => new URLSearchParams(window.location.search).get('invite') || '');

  // Android system back gesture: close overlays first, then return to the overview.
  React.useEffect(()=>{
    if(!Capacitor.isNativePlatform())return;
    let listener;
    NativeApp.addListener('backButton',({canGoBack})=>{
      if(modal){setModal('');return;}
      if(menuOpen){setMenuOpen(false);return;}
      if(page!=='home'){setPage('home');return;}
      if(canGoBack){window.history.back();return;}
      NativeApp.exitApp();
    }).then(handle=>{listener=handle;}).catch(error=>console.warn('Não foi possível ativar o gesto Voltar do Android.',error));
    return ()=>{listener?.remove();};
  },[modal,menuOpen,page]);

  React.useEffect(()=>{
    if(!Capacitor.isNativePlatform())return;
    CapacitorUpdater.notifyAppReady().catch(error=>console.warn('Updater ainda não está pronto.',error));
  },[]);
  React.useEffect(()=>{
    let active=true;
    supabase.auth.getSession().then(({data,error})=>{
      if(!active)return;
      if(error)setAuthStatus('Não foi possível recuperar a sessão.');
      if(!authEventSeen.current)setSession(data?.session||null);
      setSessionLoading(false);
    }).catch(()=>setSessionLoading(false));
    const {data:{subscription}}=supabase.auth.onAuthStateChange((event,nextSession)=>{
      authEventSeen.current=true;
      setSession(nextSession||null);
      setSessionLoading(false);
      setAuthBusy(false);
      if(event==='PASSWORD_RECOVERY'){
        setAuthMode('reset');
        setAuthStatus('Defina sua nova senha para recuperar o acesso.');
      } else if(event==='SIGNED_IN') {
        setAuthMode(current=>current==='reset'?'reset':'login');
      }
      if(!nextSession)setCloudReady(false);
    });
    return ()=>{active=false;subscription.unsubscribe();};
  },[]);

  React.useEffect(()=>{
    if(!Capacitor.isNativePlatform())return;
    let listener, stateListener;
    const handledUrls=new Set();
    const handleAuthUrl=async url=>{
      if(!url||handledUrls.has(url))return;
      handledUrls.add(url);
      try{
        const callback=new URL(url);
        const invite=callback.searchParams.get('invite');
        if(invite)setPendingInvite(invite);
        const code=callback.searchParams.get('code');
        const tokenHash=callback.searchParams.get('token_hash');
        if(code){setAuthStatus('Finalizando autenticação...');const {error}=await supabase.auth.exchangeCodeForSession(code);if(error)throw error;setAuthBusy(false);setAuthStatus('Acesso confirmado. Bem-vindo ao Pawly!');}
        else if(tokenHash){const type=callback.searchParams.get('type')||'signup';const {error}=await supabase.auth.verifyOtp({token_hash:tokenHash,type});if(error)throw error;setAuthBusy(false);setAuthStatus('E-mail confirmado com sucesso.');}
        else if(callback.hash){const params=new URLSearchParams(callback.hash.slice(1));const access_token=params.get('access_token'),refresh_token=params.get('refresh_token');if(access_token&&refresh_token){const {error}=await supabase.auth.setSession({access_token,refresh_token});if(error)throw error;}}
        await Browser.close().catch(()=>{});
      }catch(error){setAuthBusy(false);setAuthStatus(error?.message||'Não foi possível concluir o retorno de autenticação.');await Browser.close().catch(()=>{});}
    };
    NativeApp.addListener('appStateChange',({isActive})=>{if(isActive)setAuthBusy(false);}).then(handle=>{stateListener=handle;}).catch(()=>{});
    NativeApp.addListener('appUrlOpen',({url})=>handleAuthUrl(url)).then(handle=>{listener=handle;}).catch(error=>console.warn('Falha ao registrar retorno de autenticação:',error));
    NativeApp.getLaunchUrl().then(launch=>{if(launch?.url)handleAuthUrl(launch.url);}).catch(()=>{});
    return ()=>{listener?.remove();stateListener?.remove();};
  },[]);

  React.useEffect(()=>{
    if(!session?.user?.id){setCloudReady(false);return;}
    let active=true;
    (async()=>{
      setCloudReady(false);
      cloudVersions.current={};
      setAuthStatus('Preparando sua conta e sincronizando os pets...');
      try{
        const user=session.user;
        const raw=localStorage.getItem(STORAGE_KEY);
        const migrationKey='pawly_cloud_migrated_'+user.id;
        if(raw && !localStorage.getItem(migrationKey)){
          const local=JSON.parse(raw);
          const localPets=Array.isArray(local.pets)?local.pets:[];
          const owned=localPets.filter(p=>(!p._cloudOwnerId||p._cloudOwnerId===user.id)&&!isEmptyStarterPet(p));
          const payload=owned.map(p=>{
            const id=isUuid(p.id)?p.id:crypto.randomUUID();
            const data={...p,id};delete data._cloudOwnerId;delete data._sharedRole;
            return {id,user_id:user.id,name:data.profile?.name||'Minha pet',data,updated_at:new Date().toISOString()};
          });
          if(payload.length){
            const {error}=await supabase.from('pets').upsert(payload,{onConflict:'id'});
            if(error)throw error;
          }
          localStorage.setItem(migrationKey,'1');
        }
        const inviteToAccept=pendingInvite;
        if(inviteToAccept){
          const {error}=await supabase.rpc('accept_pet_invitation',{p_token:inviteToAccept});
          if(error)throw error;
          const cleanUrl=new URL(window.location.href);cleanUrl.searchParams.delete('invite');
          window.history.replaceState({},'',cleanUrl.toString());
        }
        const {data,error}=await supabase.from('pets').select('id,user_id,name,data,updated_at').order('updated_at',{ascending:false});
        if(error)throw error;
        if(!active)return;
        const current=readStore();
        cloudVersions.current=Object.fromEntries((data||[]).map(row=>[row.id,row.updated_at]));
        if(data?.length){
          const pets=data.map(row=>({
            ...blankPet(),...(row.data&&typeof row.data==='object'?row.data:{}),id:row.id,
            profile:{...blankPet().profile,...(row.data?.profile||{})},
            _cloudOwnerId:row.user_id,_sharedRole:row.user_id===user.id?'owner':'editor'
          }));
          const next={...current,pets,activePetId:pets.some(p=>p.id===current.activePetId)?current.activePetId:pets[0].id};
          localStorage.setItem(STORAGE_KEY,JSON.stringify(next));
          setStore(next);
        }else if(current.pets.some(p=>p._cloudOwnerId && p._cloudOwnerId!==user.id)){
          const fresh={pets:[blankPet()],activePetId:null};
          fresh.activePetId=fresh.pets[0].id;
          localStorage.setItem(STORAGE_KEY,JSON.stringify(fresh));
          setStore(fresh);
        }
        setCloudReady(true);
        setAuthStatus(inviteToAccept?'Convite aceito! Pet compartilhado sincronizado.':data?.length?'Conta conectada. Seus pets estão sincronizados.':'Conta conectada. Cadastre seu primeiro pet ou aceite um convite para começar.');
        if(inviteToAccept)setPendingInvite('');
      }catch(error){
        console.error('Falha na sincronização Pawly:',error);
        if(active)setAuthStatus(error?.message||'Não foi possível sincronizar. Confira sua conexão e tente novamente.');
      }
    })();
    return ()=>{active=false;};
  },[session?.user?.id,pendingInvite]);

  React.useEffect(()=>{
    if(!session?.user?.id||!cloudReady)return;
    let cancelled=false;
    (async()=>{
      for(const p of store.pets){
        if(cancelled)return;
        if(isEmptyStarterPet(p))continue;
        const data={...p};delete data._cloudOwnerId;delete data._sharedRole;delete data._cloudUpdatedAt;
        if(p._cloudOwnerId && p._cloudOwnerId!==session.user.id){
          const {error}=await supabase.from('pets').update({name:data.profile?.name||'Minha pet',data,updated_at:new Date().toISOString()}).eq('id',p.id);
          if(error)console.warn('Não foi possível sincronizar pet compartilhado:',error);
        }else{
          const {error}=await supabase.from('pets').upsert({id:p.id,user_id:session.user.id,name:data.profile?.name||'Minha pet',data,updated_at:new Date().toISOString()},{onConflict:'id'});
          if(error)console.warn('Não foi possível sincronizar pet:',error);
        }
      }
    })();
    return ()=>{cancelled=true;};
  },[store,session?.user?.id,cloudReady]);


  React.useEffect(()=>{
    if(!session?.user?.id||!cloudReady)return;
    const refreshSharedPets=async()=>{
      const {data,error}=await supabase.from('pets').select('id,user_id,name,data,updated_at').order('updated_at',{ascending:false});
      if(error||!data)return;
      setStore(current=>{
        const currentById=new Map(current.pets.map(p=>[p.id,p]));
        let changed=false;
        const pets=data.map(row=>{
          const local=currentById.get(row.id);
          const remoteData=row.data&&typeof row.data==='object'?row.data:{};
          const localData=local?{...local}:null;
          if(localData){delete localData._cloudOwnerId;delete localData._sharedRole;delete localData._cloudUpdatedAt;}
          const same=local&&JSON.stringify(localData)===JSON.stringify(remoteData);
          cloudVersions.current[row.id]=row.updated_at;
          if(same)return local;
          changed=true;
          return {
            ...blankPet(),...remoteData,id:row.id,
            profile:{...blankPet().profile,...(remoteData.profile||{})},
            _cloudOwnerId:row.user_id,_sharedRole:row.user_id===session.user.id?'owner':'editor'
          };
        });
        if(current.pets.some(p=>p._cloudOwnerId&&!data.some(row=>row.id===p.id)))changed=true;
        if(!changed)return current;
        const next={...current,pets,activePetId:pets.some(p=>p.id===current.activePetId)?current.activePetId:(pets[0]?.id||null)};
        if(!pets.length){const fresh=blankPet();next.pets=[fresh];next.activePetId=fresh.id;}
        localStorage.setItem(STORAGE_KEY,JSON.stringify(next));
        return next;
      });
    };
    const channel=supabase.channel('pawly-pets-'+session.user.id)
      .on('postgres_changes',{event:'*',schema:'public',table:'pets'},refreshSharedPets)
      .subscribe();
    return ()=>{supabase.removeChannel(channel);};
  },[session?.user?.id,cloudReady]);
  const pet = store.pets.find(p => p.id === store.activePetId) || store.pets[0];
  React.useEffect(()=>{
    if(page!=='sharing'||!session?.user?.id||!pet?.id)return;
    let active=true;
    (async()=>{
      setShareStatus('Carregando compartilhamentos...');
      const [membersResult,invitesResult]=await Promise.all([
        supabase.from('pet_members').select('user_id,role,created_at').eq('pet_id',pet.id),
        supabase.from('pet_invitations').select('id,invited_email,expires_at,accepted_at').eq('pet_id',pet.id).is('accepted_at',null)
      ]);
      if(!active)return;
      if(membersResult.error||invitesResult.error){setShareStatus('Não foi possível carregar os acessos.');return;}
      const members=membersResult.data||[];
      let profiles=[];
      if(members.length){
        const profileResult=await supabase.from('profiles').select('id,email,full_name,avatar_url').in('id',members.map(m=>m.user_id));
        if(!profileResult.error)profiles=profileResult.data||[];
      }
      setShareMembers(members.map(m=>({...m,profile:profiles.find(p=>p.id===m.user_id)||null})));
      setShareInvites(invitesResult.data||[]);setShareStatus('');
    })();
    return ()=>{active=false;};
  },[page,pet?.id,session?.user?.id]);

  React.useEffect(()=>{
    if(!Capacitor.isNativePlatform())return;
    let listener;
    NativeApp.addListener('appRestoredResult',result=>{
      if(result.pluginId!=='Camera'||result.methodName!=='getPhoto'||!result.success)return;
      const photo=result.data?.dataUrl || result.data?.webPath || (result.data?.base64String ? 'data:image/'+(result.data.format||'jpeg')+';base64,'+result.data.base64String : '');
      if(!photo)return;
      const current=readStore(),active=current.pets.find(p=>p.id===current.activePetId)||current.pets[0];
      if(!active)return;
      setStore(current);
      setForm({...active.profile,_petId:active.id,photo});
      setModal('pet');
      alert('Foto recuperada. Confira e salve o perfil do pet.');
    }).then(handle=>{listener=handle;}).catch(error=>console.warn('Não foi possível registrar a recuperação da câmera.',error));
    return ()=>{listener?.remove();};
  },[]);
  const [accent, setAccent] = useState(localStorage.getItem('pawly_theme_primary') || '#668875');
  React.useEffect(()=>{document.documentElement.style.setProperty('--green',accent);document.documentElement.style.setProperty('--green-dark',accent);},[accent]);
  const profile = pet.profile || {};
  const updatePet = updater => setStore(current => {
    const next = { ...current, pets: current.pets.map(p => p.id === pet.id ? updater(p) : p) };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  });
  const heat = [...(pet.heat || [])].filter(x => x.start).sort((a,b) => b.start.localeCompare(a.start));
  const lastHeat = heat[0];
  const elapsed = lastHeat ? Math.max(0, daysBetween(lastHeat.start)) : null;
  const orderedHeat = [...(pet.heat || [])].filter(x => x.start).sort((a,b) => a.start.localeCompare(b.start));
  const intervals = orderedHeat.slice(1).map((x,i) => Math.round((new Date(x.start+'T12:00:00') - new Date(orderedHeat[i].start+'T12:00:00')) / 86400000)).filter(n => n >= 90 && n <= 500);
  const interval = intervals.length ? Math.round(intervals.reduce((a,b)=>a+b,0)/intervals.length) : Math.min(500,Math.max(90,Number(pet.heatIntervalDays)||180));
  const nextHeat = lastHeat ? new Date(new Date(lastHeat.start+'T12:00:00').getTime() + interval*86400000) : null;
  const remaining = nextHeat ? Math.ceil((nextHeat.getTime() - new Date().setHours(0,0,0,0))/86400000) : null;
  const upcoming = useMemo(() => {
    const recurring = (arr, label) => arr.map(x => ({...x, title:x.title||x.name||x.type||label, date:x.repeatEnabled ? nextRecurringDate(x) : (x.next||x.date||x.start), type:label}));
    return [...recurring(pet.vaccines||[],'Vacina'), ...recurring((pet.health||[]).filter(x=>x.repeatEnabled),'Saúde'), ...recurring(pet.events||[],'Compromisso'), ...recurring((pet.heat||[]).filter(x=>x.repeatEnabled),'Cio'), ...recurring((pet.reproduction||[]).filter(x=>x.repeatEnabled),'Reprodução')]
      .filter(x=>x.date && daysUntil(x.date)<=30).sort((a,b)=>a.date.localeCompare(b.date));
  }, [pet]);
  React.useEffect(()=>{
    if(Capacitor.isNativePlatform() || !('Notification' in window) || Notification.permission!=='granted') return;
    const due=upcoming.filter(x=>daysUntil(x.date)<=1);
    const stamp=todayISO()+'-'+pet.id;
    if(!due.length || localStorage.getItem('pawly_notified_'+stamp)) return;
    new Notification('Pawly Pocket · lembrete',{body:due.slice(0,3).map(x=>(x.title||x.name||x.type)+' — '+(daysUntil(x.date)===0?'hoje':daysUntil(x.date)<0?'atrasado':'amanhã')).join('\n')});
    localStorage.setItem('pawly_notified_'+stamp,'1');
  },[upcoming,pet.id]);
  const notificationChannelId = 'pawly-reminders-'+(notificationPrefs.sound?'sound':'silent')+'-'+(notificationPrefs.vibration?'vibrate':'quiet')+'-v2';
  const saveNotificationPrefs = next => { setNotificationPrefs(next); localStorage.setItem('pawly_notification_prefs',JSON.stringify(next)); };
  const previewPawlySound = () => {
    try {
      const audio = new Audio('/sounds/pawly-bark.wav');
      audio.volume = 0.72;
      audio.play().catch(() => alert('Não foi possível reproduzir o latido neste aparelho.'));
    } catch { alert('Não foi possível reproduzir o latido neste aparelho.'); }
  };
  const checkForUpdates = async () => {
    if(updateBusy)return;
    setUpdateBusy(true);
    setUpdateStatus('Consultando atualizações...');
    try {
      if(!Capacitor.isNativePlatform()) {
        window.open('https://github.com/Rubertt12/pawly-pocket/releases/latest','_blank','noopener,noreferrer');
        setUpdateStatus('As atualizações instaláveis estão disponíveis no GitHub Releases.');
        return;
      }
      const response=await fetch('https://api.github.com/repos/Rubertt12/pawly-pocket/releases/latest',{headers:{Accept:'application/vnd.github+json'}});
      if(!response.ok)throw new Error('Não foi possível consultar as versões publicadas.');
      const release=await response.json();
      const asset=(release.assets||[]).find(x=>x.name==='pawly-pocket-ota.zip');
      if(!asset)throw new Error('A versão mais recente ainda não possui o pacote de atualização.');
      const current=await CapacitorUpdater.current();
      const target=String(release.tag_name||'');
      setUpdateVersion(target);
      if(current.version===target || current.version===target.replace(/^ota-/,'') || current.version===release.name) {
        setUpdateStatus('O Pawly Pocket já está atualizado.');
        return;
      }
      setUpdateStatus('Baixando '+target+'...');
      const bundle=await CapacitorUpdater.download({url:asset.browser_download_url,version:target});
      setUpdateStatus('Atualização baixada. Aplicando agora...');
      await CapacitorUpdater.set({id:bundle.id});
    } catch(error) {
      console.error('Falha ao atualizar Pawly Pocket',error);
      setUpdateStatus(error?.message||'Não foi possível atualizar. Tente novamente.');
    } finally { setUpdateBusy(false); }
  };
  const testNotification = async () => {
    try {
      if(!Capacitor.isNativePlatform()) {
        if(!('Notification' in window)){alert('Notificações não são suportadas neste navegador.');return;}
        if(Notification.permission!=='granted'){const p=await Notification.requestPermission();if(p!=='granted')return;}
        new Notification('Pawly Pocket · teste',{body:'Tudo certo! Seus lembretes estão configurados.'});
        return;
      }
      let permission=await LocalNotifications.checkPermissions();
      if(permission.display!=='granted')permission=await LocalNotifications.requestPermissions();
      if(permission.display!=='granted'){alert('Permissão de notificações não concedida.');return;}
      if(Capacitor.getPlatform()==='android') await LocalNotifications.createChannel({id:notificationChannelId,name:'Lembretes Pawly',description:'Cuidados e compromissos dos pets',importance:5,visibility:1,sound:notificationPrefs.sound?(Capacitor.getPlatform()==='android'?'pawly_bark.wav':'default'):undefined,vibration:notificationPrefs.vibration});
      await LocalNotifications.schedule({notifications:[{id:987654,title:'Pawly Pocket · teste',body:'Tudo certo! Seus lembretes estão configurados.',schedule:{at:new Date(Date.now()+4000)},channelId:notificationChannelId,sound:notificationPrefs.sound?(Capacitor.getPlatform()==='android'?'pawly_bark.wav':'default'):undefined}]});
      alert('Aviso de teste agendado para daqui a 4 segundos.');
    } catch(error) { console.warn(error);alert('Não foi possível enviar o aviso de teste. Confira as permissões do aparelho.'); }
  };
  React.useEffect(()=>{
    if(!Capacitor.isNativePlatform() || !nativeNotificationsEnabled) return;
    let cancelled=false;
    (async()=>{
      try {
        const permission=await LocalNotifications.checkPermissions();
        if(permission.display!=='granted') return;
        if(Capacitor.getPlatform()==='android') await LocalNotifications.createChannel({id:notificationChannelId,name:'Lembretes Pawly',description:'Cuidados e compromissos dos pets',importance:5,visibility:1,sound:notificationPrefs.sound?(Capacitor.getPlatform()==='android'?'pawly_bark.wav':'default'):undefined,vibration:notificationPrefs.vibration});
        await LocalNotifications.cancelAll();
        const due=upcoming.filter(x=>daysUntil(x.date)>=-1 && daysUntil(x.date)<=30);
        if(!due.length || cancelled) return;
        const notifications=due.map(x=>{
          let hash=0; for(const ch of String(x.id||x.title)) hash=((hash<<5)-hash)+ch.charCodeAt(0),hash|=0;
          const at=new Date(x.date+'T09:00:00');
          if(at.getTime()<=Date.now()) at.setTime(Date.now()+60000);
          return {id:Math.abs(hash)||1,title:'Pawly Pocket · '+(x.type||'Lembrete'),body:x.title||x.name||'Cuidado agendado',schedule:{at},channelId:notificationChannelId,sound:notificationPrefs.sound?(Capacitor.getPlatform()==='android'?'pawly_bark.wav':'default'):undefined};
        });
        await LocalNotifications.schedule({notifications});
      } catch(error) { console.warn('Não foi possível atualizar os lembretes nativos.',error); }
    })();
    return ()=>{cancelled=true;};
  },[upcoming,pet.id,nativeNotificationsEnabled,notificationChannelId,notificationPrefs.sound,notificationPrefs.vibration]);

  const getAuthRedirect = () => {
    const base=Capacitor.isNativePlatform()?PAWLY_NATIVE_REDIRECT:(window.location.origin+'/');
    const params=new URLSearchParams();
    if(pendingInvite)params.set('invite',pendingInvite);
    return base+(params.size?'?'+params.toString():'');
  };
  const signInWithGoogle = async () => {
    try{
      setAuthBusy(true);setAuthStatus('Conectando com o Google...');
      const {data,error}=await supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo:getAuthRedirect(),skipBrowserRedirect:Capacitor.isNativePlatform(),queryParams:{prompt:'select_account'}}});
      if(error)throw error;
      if(Capacitor.isNativePlatform()){
        if(!data?.url)throw new Error('O Google não retornou o endereço de autenticação.');
        await Browser.open({url:data.url,presentationStyle:'fullscreen'});
      }
    }catch(error){setAuthStatus(error?.message||'Não foi possível iniciar o login Google.');setAuthBusy(false);}
  };
  const signInWithEmail = async e => {
    e.preventDefault();if(authBusy)return;
    try{
      setAuthBusy(true);setAuthStatus('Entrando...');
      const {error}=await supabase.auth.signInWithPassword({email:authEmail.trim(),password:authPassword});
      if(error)throw error;
      setAuthStatus('Login realizado.');
    }catch(error){setAuthStatus(error?.message||'Não foi possível entrar.');}
    finally{setAuthBusy(false);}
  };
  const signUpWithEmail = async e => {
    e?.preventDefault();if(authBusy)return;
    if(authPassword.length<8){setAuthStatus('Use uma senha com pelo menos 8 caracteres.');return;}
    if(authPassword!==authConfirmPassword){setAuthStatus('As senhas não conferem.');return;}
    try{
      setAuthBusy(true);setAuthStatus('Criando sua conta...');
      const {data,error}=await supabase.auth.signUp({email:authEmail.trim().toLowerCase(),password:authPassword,options:{emailRedirectTo:getAuthRedirect(),data:{full_name:authFullName.trim(),name:authFullName.trim()}}});
      if(error)throw error;
      setAuthStatus(data.session?'Conta criada e conectada.':'Conta criada. Enviamos um link de confirmação para seu e-mail. Abra o link para ativar a conta.');
    }catch(error){setAuthStatus(error?.message||'Não foi possível criar a conta.');}
    finally{setAuthBusy(false);}
  };
  const resendSignupConfirmation = async () => {
    if(!authEmail.trim()){setAuthStatus('Informe seu e-mail para reenviar a confirmação.');return;}
    try{setAuthBusy(true);setAuthStatus('Reenviando confirmação...');const {error}=await supabase.auth.resend({type:'signup',email:authEmail.trim().toLowerCase(),options:{emailRedirectTo:getAuthRedirect()}});if(error)throw error;setAuthStatus('Novo e-mail de confirmação enviado. Confira também o spam.');}
    catch(error){setAuthStatus(error?.message||'Não foi possível reenviar o e-mail.');}
    finally{setAuthBusy(false);}
  };
  const requestPasswordReset = async e => {
    e?.preventDefault();if(!authEmail.trim()){setAuthStatus('Informe o e-mail da sua conta.');return;}
    try{setAuthBusy(true);setAuthStatus('Enviando link para redefinir sua senha...');const {error}=await supabase.auth.resetPasswordForEmail(authEmail.trim().toLowerCase(),{redirectTo:getAuthRedirect()});if(error)throw error;setAuthStatus('Se a conta existir, você receberá um link para criar uma nova senha.');}
    catch(error){setAuthStatus(error?.message||'Não foi possível solicitar a redefinição.');}
    finally{setAuthBusy(false);}
  };
  const saveRecoveredPassword = async e => {
    e?.preventDefault();if(authNewPassword.length<8){setAuthStatus('Use uma senha com pelo menos 8 caracteres.');return;}
    try{setAuthBusy(true);const {error}=await supabase.auth.updateUser({password:authNewPassword});if(error)throw error;setAuthNewPassword('');setAuthMode('login');setAuthStatus('Senha alterada com sucesso. Sua conta está pronta.');}
    catch(error){setAuthStatus(error?.message||'Não foi possível alterar a senha. Abra novamente o link de recuperação.');}
    finally{setAuthBusy(false);}
  };
  const signOutAccount = async () => {
    const {error}=await supabase.auth.signOut();
    if(error){setAuthStatus(error.message);return;}
    setSession(null);setCloudReady(false);setPage('home');setMenuOpen(false);setModal('');
    const fresh=blankPet();setStore({pets:[fresh],activePetId:fresh.id});
    setAuthStatus('Você saiu da conta. Os dados da conta não ficam visíveis nesta sessão; seus registros continuam salvos na nuvem.');
  };
  const createPetInvite = async e => {
    e.preventDefault();
    if(!session?.user?.id||!pet?.id)return;
    const email=inviteEmail.trim().toLowerCase();
    if(!email||email===session.user.email?.toLowerCase()){setShareStatus('Informe o e-mail de outra pessoa.');return;}
    try{
      setShareStatus('Criando convite...');
      const token=crypto.randomUUID();
      const {error}=await supabase.from('pet_invitations').insert({pet_id:pet.id,invited_email:email,token,invited_by:session.user.id});
      if(error)throw error;
      const link=PAWLY_WEB_URL+'/?invite='+encodeURIComponent(token);
      let shared=false;
      if(navigator.share){try{await navigator.share({title:'Convite Pawly Pocket',text:'Você foi convidado para acompanhar um pet comigo no Pawly Pocket.',url:link});shared=true;}catch{}}
      if(!shared){try{await navigator.clipboard.writeText(link);setShareStatus('Convite criado e link copiado. Envie para '+email+'.');}catch{setShareStatus('Convite criado. Copie este link: '+link);}}else setShareStatus('Convite criado e compartilhado. A pessoa deve entrar com '+email+'.');
      setInviteEmail('');
      const {data}=await supabase.from('pet_invitations').select('id,invited_email,expires_at,accepted_at').eq('pet_id',pet.id).is('accepted_at',null);
      setShareInvites(data||[]);
    }catch(error){setShareStatus(error?.message||'Não foi possível criar o convite.');}
  };
  const removePetMember = async userId => {
    if(!confirm('Remover o acesso desta conta ao pet?'))return;
    const {error}=await supabase.from('pet_members').delete().eq('pet_id',pet.id).eq('user_id',userId);
    if(error){setShareStatus(error.message);return;}
    setShareMembers(current=>current.filter(x=>x.user_id!==userId));
    setShareStatus('Acesso removido.');
  };
  const revokePetInvite = async inviteId => {
    const {error}=await supabase.from('pet_invitations').delete().eq('id',inviteId);
    if(error){setShareStatus(error.message);return;}
    setShareInvites(current=>current.filter(x=>x.id!==inviteId));
    setShareStatus('Convite cancelado.');
  };
  const openForm = (type, existing={}) => { setForm({...existing,date:existing.date||new Date().toISOString().slice(0,10)}); setModal(type); };
  const allRecords = (source=pet) => {
    const groups=[['Vacina',source.vaccines||[],x=>x.name||'Vacina',x=>x.date||x.next],['Cio',source.heat||[],x=>'Ciclo de cio',x=>x.start],['Saúde',source.health||[],x=>x.title||x.type||'Registro de saúde',x=>x.date],['Reprodução',source.reproduction||[],x=>x.type||'Evento reprodutivo',x=>x.date],['Compromisso',source.events||[],x=>x.title||x.type||'Compromisso',x=>x.date],['Alimentação',source.feeding||[],x=>x.food||x.type||'Alimentação',x=>x.date],['Despesa',source.expenses||[],x=>x.description||x.category||'Despesa',x=>x.date]];
    return groups.flatMap(([category,arr,label,getDate])=>arr.map(x=>({id:x.id,category,title:label(x),date:getDate(x),notes:x.notes||'',petName:source.profile?.name||'Pet',petId:source.id}))).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  };
  const openPetForm = (target=pet) => { setForm({...target.profile, _petId:target.id}); setModal('pet'); };
  const choosePetPhoto = async source => {
    if(!Capacitor.isNativePlatform()) {
      document.getElementById('pet-photo-file')?.click();
      return;
    }
    try {
      setCameraBusy(true);
      const result = await Camera.getPhoto({
        quality:82,
        width:1280,
        height:1280,
        correctOrientation:true,
        resultType:CameraResultType.DataUrl,
        source:source==='camera'?CameraSource.Camera:CameraSource.Photos
      });
      const photo=result.dataUrl || result.webPath;
      if(!photo)throw new Error('A imagem não foi retornada pelo dispositivo.');
      setForm(f=>({...f,photo}));
    } catch(error) {
      console.warn('Não foi possível selecionar a foto do pet.',error);
      if(error?.message&&!/cancel/i.test(error.message))alert('Não foi possível acessar a câmera ou galeria. Verifique as permissões do aplicativo.');
    } finally { setCameraBusy(false); }
  };
  const loadDocuments = async () => { try { const dbi=await openFilesDb(); const all=await new Promise((resolve,reject)=>{const req=dbi.transaction('documents','readonly').objectStore('documents').getAll();req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error);}); setDocuments(all.filter(x=>x.petId===pet.id).sort((a,b)=>(b.date||'').localeCompare(a.date||''))); } catch { setDocuments([]); } };
  React.useEffect(()=>{ if(page==='documents') loadDocuments(); },[page,pet.id]);
  const saveForm = e => {
    e.preventDefault();
    if(modal==='pet'){
      const { _petId, ...profileData }=form;
      if(_petId){ setStore(s=>{const next={...s,pets:s.pets.map(x=>x.id===_petId?{...x,profile:{...x.profile,...profileData}}:x)};localStorage.setItem(STORAGE_KEY,JSON.stringify(next));return next;}); }
      else { const np={...blankPet(),profile:{...blankPet().profile,...profileData}}; setStore(s=>{const next={...s,pets:[...s.pets,np],activePetId:np.id};localStorage.setItem(STORAGE_KEY,JSON.stringify(next));return next;}); }
      setModal(''); return;
    }
    const entry = { ...form, id: form.id || crypto.randomUUID() };
    const key = modal === 'heat' ? 'heat' : modal === 'vaccine' ? 'vaccines' : modal === 'health' ? 'health' : modal === 'event' ? 'events' : modal === 'food' ? 'feeding' : modal === 'expense' ? 'expenses' : 'reproduction';
    updatePet(p => ({ ...p, [key]: form.id ? (p[key]||[]).map(x=>x.id===form.id?entry:x) : [...(p[key]||[]), entry] }));
    setModal('');
  };
  const changePage = key => {
    setPage(key);
    const group = navGroups.find(g=>g.items.some(item=>item[0]===key));
    if(group) setOpenNavGroup(group.id);
    setMenuOpen(false);
  };
  const toggleDark = () => setDark(v => { localStorage.setItem('pawly_theme', v ? 'light' : 'dark'); return !v; });
  const addPet = () => { setForm({...blankPet().profile,_petId:null}); setModal('pet'); };
  const blobToDataUrl = blob => new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);});
  const exportData = async () => {
    try {
      const dbi=await openFilesDb();
      const allDocs=await new Promise((resolve,reject)=>{const req=dbi.transaction('documents','readonly').objectStore('documents').getAll();req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error);});
      const documents=await Promise.all(allDocs.map(async d=>({...d,blob:undefined,blobData:d.blob?await blobToDataUrl(d.blob):null})));
      const payload={format:'pawly-pocket-backup',version:2,createdAt:new Date().toISOString(),preferences:{theme:localStorage.getItem('pawly_theme')||'light',accent:localStorage.getItem('pawly_theme_primary')||'#668875'},data:store,documents};
      const blob=new Blob([JSON.stringify(payload)],{type:'application/json'});
      const url=URL.createObjectURL(blob),a=document.createElement('a');
      a.href=url;a.download='pawly-pocket-backup-completo.json';a.click();
      setTimeout(()=>URL.revokeObjectURL(url),1500);
      alert('Backup completo exportado: registros e '+documents.length+' documento(s).');
    } catch(error) {
      console.error('Falha ao exportar backup completo',error);
      alert('Não foi possível incluir os documentos. Nenhum backup foi baixado.');
    }
  };
  const restoreData = file => {
    const reader=new FileReader();
    reader.onload=async()=>{
      try {
        const parsed=JSON.parse(reader.result),data=parsed.data||parsed;
        let pets;
        if(Array.isArray(data.pets)&&data.pets.length)pets=data.pets;
        else if(data.profile)pets=[{...blankPet(),...data,id:data.id||'legacy-pet'}];
        else throw new Error('Backup inválido');
        const normalized=pets.map(p=>({...blankPet(),...p,profile:{...blankPet().profile,...p.profile}}));
        const next={...data,pets:normalized,activePetId:normalized.some(p=>p.id===data.activePetId)?data.activePetId:normalized[0].id};
        if(!confirm('A restauração substituirá os registros atuais. Deseja continuar?'))return;
        if(Array.isArray(parsed.documents)) {
          const docs=await Promise.all(parsed.documents.map(async d=>{
            if(!d.id||!d.petId||!normalized.some(p=>p.id===d.petId))throw new Error('Documento sem vínculo válido com um pet');
            const blob=d.blobData?await (await fetch(d.blobData)).blob():d.blob;
            if(!(blob instanceof Blob))throw new Error('Arquivo de documento inválido');
            const {blobData,...meta}=d;
            return {...meta,blob};
          }));
          const dbi=await openFilesDb();
          await new Promise((resolve,reject)=>{
            const tx=dbi.transaction('documents','readwrite'),os=tx.objectStore('documents');
            os.clear();docs.forEach(d=>os.put(d));
            tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Restauração cancelada'));
          });
        }
        localStorage.setItem(STORAGE_KEY,JSON.stringify(next));
        setStore(next);
        if(parsed.preferences?.theme){localStorage.setItem('pawly_theme',parsed.preferences.theme);setDark(parsed.preferences.theme==='dark');}
        if(parsed.preferences?.accent){localStorage.setItem('pawly_theme_primary',parsed.preferences.accent);setAccent(parsed.preferences.accent);}
        if(page==='documents') {
          const dbi=await openFilesDb();
          const all=await new Promise((resolve,reject)=>{const req=dbi.transaction('documents','readonly').objectStore('documents').getAll();req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error);});
          setDocuments(all.filter(x=>x.petId===next.activePetId).sort((a,b)=>(b.date||'').localeCompare(a.date||'')));
        }
        alert(Array.isArray(parsed.documents)?'Backup completo restaurado, incluindo documentos.':'Backup antigo restaurado. Os documentos locais foram preservados.');
      } catch(error) {
        console.error('Falha ao restaurar backup',error);
        alert('Não foi possível restaurar o arquivo. Os dados atuais foram mantidos sempre que a validação falhou.');
      }
    };
    reader.onerror=()=>alert('Não foi possível ler o arquivo selecionado.');
    reader.readAsText(file);
  };
  const content = () => {
    if (page === 'home') return <>
      <div className="page-heading"><div><span className="eyebrow">SEU ESPAÇO DE CUIDADO</span><h1>Olá! 💚</h1><p>Tudo organizado para acompanhar a saúde de {profile.name || 'sua pet'}.</p></div><button className="btn btn-primary" onClick={()=>openForm('health')}>+ Novo registro</button></div>
      <div className="welcome" hidden={dashboardPrefs.welcome===false}>
        <div className="welcome-copy"><div className="eyebrow"><span className="eyebrow-dot"/> UM DIA DE CADA VEZ</div><h2>Todo cuidado merece<br/><em>um lugar especial.</em></h2><p>Saúde, rotina e momentos do seu melhor amigo — organizados com carinho em um só lugar.</p><button className="welcome-cta" onClick={()=>changePage('profile')}>Conhecer perfil <span>↗</span></button></div>
        <div className="welcome-art" aria-hidden="true"><div className="hero-sun"/><div className="hero-leaf hero-leaf-one"/><div className="hero-leaf hero-leaf-two"/><div className="hero-pet-circle"><svg viewBox="0 0 220 210" role="img"><path d="M53 76C27 42 21 14 43 13c27-1 45 28 49 53M167 76c26-34 32-62 10-63-27-1-45 28-49 53" fill="#8ca98e"/><path d="M45 86c0-42 29-69 65-69s65 27 65 69v42c0 39-29 66-65 66s-65-27-65-66z" fill="#f5e8d6"/><path d="M75 99c7-7 16-7 23 0M122 99c7-7 16-7 23 0" fill="none" stroke="#536d58" strokeWidth="7" strokeLinecap="round"/><ellipse cx="110" cy="126" rx="23" ry="17" fill="#d9bba4"/><path d="M110 119c-8 0-11 7-7 12 4 5 10 5 14 0 4-5 1-12-7-12z" fill="#536d58"/><path d="M110 143c-9 11-21 10-27 4M110 143c9 11 21 10 27 4" fill="none" stroke="#536d58" strokeWidth="4" strokeLinecap="round"/><path d="M67 160c14 19 72 19 86 0" fill="none" stroke="#e0c9ae" strokeWidth="8" strokeLinecap="round"/></svg></div><div className="hero-float hero-float-heart">♡</div><div className="hero-float hero-float-paw">🐾</div><div className="hero-note"><span>✦</span><div><b>Amor em cada detalhe</b><small>Uma rotina mais leve</small></div></div></div>
      </div>
      <div className="stats" hidden={dashboardPrefs.stats===false}><div className="stat"><div className="stat-top">Vacinas registradas</div><strong>{pet.vaccines?.length||0}</strong><small>No histórico</small></div><div className="stat"><div className="stat-top">Registros de saúde</div><strong>{pet.health?.length||0}</strong><small>Consultas e cuidados</small></div><div className="stat"><div className="stat-top">Ciclos registrados</div><strong>{pet.heat?.length||0}</strong><small>Histórico de cio</small></div><div className="stat"><div className="stat-top">Próximos compromissos</div><strong>{upcoming.length}</strong><small>Datas cadastradas</small></div></div>
      <Card title="Controle de cio">{lastHeat ? <div className="heat-overview-card"><div><small>Desde o último início registrado</small><strong>{elapsed} dias</strong></div><div><small>Próximo cio estimado</small><b>{date(nextHeat.toISOString().slice(0,10))}</b><span>{remaining >= 0 ? 'Estimativa em '+remaining+' dias' : Math.abs(remaining)+' dias após a estimativa'}</span></div><button className="btn btn-soft" onClick={()=>changePage('heat')}>Ver acompanhamento →</button><small className="notice">Estimativa aproximada, não indica ovulação ou período fértil.</small></div> : <div className="heat-overview-empty"><b>Nenhum ciclo registrado</b><p>Registre a data de início para acompanhar os dias e consultar uma estimativa.</p><button className="btn btn-soft" onClick={()=>openForm('heat')}>Registrar início</button></div>}</Card>
      <div className="dashboard-grid" hidden={dashboardPrefs.main===false}><div><Card title="Próximos cuidados">{upcoming.length ? upcoming.map(x=><div className="list-row" key={x.id}><b>{x.title||x.name||x.type}</b><span>{date(x.date)}</span></div>) : <p className="muted">Nenhum compromisso cadastrado.</p>}</Card><Card title="Acesso rápido"><div className="quick-actions"><button onClick={()=>openForm('vaccine')}>♡ Registrar vacina</button><button onClick={()=>openForm('heat')}>◉ Registrar cio</button><button onClick={()=>openForm('health')}>✚ Anotar consulta</button></div></Card></div><Card title="Perfil da pet"><div className="pet-profile"><div className="pet-avatar-large">{profile.photo?<img src={profile.photo}/>: '🐶'}</div><div><b>{profile.name||'Minha pet'}</b><p>{profile.breed||'Raça não informada'}</p></div></div><p>Nascimento: <b>{date(profile.birth)}</b></p><p>Peso atual: <b>{profile.weight ? profile.weight+' kg' : '—'}</b></p><p>Idade: <b>{petAgeLabel(profile.birth)}</b></p><button className="btn btn-soft" onClick={()=>changePage('profile')}>Editar perfil</button></Card></div>
    </>;
    if (page === 'heat') return <><div className="page-heading"><div><span className="eyebrow">CICLO REPRODUTIVO</span><h1>Controle de cio</h1><p>Acompanhe os dias desde o início e consulte uma estimativa do próximo ciclo.</p></div><button className="btn btn-primary" onClick={()=>openForm('heat')}>+ Registrar ciclo</button></div>{lastHeat&&<Card title="Acompanhamento do ciclo"><div className="stats"><div className="stat"><small>Último início</small><strong>{date(lastHeat.start)}</strong></div><div className="stat"><small>Dias decorridos</small><strong>{elapsed}</strong></div><div className="stat"><small>Próximo estimado</small><strong>{date(nextHeat.toISOString().slice(0,10))}</strong></div></div></Card>}<Card title="Histórico de ciclos">{heat.length ? heat.map(x=><div className="list-row" key={x.id}><div><b>{date(x.start)}</b><p>{x.notes||'Sem observações'}</p></div><div className="actions"><button className="small-btn" onClick={()=>openForm('heat',x)}>Editar</button><button className="small-btn" onClick={()=>{if(confirm('Excluir este ciclo?'))updatePet(p=>({...p,heat:p.heat.filter(y=>y.id!==x.id)}));}}>Excluir</button></div></div>) : <p className="muted">Nenhum ciclo registrado ainda.</p>}</Card><Card title="Intervalo de referência"><p>Intervalo usado apenas para estimar o próximo ciclo.</p><input aria-label="Intervalo em dias" type="number" min="90" max="500" value={interval} onChange={e=>updatePet(p=>({...p,heatIntervalDays:Number(e.target.value)}))}/> dias</Card><p className="notice">A previsão é aproximada e não indica ovulação ou período fértil. Confirme dúvidas com o médico-veterinário.</p></>;
    if (page === 'feeding') {
      const entries=[...(pet.feeding||[])].sort((a,b)=>(b.date||'').localeCompare(a.date||''));
      const todayEntries=entries.filter(x=>x.date===todayISO());
      return <><div className="page-heading"><div><span className="eyebrow">ROTINA E NUTRIÇÃO</span><h1>Alimentação e hidratação</h1><p>Registre refeições, petiscos, suplementos e observações da rotina alimentar.</p></div><button className="btn btn-primary" onClick={()=>openForm('food')}>+ Registrar refeição</button></div><div className="record-summary"><div className="record-summary-item"><span>Registros hoje</span><strong>{todayEntries.length}</strong></div><div className="record-summary-item"><span>Total de registros</span><strong>{entries.length}</strong></div><div className="record-summary-item"><span>Último registro</span><strong className="record-summary-date">{date(entries[0]?.date)}</strong></div></div><Card title="Diário alimentar">{entries.length?entries.map(x=><article className="record-card" key={x.id}><div className="record-card-main"><div className="record-card-title"><b>{x.food||x.type||'Refeição'}</b><span className="record-status ok">{x.type||'Alimentação'}</span></div><p>{date(x.date)}{x.time?' · '+x.time:''}{x.notes?' · '+x.notes:''}</p><div className="record-details"><span>Quantidade: {x.quantity||'Não informada'}</span></div></div><div className="actions"><button className="small-btn" onClick={()=>openForm('food',x)}>Editar</button><button className="small-btn" onClick={()=>{if(confirm('Excluir este registro alimentar?'))updatePet(p=>({...p,feeding:(p.feeding||[]).filter(y=>y.id!==x.id)}));}}>Excluir</button></div></article>):<div className="empty-state"><span>🥣</span><b>Seu diário alimentar começa aqui</b><p>Registre refeições e quantidades para acompanhar a rotina do seu pet.</p><button className="btn btn-soft" onClick={()=>openForm('food')}>Adicionar primeira refeição</button></div>}</Card><p className="notice">Use os registros como diário de rotina. Quantidades e dietas devem seguir a orientação do médico-veterinário, especialmente em filhotes ou pets com necessidades especiais.</p></>;
    }
    if (page === 'expenses') {
      const entries=[...(pet.expenses||[])].sort((a,b)=>(b.date||'').localeCompare(a.date||''));
      const total=entries.reduce((sum,x)=>sum+(Number(x.amount)||0),0);
      const month=entries.filter(x=>(x.date||'').slice(0,7)===todayISO().slice(0,7)).reduce((sum,x)=>sum+(Number(x.amount)||0),0);
      const money=value=>Number(value||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
      return <><div className="page-heading"><div><span className="eyebrow">ORGANIZAÇÃO FINANCEIRA</span><h1>Despesas do pet</h1><p>Acompanhe os gastos com saúde, alimentação, higiene e rotina.</p></div><button className="btn btn-primary" onClick={()=>openForm('expense')}>+ Lançar despesa</button></div><div className="record-summary"><div className="record-summary-item"><span>Total registrado</span><strong>{money(total)}</strong></div><div className="record-summary-item"><span>Neste mês</span><strong>{money(month)}</strong></div><div className="record-summary-item"><span>Lançamentos</span><strong>{entries.length}</strong></div></div><Card title="Histórico de despesas">{entries.length?entries.map(x=><article className="record-card" key={x.id}><div className="record-card-main"><div className="record-card-title"><b>{x.description||x.category}</b><span className="record-status ok">{x.category||'Outro'}</span></div><p>{date(x.date)}{x.vendor?' · '+x.vendor:''}{x.notes?' · '+x.notes:''}</p><div className="record-details"><span>{x.payment||'Pagamento não informado'}</span><strong>{money(x.amount)}</strong></div></div><div className="actions"><button className="small-btn" onClick={()=>openForm('expense',x)}>Editar</button><button className="small-btn" onClick={()=>{if(confirm('Excluir esta despesa?'))updatePet(p=>({...p,expenses:(p.expenses||[]).filter(y=>y.id!==x.id)}));}}>Excluir</button></div></article>):<div className="empty-state"><span>🧾</span><b>Nenhuma despesa registrada</b><p>Adicione os gastos do pet para ter uma visão clara dos custos.</p><button className="btn btn-soft" onClick={()=>openForm('expense')}>Lançar primeira despesa</button></div>}</Card><p className="notice">Os valores são registros informativos e não substituem comprovantes ou controle contábil.</p></>;
    }
    if (page === 'calendar') {
      const year=calendarCursor.getFullYear(), month=calendarCursor.getMonth(), first=new Date(year,month,1).getDay(), count=new Date(year,month+1,0).getDate();
      const monthName=new Date(year,month,1).toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
      const monthKey=year+'-'+String(month+1).padStart(2,'0');
      const events=[...allRecords(),...upcoming.map(x=>({id:x.id,category:x.type,title:x.title,date:x.date,notes:x.notes||''}))].filter((x,i,a)=>x.date?.startsWith(monthKey)&&a.findIndex(y=>y.id===x.id&&y.date===x.date)===i);
      const cells=[...Array(first).fill(null),...Array.from({length:count},(_,i)=>i+1)];
      return <><div className="page-heading"><div><span className="eyebrow">ORGANIZAÇÃO</span><h1>Calendário de cuidados</h1><p>Visualize os registros e compromissos por mês.</p></div><button className="btn btn-primary" onClick={()=>openForm('event')}>+ Compromisso</button></div><Card title={monthName}><div className="calendar-toolbar"><button className="small-btn" onClick={()=>setCalendarCursor(new Date(year,month-1,1))}>←</button><button className="small-btn" onClick={()=>setCalendarCursor(new Date(new Date().getFullYear(),new Date().getMonth(),1))}>Hoje</button><button className="small-btn" onClick={()=>setCalendarCursor(new Date(year,month+1,1))}>→</button></div><div className="react-calendar-grid">{['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(x=><b className="calendar-day-name" key={x}>{x}</b>)}{cells.map((n,i)=>{if(!n)return <div className="calendar-cell empty" key={'empty-'+i}/>;const key=monthKey+'-'+String(n).padStart(2,'0');const matches=events.filter(x=>x.date===key);const isToday=key===todayISO();return <div className={'calendar-cell '+(isToday?'today':'')} key={key}><b>{n}</b>{matches.length>0&&<span>{matches.length} {matches.length===1?'registro':'registros'}</span>}</div>;})}</div></Card><Card title="Registros do mês">{events.length?events.sort((a,b)=>a.date.localeCompare(b.date)).map(x=><div className="list-row" key={x.id+x.date}><div><small>{date(x.date)} · {x.category}</small><b>{x.title}</b>{x.notes&&<p>{x.notes}</p>}</div></div>):<p className="muted">Nenhum registro neste mês.</p>}</Card></>;
    }
    if (page === 'vaccines' || page === 'health' || page === 'reproduction') {
      const config = {
        vaccines:['Carteira de vacinação','Acompanhe aplicações, doses e datas de reforço.','vaccine','vaccines',pet.vaccines||[]],
        health:['Saúde e histórico','Consultas, medicamentos, peso e exames em um só lugar.','health','health',pet.health||[]],
        reproduction:['Reprodução','Organize coberturas, gestação, parto, pós-parto e filhotes.','reproduction','reproduction',pet.reproduction||[]]
      }[page];
      const query=recordFilter.trim().toLocaleLowerCase('pt-BR');
      const filtered=config[4].filter(x=>[x.name,x.title,x.type,x.dose,x.vet,x.notes].filter(Boolean).join(' ').toLocaleLowerCase('pt-BR').includes(query));
      const overdue=page==='vaccines'?config[4].filter(x=>x.next&&daysUntil(x.next)<0).length:0;
      const dueSoon=page==='vaccines'?config[4].filter(x=>x.next&&daysUntil(x.next)>=0&&daysUntil(x.next)<=30).length:0;
      return <>
        <div className="page-heading"><div><span className="eyebrow">{page==='vaccines'?'PREVENÇÃO':page==='health'?'ACOMPANHAMENTO':'CUIDADOS REPRODUTIVOS'}</span><h1>{config[0]}</h1><p>{config[1]}</p></div><button className="btn btn-primary" onClick={()=>openForm(config[2])}>+ Adicionar registro</button></div>
        <div className="record-summary">
          <div className="record-summary-item"><span>Total de registros</span><strong>{config[4].length}</strong></div>
          {page==='vaccines'&&<><div className="record-summary-item"><span>Reforços próximos</span><strong>{dueSoon}</strong></div><div className="record-summary-item"><span>Reforços atrasados</span><strong className={overdue?'text-alert':''}>{overdue}</strong></div></>}
          {page==='health'&&<><div className="record-summary-item"><span>Registros com peso</span><strong>{config[4].filter(x=>x.weight).length}</strong></div><div className="record-summary-item"><span>Último registro</span><strong className="record-summary-date">{date([...config[4]].sort((a,b)=>(b.date||'').localeCompare(a.date||''))[0]?.date)}</strong></div></>}
          {page==='reproduction'&&<><div className="record-summary-item"><span>Eventos de gestação/parto</span><strong>{config[4].filter(x=>/gesta|parto|filhote/i.test(x.type||'')).length}</strong></div><div className="record-summary-item"><span>Último evento</span><strong className="record-summary-date">{date([...config[4]].sort((a,b)=>(b.date||'').localeCompare(a.date||''))[0]?.date)}</strong></div></>}
        </div>
        <Card title="Pesquisar registros"><input className="record-search" type="search" value={recordFilter} onChange={e=>setRecordFilter(e.target.value)} placeholder={page==='vaccines'?'Buscar vacina, dose ou clínica...':page==='health'?'Buscar consulta, medicamento ou exame...':'Buscar evento ou observação...'}/><span className="muted-small">{filtered.length} de {config[4].length} registro(s)</span></Card>
        <Card title={page==='vaccines'?'Carteira e reforços':page==='health'?'Histórico de saúde':'Histórico reprodutivo'}>
          {filtered.length?filtered.map(x=>{const due=x.next?daysUntil(x.next):null;const status=due===null?null:due<0?'Reforço atrasado':due<=30?'Reforço próximo':'Em dia';return <article className="record-card" key={x.id}><div className="record-card-main"><div className="record-card-title"><b>{x.name||x.title||x.type||'Registro'}</b>{page==='vaccines'&&status&&<span className={'record-status '+(due<0?'overdue':due<=30?'soon':'ok')}>{status}</span>}</div><p>{date(x.date||x.start)}{x.notes?' · '+x.notes:''}</p>{page==='vaccines'&&<div className="record-details"><span>Dose: {x.dose||'—'}</span><span>Reforço: {date(x.next)}</span><span>{x.vet||'Clínica não informada'}</span></div>}{page==='health'&&<div className="record-details"><span>{x.type||'Cuidado'}</span>{x.weight&&<span>Peso registrado: {x.weight} kg</span>}{x.repeatEnabled&&<span>Recorrência: a cada {x.repeatEvery} mês(es)</span>}</div>}{page==='reproduction'&&<div className="record-details"><span>Evento reprodutivo</span>{x.repeatEnabled&&<span>Lembrete recorrente</span>}</div>}</div><div className="actions"><button className="small-btn" onClick={()=>openForm(config[2],x)}>Editar</button><button className="small-btn" onClick={()=>{if(confirm('Excluir este registro?'))updatePet(p=>({...p,[config[3]]:(p[config[3]]||[]).filter(y=>y.id!==x.id)}));}}>Excluir</button></div></article>;}) : <div className="empty-state"><span>🌿</span><b>{config[4].length?'Nenhum resultado encontrado':'Ainda não há registros'}</b><p>{config[4].length?'Tente outra palavra na pesquisa.':'Adicione o primeiro registro para começar a organizar os cuidados.'}</p>{!config[4].length&&<button className="btn btn-soft" onClick={()=>openForm(config[2])}>Adicionar agora</button>}</div>}
        </Card>
        {page==='reproduction'&&<p className="notice">O Pawly organiza datas e observações. Confirmação de gestação, acompanhamento e condutas devem ser realizados com médico-veterinário.</p>}
        {page==='vaccines'&&<p className="notice">O status do reforço usa a data informada no cadastro. Confirme o protocolo e o calendário vacinal com o médico-veterinário.</p>}
      </>;
    }    if (page === 'profile') return <><div className="page-heading"><div><span className="eyebrow">CADASTRO</span><h1>Perfil da pet</h1><p>Informações básicas da sua companheira.</p><p className="profile-age">Idade calculada: <b>{petAgeLabel(profile.birth)}</b></p></div></div><Card title="Dados do pet"><form className="form-grid" onSubmit={e=>{e.preventDefault();updatePet(p=>({...p,profile:{...p.profile,...form}}));setForm({});}}>{['name','breed','birth','weight','sex','sterilized','microchip','notes'].map(k=><label key={k}>{({name:'Nome',breed:'Raça',birth:'Nascimento',weight:'Peso (kg)',sex:'Sexo',sterilized:'Castrada',microchip:'Microchip',notes:'Observações'})[k]}{k==='sex'||k==='sterilized'?<select value={form[k]??profile[k]??(k==='sex'?'Fêmea':'Não')} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))}>{(k==='sex'?['Fêmea','Macho']:['Não','Sim']).map(x=><option key={x}>{x}</option>)}</select>:k==='notes'?<textarea value={form[k]??profile[k]??''} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))}/>:<input type={k==='birth'?'date':k==='weight'?'number':'text'} step={k==='weight'?'0.1':undefined} value={form[k]??profile[k]??''} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))}/>}</label>)}<label className="photo-upload">Foto do pet<input type="file" accept="image/*" onChange={e=>{const file=e.target.files?.[0];if(!file)return;if(file.size>2*1024*1024){alert('Escolha uma imagem de até 2 MB.');return;}const reader=new FileReader();reader.onload=()=>setForm(f=>({...f,photo:reader.result}));reader.readAsDataURL(file);}}/></label><button className="btn btn-primary">Salvar perfil</button></form><div className="profile-extra-actions"><button className="btn btn-soft" onClick={async()=>{const p=profile;const shareText='Ficha de '+(p.name||'pet')+'\nRaça: '+(p.breed||'Não informada')+'\nNascimento: '+date(p.birth)+'\nPeso: '+(p.weight||'Não informado')+' kg\nSexo: '+(p.sex||'Não informado')+'\nMicrochip: '+(p.microchip||'—');if(navigator.share){try{await navigator.share({title:'Ficha de '+p.name,text:shareText});}catch{}}else if(navigator.clipboard){await navigator.clipboard.writeText(shareText);alert('Ficha copiada.');}}}>Compartilhar ficha</button><button className="btn btn-soft" onClick={()=>{const rows=allRecords();const html='<html><meta charset="utf-8"><title>Relatório Pawly</title><style>body{font:14px Arial;margin:32px;color:#26352c}h1{color:#3f6650}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid #ddd;text-align:left}</style><h1>Pawly Pocket · Relatório veterinário</h1><h2>'+profile.name+'</h2><p>'+profile.breed+' · Nascimento: '+date(profile.birth)+' · Peso: '+(profile.weight||'—')+' kg</p><table><tr><th>Data</th><th>Categoria</th><th>Registro</th><th>Observações</th></tr>'+rows.map(x=>'<tr><td>'+date(x.date)+'</td><td>'+x.category+'</td><td>'+x.title+'</td><td>'+x.notes+'</td></tr>').join('')+'</table></html>';const w=window.open('','_blank');if(w){w.document.write(html);w.document.close();w.onload=()=>setTimeout(()=>w.print(),300);}}}>Gerar relatório / PDF</button></div></Card></>;
        if (page === 'pets') return <><div className="page-heading"><div><span className="eyebrow">PERFIS</span><h1>Meus pets</h1><p>Cada animal tem seu próprio perfil, histórico e lembretes.</p></div><button className="btn btn-primary" onClick={addPet}>+ Adicionar pet</button></div><div className="pet-grid">{store.pets.map(p=><article className="pet-card" key={p.id}><div className="pet-card-top"><div className="pet-card-avatar">{p.profile?.photo?<img src={p.profile.photo}/>: '🐶'}</div><div><h3>{p.profile?.name||'Pet sem nome'}</h3><p>{p.profile?.breed||'Raça não informada'}</p></div></div><div className="pet-card-meta"><span>{p.profile?.sex||'Sexo não informado'}</span><span>{p.profile?.weight?p.profile.weight+' kg':'Peso não informado'}</span><span>{petAgeLabel(p.profile?.birth)}</span></div><div className="pet-card-actions"><button className="btn btn-soft" onClick={()=>setStore(s=>{const n={...s,activePetId:p.id};localStorage.setItem(STORAGE_KEY,JSON.stringify(n));return n;})}>{p.id===pet.id?'Pet atual':'Selecionar'}</button><button className="btn btn-line" onClick={()=>openPetForm(p)}>Editar</button>{store.pets.length>1&&<button className="btn btn-line" onClick={()=>{if(!confirm('Excluir este pet e todos os registros associados?'))return;setStore(s=>{const pets=s.pets.filter(x=>x.id!==p.id);const n={...s,pets,activePetId:s.activePetId===p.id?pets[0].id:s.activePetId};localStorage.setItem(STORAGE_KEY,JSON.stringify(n));return n;});}}>Excluir</button>}</div></article>)}</div><p className="notice">Os dados antigos permanecem associados ao primeiro perfil migrado. A exclusão de um pet remove seus registros locais.</p></>;

    if(page==='account') return <><div className="page-heading"><div><span className="eyebrow">CONTA E SINCRONIZAÇÃO</span><h1>Sua conta Pawly</h1><p>Acesse seus pets em mais de um aparelho e compartilhe o acompanhamento.</p></div></div><Card title="Acesso à nuvem">{session?.user?<><p><b>Conectado como</b></p><p>{session.user.email}</p><p className="notice">Os perfis e registros dos pets são sincronizados com segurança. Os documentos anexados continuam armazenados localmente neste aparelho nesta etapa.</p><button className="btn btn-soft" onClick={()=>{setCloudReady(false);setAuthStatus('Atualizando dados...');supabase.from('pets').select('id').then(()=>window.location.reload());}}>Atualizar dados</button> <button className="btn btn-line" onClick={signOutAccount}>Sair da conta</button></>:<><button className="btn btn-primary" disabled={authBusy} onClick={signInWithGoogle}>{authBusy?'Conectando...':'Continuar com Google'}</button>{Capacitor.isNativePlatform()&&<p className="notice">O login Google está disponível no navegador e no aplicativo. Se o provedor ainda não estiver habilitado no Supabase, conclua primeiro a configuração OAuth.</p>}<p className="notice">Ou entre com e-mail e senha.</p><form className="form-grid" onSubmit={signInWithEmail}><label>E-mail<input type="email" required value={authEmail} onChange={e=>setAuthEmail(e.target.value)} placeholder="voce@email.com"/></label><label>Senha<input type="password" required minLength="6" value={authPassword} onChange={e=>setAuthPassword(e.target.value)} placeholder="Mínimo de 6 caracteres"/></label><button className="btn btn-primary" disabled={authBusy}>Entrar</button><button type="button" className="btn btn-soft" disabled={authBusy} onClick={signUpWithEmail}>Criar conta com e-mail</button></form></>}</Card>{authStatus&&<p className="notice" role="status">{authStatus}</p>}{pendingInvite&&<Card title="Convite recebido"><p>Você recebeu um convite para acompanhar um pet. Entre com o e-mail que recebeu o convite e toque em aceitar.</p><button className="btn btn-primary" disabled={!session||authBusy} onClick={async()=>{setAuthBusy(true);const {error}=await supabase.rpc('accept_pet_invitation',{p_token:pendingInvite});if(error)setAuthStatus(error.message);else{setPendingInvite('');const u=new URL(window.location.href);u.searchParams.delete('invite');window.history.replaceState({},'',u.toString());setAuthStatus('Convite aceito! Atualize os pets para carregar o perfil compartilhado.');window.location.reload();}setAuthBusy(false);}}>Aceitar convite</button></Card>}</>;
    if(page==='sharing') return <><div className="page-heading"><div><span className="eyebrow">FAMÍLIA PAWLY</span><h1>Compartilhar {profile.name||'pet'}</h1><p>Convide outra conta para acompanhar o mesmo animal, sem duplicar o cadastro.</p></div></div>{!session?<Card title="Entre na sua conta"><p>É necessário estar conectado para compartilhar um pet.</p><button className="btn btn-primary" onClick={()=>changePage('account')}>Ir para Conta e nuvem</button></Card>:pet._cloudOwnerId!==session.user.id?<Card title="Pet compartilhado"><p>Este perfil pertence a outra conta. Você está conectado como participante e pode acompanhar e atualizar os registros compartilhados.</p></Card>:<><Card title="Convidar outra pessoa"><form className="form-grid" onSubmit={createPetInvite}><label>E-mail da outra conta<input type="email" required value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} placeholder="pessoa@email.com"/></label><button className="btn btn-primary" disabled={!cloudReady}>Criar convite e compartilhar link</button></form><p className="notice">O convite vale por 7 dias e só pode ser aceito por uma conta com o mesmo e-mail informado. Depois de criar, envie o link copiado pelo WhatsApp ou outro canal.</p></Card><Card title="Contas com acesso">{shareMembers.length?shareMembers.map(m=><div className="list-row" key={m.user_id}><div><b>{m.profile?.full_name||m.profile?.email||'Participante'}</b><p className="notice">{m.profile?.email||m.user_id}</p><small>Acesso para visualizar e editar registros</small></div><button className="small-btn" onClick={()=>removePetMember(m.user_id)}>Remover acesso</button></div>):<p className="muted">Este pet ainda não foi compartilhado.</p>}</Card><Card title="Convites pendentes">{shareInvites.length?shareInvites.map(i=><div className="list-row" key={i.id}><div><b>{i.invited_email}</b><p className="notice">Expira em {date(i.expires_at.slice(0,10))}</p></div><button className="small-btn" onClick={()=>revokePetInvite(i.id)}>Cancelar</button></div>):<p className="muted">Nenhum convite pendente.</p>}</Card></>}{shareStatus&&<p className="notice" role="status">{shareStatus}</p>}</>;
    if (page === 'timeline') { const rows=allRecords(); return <><div className="page-heading"><div><span className="eyebrow">HISTÓRICO</span><h1>Linha do tempo</h1><p>Todos os acontecimentos do pet ativo organizados por data.</p></div><button className="btn btn-primary" onClick={()=>openForm('health')}>+ Novo registro</button></div><Card title="Histórico completo">{rows.length?rows.map(x=><div className="list-row" key={x.id}><div><small>{x.category} · {date(x.date)}</small><b>{x.title}</b>{x.notes&&<p>{x.notes}</p>}</div></div>):<p className="muted">Ainda não há registros para mostrar.</p>}</Card></>; }
    if (page === 'search') { const q=searchTerm.trim().toLocaleLowerCase('pt-BR'); const rows=store.pets.flatMap(p=>allRecords(p)).filter(x=>!q||(x.title+' '+x.category+' '+x.notes+' '+x.petName).toLocaleLowerCase('pt-BR').includes(q)); return <><div className="page-heading"><div><span className="eyebrow">LOCALIZAR</span><h1>Buscar registros</h1><p>Pesquise em todos os pets, vacinas, consultas e observações.</p></div></div><Card title="Pesquisa"><input type="search" placeholder="Ex.: vacina, consulta, nome do pet..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)}/>{q&&<p className="muted">{rows.length} resultado(s)</p>}{rows.map(x=><div className="list-row" key={x.petId+x.id}><div><small>{x.petName} · {x.category} · {date(x.date)}</small><b>{x.title}</b><p>{x.notes}</p></div></div>)}</Card></>; }
    if (page === 'reminders') return <><div className="page-heading"><div><span className="eyebrow">ORGANIZAÇÃO</span><h1>Central de lembretes</h1><p>Próximos cuidados e compromissos cadastrados para este pet.</p></div><button className="btn btn-primary" onClick={()=>openForm('event')}>+ Compromisso</button></div><Card title="Próximos 30 dias">{upcoming.length?upcoming.map(x=><div className="list-row" key={x.id}><div><b>{x.title}</b><p>{x.type} · {date(x.date)}</p></div><span className="badge">{daysUntil(x.date)<0?'Atrasado':daysUntil(x.date)===0?'Hoje':'Em '+daysUntil(x.date)+' dias'}</span></div>):<p className="muted">Nenhum lembrete nos próximos 30 dias.</p>}</Card><p className="notice">Os lembretes são exibidos dentro do aplicativo. A entrega de notificações em segundo plano depende do sistema e das permissões do dispositivo.</p></>;
    if (page === 'dashboard') return <><div className="page-heading"><div><span className="eyebrow">PREFERÊNCIAS</span><h1>Painel e notificações</h1><p>Configure os cartões da visão geral e os avisos do Pawly.</p></div></div><Card title="Cartões da visão geral">{[['welcome','Mensagem de boas-vindas'],['stats','Indicadores de saúde'],['main','Próximos cuidados e perfil']].map(([key,label])=><label className="pref-row" key={key}><input type="checkbox" checked={dashboardPrefs[key]!==false} onChange={e=>{const next={...dashboardPrefs,[key]:e.target.checked};setDashboardPrefs(next);setStore(s=>{const n={...s,settings:{...s.settings,dashboard:next}};localStorage.setItem(STORAGE_KEY,JSON.stringify(n));return n;});}}/> {label}</label>)}</Card><Card title="Atualização do aplicativo"><p className="muted">Confira a versão mais recente do Pawly Pocket e aplique melhorias compatíveis sem reinstalar o aplicativo.</p><div className="notification-actions"><button className="btn btn-primary" type="button" disabled={updateBusy} onClick={checkForUpdates}>{updateBusy?'Verificando... ':'Verificar atualizações'}</button></div>{updateStatus&&<p className="notice" role="status">{updateStatus}{updateVersion?' · '+updateVersion:''}</p>}<p className="notice">As atualizações automáticas abrangem a interface e os recursos web. Mudanças em componentes nativos ainda exigem uma nova versão do aplicativo.</p></Card><Card title="Notificações do dispositivo"><p className="muted">Permissão atual: {Capacitor.isNativePlatform()?'Notificações nativas':('Notification' in window?Notification.permission:'Não suportadas neste navegador')}</p><div className="pref-row"><div><b>Latido Pawly</b><p className="notice">Um latido curto e discreto para identificar os lembretes.</p></div><label className="switch-row"><input type="checkbox" checked={notificationPrefs.sound} onChange={e=>saveNotificationPrefs({...notificationPrefs,sound:e.target.checked})}/> Ativado</label><button className="small-btn" type="button" onClick={previewPawlySound}>Ouvir</button></div><label className="pref-row"><input type="checkbox" checked={notificationPrefs.vibration} onChange={e=>saveNotificationPrefs({...notificationPrefs,vibration:e.target.checked})}/> Vibrar junto com a notificação</label><div className="notification-actions"><button className="btn btn-primary" onClick={async()=>{try{if(Capacitor.isNativePlatform()){let permission=await LocalNotifications.checkPermissions();if(permission.display!=='granted')permission=await LocalNotifications.requestPermissions();if(permission.display!=='granted'){alert('Permissão de notificações não concedida.');return;}localStorage.setItem('pawly_native_notifications','1');setNativeNotificationsEnabled(true);alert('Notificações do aparelho ativadas. Os próximos cuidados serão agendados.');return;}if(!('Notification' in window)){alert('Este navegador não oferece notificações.');return;}const permission=await Notification.requestPermission();alert('Permissão atual: '+permission);}catch{alert('Não foi possível ativar as notificações neste dispositivo.');}}}>Ativar notificações</button><button className="btn btn-soft" type="button" onClick={testNotification}>Testar aviso</button></div></Card><p className="notice">No Android, o som e a vibração são definidos pelo canal de notificações do sistema. Se o canal já existir, o Android pode manter a configuração antiga; esta versão usa um canal atualizado. No navegador, o som de prévia funciona com o app aberto.</p></>;
    if (page === 'documents') return <><div className="page-heading"><div><span className="eyebrow">ARQUIVOS</span><h1>Documentos e exames</h1><p>Guarde receitas, exames, laudos e comprovantes neste aparelho.</p></div></div><Card title="Anexar documento"><form className="form-grid" onSubmit={async e=>{e.preventDefault();const fd=new FormData(e.currentTarget),file=fd.get('file');if(!file||!file.size)return;if(file.size>15*1024*1024){alert('O limite por arquivo é 15 MB.');return;}try{const dbi=await openFilesDb();await new Promise((resolve,reject)=>{const tx=dbi.transaction('documents','readwrite');tx.objectStore('documents').put({id:crypto.randomUUID(),petId:pet.id,title:fd.get('title'),category:fd.get('category'),date:fd.get('date'),filename:file.name,mime:file.type,blob:file,createdAt:new Date().toISOString()});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});e.currentTarget.reset();loadDocuments();}catch{alert('Não foi possível salvar o arquivo neste aparelho.');}}}><label>Nome do documento<input name="title" required placeholder="Ex.: Hemograma de novembro"/></label><label>Categoria<select name="category"><option>Exame</option><option>Receita</option><option>Laudo</option><option>Comprovante</option><option>Outro</option></select></label><label>Data<input name="date" type="date" defaultValue={todayISO()}/></label><label>Arquivo (PDF ou imagem)<input name="file" type="file" accept="application/pdf,image/*" required/></label><button className="btn btn-primary">Anexar documento</button></form></Card><Card title="Arquivos salvos">{documents.length?documents.map(d=><div className="list-row" key={d.id}><div><b>{d.title}</b><p>{d.category} · {date(d.date)} · {d.filename}</p></div><div className="actions"><button className="small-btn" onClick={()=>{const url=URL.createObjectURL(d.blob);const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}}>Abrir</button><button className="small-btn" onClick={async()=>{if(!confirm('Excluir este documento?'))return;const dbi=await openFilesDb();await new Promise(resolve=>{const tx=dbi.transaction('documents','readwrite');tx.objectStore('documents').delete(d.id);tx.oncomplete=resolve;});loadDocuments();}}>Excluir</button></div></div>):<p className="muted">Nenhum documento anexado para este pet.</p>}</Card><p className="notice">Os anexos são guardados no IndexedDB deste dispositivo e incluídos no backup completo. Os arquivos não são enviados para a internet.</p></>;
    if (page === 'customize') return <><div className="page-heading"><div><span className="eyebrow">PREFERÊNCIAS</span><h1>Personalizar</h1><p>Ajuste a aparência do Pawly Pocket.</p></div></div><Card title="Aparência"><button className="btn btn-soft" onClick={toggleDark}>Alternar para modo {dark?'claro':'escuro'}</button><label className="accent-picker">Cor principal<input type="color" value={accent} onChange={e=>{setAccent(e.target.value);localStorage.setItem('pawly_theme_primary',e.target.value);}}/></label><button className="small-btn" onClick={()=>{setAccent('#668875');localStorage.setItem('pawly_theme_primary','#668875');}}>Restaurar cor original</button></Card></>;
    if (page === 'backup') return <><div className="page-heading"><div><span className="eyebrow">SEUS DADOS</span><h1>Backup e dados</h1><p>Exporte ou restaure os registros e os arquivos anexados neste dispositivo.</p></div></div><Card title="Exportar backup completo"><p className="muted">Inclui perfis, vacinas, histórico, lembretes e documentos anexados (PDFs e imagens).</p><button className="btn btn-primary" onClick={exportData}>Exportar backup completo</button></Card><Card title="Restaurar backup"><label>Selecionar arquivo JSON<input type="file" accept="application/json,.json" onChange={e=>{const file=e.target.files?.[0];if(file)restoreData(file);e.target.value='';}}/></label><p className="muted-small">Compatível com backups antigos. Se o arquivo for antigo e não tiver documentos, os anexos que já estão neste aparelho serão preservados.</p></Card><p className="notice">Os documentos podem aumentar bastante o tamanho do arquivo. Guarde o backup em local seguro e faça uma nova exportação sempre que anexar arquivos importantes.</p></>;
    return <Card title="Em migração"><p>Esta área será portada para React na próxima etapa.</p></Card>;
  };
  if(sessionLoading) return <div className={`pawly-auth-screen ${dark?'theme-dark':''}`}><div className="pawly-auth-loading"><span className="pawly-auth-mark">🐾</span><b>Pawly Pocket</b><p>Preparando seu espaço...</p></div></div>;
  if(session?.user && authMode==='reset') return <div className={`pawly-auth-screen ${dark?'theme-dark':''}`}><section className="pawly-auth-card"><div className="pawly-auth-brand"><span className="pawly-auth-mark">🐾</span><div><b>Pawly Pocket</b><small>Recuperação de acesso</small></div></div><h1>Crie uma nova senha.</h1><form className="pawly-auth-form" onSubmit={saveRecoveredPassword}><label>Nova senha<input type="password" autoComplete="new-password" minLength="8" required value={authNewPassword} onChange={e=>setAuthNewPassword(e.target.value)} placeholder="Mínimo de 8 caracteres"/></label><button className="btn btn-primary" disabled={authBusy}>{authBusy?'Salvando...':'Salvar nova senha'}</button></form>{authStatus&&<p className="pawly-auth-status" role="status">{authStatus}</p>}</section></div>;
  if(!session?.user) return <div className={`pawly-auth-screen ${dark?'theme-dark':''}`}>
    <section className="pawly-auth-card">
      <div className="pawly-auth-brand"><span className="pawly-auth-mark">🐾</span><div><b>Pawly Pocket</b><small>Seu pet. Sua vida. Tudo no bolso.</small></div></div>
      <span className="eyebrow">{authMode==='signup'?'CADASTRO GRATUITO':authMode==='forgot'?'RECUPERAR ACESSO':'BEM-VINDO AO PAWLY'}</span>
      <h1>{authMode==='signup'?'Crie sua conta.':authMode==='forgot'?'Vamos recuperar seu acesso.':'Seu cuidado começa aqui.'}</h1>
      <p className="pawly-auth-intro">{authMode==='signup'?'Cadastre-se para guardar os dados dos seus pets e compartilhar o acompanhamento com outras pessoas.':authMode==='forgot'?'Informe o e-mail da sua conta. Enviaremos um link seguro para redefinir a senha.':'Entre na sua conta para acessar os perfis, históricos e lembretes dos seus pets em qualquer aparelho.'}</p>
      {pendingInvite&&<div className="pawly-auth-invite">🐾 Você recebeu um convite para acompanhar um pet. Use exatamente o e-mail para o qual o convite foi enviado.</div>}
      {authMode!=='forgot'&&<button className="pawly-auth-google" disabled={authBusy} onClick={signInWithGoogle}>{authBusy?'Aguarde...':'Continuar com Google'}</button>}
      {authMode!=='forgot'&&<div className="pawly-auth-separator"><span>ou use seu e-mail</span></div>}
      <form className="pawly-auth-form" onSubmit={authMode==='signup'?signUpWithEmail:authMode==='forgot'?requestPasswordReset:signInWithEmail}>
        {authMode==='signup'&&<label>Seu nome<input type="text" autoComplete="name" value={authFullName} onChange={e=>setAuthFullName(e.target.value)} placeholder="Como podemos te chamar?"/></label>}
        <label>E-mail<input type="email" autoComplete="email" required value={authEmail} onChange={e=>setAuthEmail(e.target.value)} placeholder="voce@email.com"/></label>
        {authMode!=='forgot'&&<label>Senha<input type="password" autoComplete={authMode==='signup'?'new-password':'current-password'} required minLength={authMode==='signup'?8:6} value={authPassword} onChange={e=>setAuthPassword(e.target.value)} placeholder={authMode==='signup'?'Mínimo de 8 caracteres':'Sua senha'}/></label>}
        {authMode==='signup'&&<label>Confirme a senha<input type="password" autoComplete="new-password" required minLength="8" value={authConfirmPassword} onChange={e=>setAuthConfirmPassword(e.target.value)} placeholder="Digite a senha novamente"/></label>}
        <button className="btn btn-primary" disabled={authBusy}>{authBusy?'Aguarde...':authMode==='signup'?'Criar minha conta':authMode==='forgot'?'Enviar link de recuperação':'Entrar na minha conta'}</button>
      </form>
      {authMode==='signup'&&<button type="button" className="pawly-auth-create" disabled={authBusy} onClick={resendSignupConfirmation}>Reenviar e-mail de confirmação</button>}
      {authMode==='login'&&<><button type="button" className="pawly-auth-create" disabled={authBusy} onClick={()=>setAuthMode('signup')}>Criar uma conta gratuita</button><button type="button" className="pawly-auth-create" disabled={authBusy} onClick={()=>setAuthMode('forgot')}>Esqueci minha senha</button><button type="button" className="pawly-auth-create" disabled={authBusy} onClick={resendSignupConfirmation}>Reenviar confirmação de e-mail</button></>}
      {authMode!=='login'&&<button type="button" className="pawly-auth-create" disabled={authBusy} onClick={()=>{setAuthMode('login');setAuthStatus('');}}>Voltar para entrar</button>}
      {authStatus&&<p className="pawly-auth-status" role="status">{authStatus}</p>}
      <p className="pawly-auth-privacy">🔒 Seus dados ficam vinculados à sua conta. Ao sair, eles deixam de aparecer neste aparelho até você entrar novamente.</p>
    </section>
  </div>;
  return <div className={`app-shell ${dark?'theme-dark':''}`}>
    <aside className={`sidebar ${menuOpen?'open':''}`}><a className="brand" href="#" onClick={e=>{e.preventDefault();changePage('home')}}><span className="brand-mark">🐾</span><span><b>Pawly Pocket</b><small>Seu pet. Sua vida. Tudo no bolso.</small></span></a><div className="pet-mini"><div className="pet-avatar">{profile.photo?<img src={profile.photo}/>: '🐶'}</div><div><b>{profile.name||'Minha pet'}</b><small>Perfil da pet</small></div><select aria-label="Selecionar pet" value={pet.id} onChange={e=>setStore(s=>{const n={...s,activePetId:e.target.value};localStorage.setItem(STORAGE_KEY,JSON.stringify(n));return n;})}>{store.pets.map(p=><option key={p.id} value={p.id}>{p.profile?.name||'Pet'}</option>)}</select><button className="small-btn" onClick={addPet}>+</button></div><div className="nav-label">MENU PRINCIPAL</div><nav className="nav">
      <button className={`nav-link nav-home ${page==='home'?'active':''}`} onClick={()=>changePage('home')}><span>⌂</span>Visão geral</button>
      {navGroups.map(group=><section key={group.id} className={`nav-group ${openNavGroup===group.id?'expanded':''}`}>
        <button type="button" className="nav-group-toggle" aria-expanded={openNavGroup===group.id} onClick={()=>setOpenNavGroup(current=>current===group.id?'':group.id)}>
          <span className="nav-group-icon">{group.icon}</span><span>{group.title}</span><span className="nav-group-chevron">⌄</span>
        </button>
        <div className="nav-group-items">{group.items.map(([key,icon,label])=><button key={key} className={`nav-link ${page===key?'active':''}`} onClick={()=>changePage(key)}><span>{icon}</span>{label}</button>)}</div>
      </section>)}
    </nav><div className="sidebar-bottom"><div className="tip-card"><span>🌷</span><b>Pequenos cuidados, grandes momentos.</b><p>Registre cada detalhe da saúde.</p></div><div className="sidebar-foot">Pawly Pocket • Dados neste aparelho</div></div></aside>
    {menuOpen&&<button className="overlay" aria-label="Fechar menu" onClick={()=>setMenuOpen(false)}/>}<main className="main"><header className="topbar"><button className="menu-toggle" onClick={()=>setMenuOpen(v=>!v)} aria-label="Abrir menu">☰</button><div className="crumb">Pawly Pocket <span>/</span> <b>{navGroups.flatMap(group=>group.items).find(item=>item[0]===page)?.[2]|| (page==='home'?'Visão geral':page==='sharing'?'Compartilhar pet':page==='account'?'Conta e nuvem':'Perfil do pet')}</b></div><div className="top-actions"><button className="icon-btn" onClick={toggleDark}>◐</button><div className="top-avatar">🐶</div></div></header><div className="content">{content()}</div><footer className="mobile-foot">Pawly Pocket · Feito para cuidar com carinho 🐾</footer></main>
    {modal&&<div className="modal-backdrop" onClick={()=>setModal('')}><form className="modal-card" onSubmit={saveForm} onClick={e=>e.stopPropagation()}><button type="button" className="modal-close" onClick={()=>setModal('')}>×</button>
      <h2>{modal==='pet'?(form._petId?'Editar pet':'Adicionar pet'):({heat:'Registrar início do cio',vaccine:'Registrar vacina',health:'Registro de saúde',event:'Novo compromisso',reproduction:'Registro reprodutivo',food:'Registrar alimentação',expense:'Registrar despesa'})[modal]}</h2>
      {modal==='pet'?<>
        <label>Nome *<input required value={form.name||''} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/></label>
        <label>Raça<input value={form.breed||''} onChange={e=>setForm(f=>({...f,breed:e.target.value}))}/></label>
        <label>Nascimento<input type="date" value={form.birth||''} onChange={e=>setForm(f=>({...f,birth:e.target.value}))}/></label>
        <label>Peso atual (kg)<input type="number" step="0.1" value={form.weight||''} onChange={e=>setForm(f=>({...f,weight:e.target.value}))}/></label>
        <label>Sexo<select value={form.sex||'Fêmea'} onChange={e=>setForm(f=>({...f,sex:e.target.value}))}><option>Fêmea</option><option>Macho</option></select></label>
        <label>Castrada<select value={form.sterilized||'Não'} onChange={e=>setForm(f=>({...f,sterilized:e.target.value}))}><option>Não</option><option>Sim</option></select></label>
        <label>Microchip<input value={form.microchip||''} onChange={e=>setForm(f=>({...f,microchip:e.target.value}))}/></label>
        <div className="photo-picker"><span className="field-label">Foto do pet</span><div className="photo-picker-actions"><button type="button" className="small-btn" disabled={cameraBusy} onClick={()=>choosePetPhoto('camera')}> {cameraBusy?'Abrindo…':'Tirar foto'}</button><button type="button" className="small-btn" disabled={cameraBusy} onClick={()=>choosePetPhoto('gallery')}>Escolher da galeria</button></div><label className="file-fallback">Ou selecionar arquivo<input id="pet-photo-file" type="file" accept="image/*" capture="environment" onChange={e=>{const file=e.target.files?.[0];if(!file)return;if(file.size>2*1024*1024){alert('Escolha uma imagem de até 2 MB.');e.target.value='';return;}const reader=new FileReader();reader.onload=()=>setForm(f=>({...f,photo:reader.result}));reader.readAsDataURL(file);}}/></label></div>
        {form.photo&&<img className="pet-photo-preview" src={form.photo} alt="Prévia da foto do pet"/>}
        <label>Observações<textarea value={form.notes||''} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}/></label>
      </>:<>
        {modal==='heat'?<label>Data de início *<input required type="date" value={form.start||''} onChange={e=>setForm(f=>({...f,start:e.target.value}))}/></label>:<label>Data *<input required type="date" value={form.date||todayISO()} onChange={e=>setForm(f=>({...f,date:e.target.value}))}/></label>}
        {modal==='vaccine'&&<><label>Nome da vacina *<input required value={form.name||''} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/></label><label>Dose<input value={form.dose||''} onChange={e=>setForm(f=>({...f,dose:e.target.value}))}/></label><label>Próximo reforço<input type="date" value={form.next||''} onChange={e=>setForm(f=>({...f,next:e.target.value}))}/></label><label>Clínica / veterinário<input value={form.vet||''} onChange={e=>setForm(f=>({...f,vet:e.target.value}))}/></label></>}
        {modal==='health'&&<><label>Categoria<select value={form.type||'Consulta'} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>{['Consulta','Medicação','Vermífugo','Antipulgas','Peso','Exame','Outro'].map(x=><option key={x}>{x}</option>)}</select></label><label>Título / nome *<input required value={form.title||''} onChange={e=>setForm(f=>({...f,title:e.target.value}))}/></label><label>Peso (kg)<input type="number" step="0.1" value={form.weight||''} onChange={e=>setForm(f=>({...f,weight:e.target.value}))}/></label></>}
        {modal==='event'&&<><label>Nome do compromisso *<input required value={form.title||''} onChange={e=>setForm(f=>({...f,title:e.target.value}))}/></label><label>Categoria<select value={form.type||'Veterinário'} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>{['Veterinário','Vacina','Vermífugo','Antipulgas','Exame','Outro'].map(x=><option key={x}>{x}</option>)}</select></label></>}
        {modal==='reproduction'&&<label>Tipo de evento<select value={form.type||'Cobertura'} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>{['Cobertura','Gestação confirmada pelo veterinário','Acompanhamento gestacional','Parto','Pós-parto','Filhotes','Outro'].map(x=><option key={x}>{x}</option>)}</select></label>}
        {modal==='food'&&<><label>Refeição / alimento *<input required value={form.food||''} onChange={e=>setForm(f=>({...f,food:e.target.value}))} placeholder="Ex.: Ração para adulto"/></label><label>Tipo<select value={form.type||'Ração'} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>{['Ração','Alimento natural','Petisco','Suplemento','Hidratação','Outro'].map(x=><option key={x}>{x}</option>)}</select></label><label>Quantidade<input value={form.quantity||''} onChange={e=>setForm(f=>({...f,quantity:e.target.value}))} placeholder="Ex.: 120 g"/></label><label>Horário<input type="time" value={form.time||''} onChange={e=>setForm(f=>({...f,time:e.target.value}))}/></label></>}
        {modal==='expense'&&<><label>Descrição *<input required value={form.description||''} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Ex.: Consulta veterinária"/></label><label>Categoria<select value={form.category||'Veterinário'} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>{['Veterinário','Medicamentos','Alimentação','Higiene','Acessórios','Hospedagem','Transporte','Outro'].map(x=><option key={x}>{x}</option>)}</select></label><label>Valor (R$) *<input required type="number" min="0.01" step="0.01" value={form.amount||''} onChange={e=>setForm(f=>({...f,amount:e.target.value}))}/></label><label>Estabelecimento / profissional<input value={form.vendor||''} onChange={e=>setForm(f=>({...f,vendor:e.target.value}))}/></label><label>Forma de pagamento<select value={form.payment||'Pix'} onChange={e=>setForm(f=>({...f,payment:e.target.value}))}>{['Pix','Dinheiro','Débito','Crédito','Transferência','Outro'].map(x=><option key={x}>{x}</option>)}</select></label></>}
        {modal!=='heat'&&<label className="repeat-check"><input type="checkbox" checked={!!form.repeatEnabled} onChange={e=>setForm(f=>({...f,repeatEnabled:e.target.checked,repeatEvery:f.repeatEvery||'1'}))}/> Repetir lembrete</label>}
        {modal!=='heat'&&form.repeatEnabled&&<label>Frequência<select value={form.repeatEvery||'1'} onChange={e=>setForm(f=>({...f,repeatEvery:e.target.value}))}><option value="1">Mensal</option><option value="3">Trimestral</option><option value="6">A cada 6 meses</option></select></label>}
        <label>Observações<textarea value={form.notes||''} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}/></label>
      </>}
      <button className="btn btn-primary">Salvar {modal==='pet'?'perfil':'registro'}</button>
    </form></div>}
  </div>;
}
export default App;
