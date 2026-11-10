import React, { useMemo, useState } from 'react';

const STORAGE_KEY = 'petal_data_v1';
const blankPet = () => ({ id: crypto.randomUUID(), profile: { name: 'Minha pet', breed: '', birth: '', sex: 'Fêmea', weight: '', notes: '', photo: '', sterilized: 'Não' }, vaccines: [], heat: [], health: [], reproduction: [], events: [] });
function readStore() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (Array.isArray(raw.pets) && raw.pets.length) return { ...raw, pets: raw.pets.map(p => ({ ...blankPet(), ...p, profile: { ...blankPet().profile, ...(p.profile || {}) } })), activePetId: raw.activePetId || raw.pets[0].id };
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
  ['customize','◐','Personalizar'],['backup','⇧','Backup e dados']
];
const date = value => value ? new Date(value + 'T12:00:00').toLocaleDateString('pt-BR') : '—';
const daysBetween = value => Math.floor((new Date().setHours(0,0,0,0) - new Date(value+'T12:00:00').getTime()) / 86400000);
function Card({title, children, action}) { return <section className="panel"><div className="panel-head"><h3>{title}</h3>{action}</div>{children}</section>; }
function App() {
  const [store, setStore] = useState(readStore);
  const [page, setPage] = useState('home');
  const [menuOpen, setMenuOpen] = useState(false);
  const [modal, setModal] = useState('');
  const [form, setForm] = useState({});
  const [dark, setDark] = useState(localStorage.getItem('pawly_theme') === 'dark');
  const pet = store.pets.find(p => p.id === store.activePetId) || store.pets[0];
  const profile = pet.profile || {};
  const updatePet = updater => setStore(current => {
    const next = { ...current, pets: current.pets.map(p => p.id === pet.id ? updater(p) : p) };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  });
  const heat = [...(pet.heat || [])].filter(x => x.start).sort((a,b) => b.start.localeCompare(a.start));
  const lastHeat = heat[0];
  const elapsed = lastHeat ? Math.max(0, daysBetween(lastHeat.start)) : null;
  const intervals = heat.slice().reverse().slice(1).map((x,i,arr) => Math.round((new Date(heat.slice().reverse()[i+1].start+'T12:00:00') - new Date(x.start+'T12:00:00')) / 86400000)).filter(n => n >= 90 && n <= 500);\n  const interval = intervals.length ? Math.round(intervals.reduce((a,b)=>a+b,0)/intervals.length) : Math.min(500,Math.max(90,Number(pet.heatIntervalDays)||180));
  const nextHeat = lastHeat ? new Date(new Date(lastHeat.start+'T12:00:00').getTime() + interval*86400000) : null;
  const remaining = nextHeat ? Math.ceil((nextHeat.getTime() - new Date().setHours(0,0,0,0))/86400000) : null;
  const upcoming = useMemo(() => [...(pet.events||[]), ...(pet.vaccines||[]).filter(x=>x.next).map(x=>({id:x.id,title:x.name,date:x.next,type:'Vacina'}))].filter(x=>x.date).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,5), [pet]);
  const openForm = type => { setForm({date:new Date().toISOString().slice(0,10)}); setModal(type); };
  const saveForm = e => {
    e.preventDefault();
    const entry = { ...form, id: crypto.randomUUID() };
    const key = modal === 'heat' ? 'heat' : modal === 'vaccine' ? 'vaccines' : modal === 'health' ? 'health' : modal === 'event' ? 'events' : 'reproduction';
    updatePet(p => ({ ...p, [key]: [...(p[key]||[]), entry] }));
    setModal('');
  };
  const changePage = key => { setPage(key); setMenuOpen(false); };
  const toggleDark = () => setDark(v => { localStorage.setItem('pawly_theme', v ? 'light' : 'dark'); return !v; });
  const addPet = () => { const p=blankPet(); setStore(s=>{const next={...s,pets:[...s.pets,p],activePetId:p.id};localStorage.setItem(STORAGE_KEY,JSON.stringify(next));return next;}); };
  const exportData = () => { const blob=new Blob([JSON.stringify(store,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='pawly-pocket-backup.json';a.click();URL.revokeObjectURL(url); };
  const content = () => {
    if (page === 'home') return <>
      <div className="page-heading"><div><span className="eyebrow">SEU ESPAÇO DE CUIDADO</span><h1>Olá! 💚</h1><p>Tudo organizado para acompanhar a saúde de {profile.name || 'sua pet'}.</p></div><button className="btn btn-primary" onClick={()=>openForm('health')}>+ Novo registro</button></div>
      <div className="welcome"><div><div className="eyebrow">UM DIA DE CADA VEZ</div><h2>Mais cuidado, menos preocupação.</h2><p>Guarde vacinas, consultas, ciclos e momentos importantes. Seus dados ficam salvos neste aparelho.</p></div><div className="welcome-art">🐕‍🦺</div></div>
      <div className="stats"><div className="stat"><div className="stat-top">Vacinas registradas</div><strong>{pet.vaccines?.length||0}</strong><small>No histórico</small></div><div className="stat"><div className="stat-top">Registros de saúde</div><strong>{pet.health?.length||0}</strong><small>Consultas e cuidados</small></div><div className="stat"><div className="stat-top">Ciclos registrados</div><strong>{pet.heat?.length||0}</strong><small>Histórico de cio</small></div><div className="stat"><div className="stat-top">Próximos compromissos</div><strong>{upcoming.length}</strong><small>Datas cadastradas</small></div></div>
      <Card title="Controle de cio">{lastHeat ? <div className="heat-overview-card"><div><small>Desde o último início registrado</small><strong>{elapsed} dias</strong></div><div><small>Próximo cio estimado</small><b>{date(nextHeat.toISOString().slice(0,10))}</b><span>{remaining >= 0 ? 'Estimativa em '+remaining+' dias' : Math.abs(remaining)+' dias após a estimativa'}</span></div><button className="btn btn-soft" onClick={()=>changePage('heat')}>Ver acompanhamento →</button><small className="notice">Estimativa aproximada, não indica ovulação ou período fértil.</small></div> : <div className="heat-overview-empty"><b>Nenhum ciclo registrado</b><p>Registre a data de início para acompanhar os dias e consultar uma estimativa.</p><button className="btn btn-soft" onClick={()=>openForm('heat')}>Registrar início</button></div>}</Card>
      <div className="dashboard-grid"><div><Card title="Próximos cuidados">{upcoming.length ? upcoming.map(x=><div className="list-row" key={x.id}><b>{x.title||x.name||x.type}</b><span>{date(x.date)}</span></div>) : <p className="muted">Nenhum compromisso cadastrado.</p>}</Card><Card title="Acesso rápido"><div className="quick-actions"><button onClick={()=>openForm('vaccine')}>♡ Registrar vacina</button><button onClick={()=>openForm('heat')}>◉ Registrar cio</button><button onClick={()=>openForm('health')}>✚ Anotar consulta</button></div></Card></div><Card title="Perfil da pet"><div className="pet-profile"><div className="pet-avatar-large">{profile.photo?<img src={profile.photo}/>: '🐶'}</div><div><b>{profile.name||'Minha pet'}</b><p>{profile.breed||'Raça não informada'}</p></div></div><p>Nascimento: <b>{date(profile.birth)}</b></p><p>Peso atual: <b>{profile.weight ? profile.weight+' kg' : '—'}</b></p><button className="btn btn-soft" onClick={()=>changePage('profile')}>Editar perfil</button></Card></div>
    </>;
    if (page === 'heat') return <><div className="page-heading"><div><span className="eyebrow">CICLO REPRODUTIVO</span><h1>Controle de cio</h1><p>Acompanhe os dias desde o início e consulte uma estimativa do próximo ciclo.</p></div><button className="btn btn-primary" onClick={()=>openForm('heat')}>+ Registrar ciclo</button></div>{lastHeat&&<Card title="Acompanhamento do ciclo"><div className="stats"><div className="stat"><small>Último início</small><strong>{date(lastHeat.start)}</strong></div><div className="stat"><small>Dias decorridos</small><strong>{elapsed}</strong></div><div className="stat"><small>Próximo estimado</small><strong>{date(nextHeat.toISOString().slice(0,10))}</strong></div></div></Card>}<Card title="Histórico de ciclos">{heat.length ? heat.map(x=><div className="list-row" key={x.id}><div><b>{date(x.start)}</b><p>{x.notes||'Sem observações'}</p></div><button className="small-btn" onClick={()=>updatePet(p=>({...p,heat:p.heat.filter(y=>y.id!==x.id)}))}>Excluir</button></div>) : <p className="muted">Nenhum ciclo registrado ainda.</p>}</Card><Card title="Intervalo de referência"><p>Intervalo usado apenas para estimar o próximo ciclo.</p><input aria-label="Intervalo em dias" type="number" min="90" max="500" value={interval} onChange={e=>updatePet(p=>({...p,heatIntervalDays:Number(e.target.value)}))}/> dias</Card><p className="notice">A previsão é aproximada e não indica ovulação ou período fértil. Confirme dúvidas com o médico-veterinário.</p></>;
    if (page === 'vaccines' || page === 'health' || page === 'reproduction' || page === 'calendar') {
      const config = {vaccines:['Carteira de vacinação','Acompanhe aplicações, doses e datas de reforço.','vaccine',pet.vaccines||[]],health:['Saúde e histórico','Consultas, medicamentos, peso e observações.','health',pet.health||[]],reproduction:['Reprodução','Coberturas, gestações, partos e filhotes.','reproduction',pet.reproduction||[]],calendar:['Calendário de cuidados','Organize compromissos e lembretes.','event',pet.events||[]]}[page];
      return <><div className="page-heading"><div><span className="eyebrow">PAWLY POCKET</span><h1>{config[0]}</h1><p>{config[1]}</p></div><button className="btn btn-primary" onClick={()=>openForm(config[2])}>+ Adicionar</button></div><Card title="Registros">{config[3].length ? config[3].map(x=><div className="list-row" key={x.id}><div><b>{x.name||x.title||x.type||'Registro'}</b><p>{date(x.date||x.start)} {x.notes?'· '+x.notes:''}</p></div><button className="small-btn" onClick={()=>updatePet(p=>({...p,[page]:p[page].filter(y=>y.id!==x.id)}))}>Excluir</button></div>) : <p className="muted">Nenhum registro cadastrado.</p>}</Card></>;
    }
    if (page === 'profile') return <><div className="page-heading"><div><span className="eyebrow">CADASTRO</span><h1>Perfil da pet</h1><p>Informações básicas da sua companheira.</p></div></div><Card title="Dados do pet"><form className="form-grid" onSubmit={e=>{e.preventDefault();updatePet(p=>({...p,profile:{...p.profile,...form}}));setForm({});}}>{['name','breed','birth','weight','sex','sterilized','notes'].map(k=><label key={k}>{({name:'Nome',breed:'Raça',birth:'Nascimento',weight:'Peso (kg)',sex:'Sexo',sterilized:'Castrada',notes:'Observações'})[k]}<input type={k==='birth'?'date':'text'} value={form[k]??profile[k]??''} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))}/></label>)}<button className="btn btn-primary">Salvar perfil</button></form></Card></>;
    if (page === 'customize') return <><div className="page-heading"><div><span className="eyebrow">PREFERÊNCIAS</span><h1>Personalizar</h1><p>Ajuste a aparência do Pawly Pocket.</p></div></div><Card title="Aparência"><button className="btn btn-soft" onClick={toggleDark}>Alternar para modo {dark?'claro':'escuro'}</button></Card></>;
    if (page === 'backup') return <><div className="page-heading"><div><span className="eyebrow">SEUS DADOS</span><h1>Backup e dados</h1><p>Exporte uma cópia dos registros deste dispositivo.</p></div></div><Card title="Backup"><button className="btn btn-primary" onClick={exportData}>Exportar backup JSON</button><p className="notice">Os documentos anexados em IndexedDB ainda precisarão de uma etapa própria de migração/exportação.</p></Card></>;
    return <Card title="Em migração"><p>Esta área será portada para React na próxima etapa.</p></Card>;
  };
  return <div className={`app-shell ${dark?'theme-dark':''}`}>
    <aside className={`sidebar ${menuOpen?'open':''}`}><a className="brand" href="#" onClick={e=>{e.preventDefault();changePage('home')}}><span className="brand-mark">🐾</span><span><b>Pawly Pocket</b><small>Seu pet. Sua vida. Tudo no bolso.</small></span></a><div className="pet-mini"><div className="pet-avatar">{profile.photo?<img src={profile.photo}/>: '🐶'}</div><div><b>{profile.name||'Minha pet'}</b><small>Perfil da pet</small></div><select aria-label="Selecionar pet" value={pet.id} onChange={e=>setStore(s=>{const n={...s,activePetId:e.target.value};localStorage.setItem(STORAGE_KEY,JSON.stringify(n));return n;})}>{store.pets.map(p=><option key={p.id} value={p.id}>{p.profile?.name||'Pet'}</option>)}</select><button className="small-btn" onClick={addPet}>+</button></div><div className="nav-label">MENU PRINCIPAL</div><nav className="nav">{nav.map(([key,icon,label])=><button key={key} className={`nav-link ${page===key?'active':''}`} onClick={()=>changePage(key)}><span>{icon}</span>{label}</button>)}<button className={`nav-link ${page==='profile'?'active':''}`} onClick={()=>changePage('profile')}><span>♙</span>Perfil do pet</button></nav><div className="sidebar-bottom"><div className="tip-card"><span>🌷</span><b>Pequenos cuidados, grandes momentos.</b><p>Registre cada detalhe da saúde.</p></div><div className="sidebar-foot">Pawly Pocket • Dados neste aparelho</div></div></aside>
    {menuOpen&&<button className="overlay" aria-label="Fechar menu" onClick={()=>setMenuOpen(false)}/>}<main className="main"><header className="topbar"><button className="menu-toggle" onClick={()=>setMenuOpen(v=>!v)} aria-label="Abrir menu">☰</button><div className="crumb">Pawly Pocket <span>/</span> <b>{nav.find(x=>x[0]===page)?.[2]||'Perfil do pet'}</b></div><div className="top-actions"><button className="icon-btn" onClick={toggleDark}>◐</button><div className="top-avatar">🐶</div></div></header><div className="content">{content()}</div><footer className="mobile-foot">Pawly Pocket · Feito para cuidar com carinho 🐾</footer></main>
    {modal&&<div className="modal-backdrop" onClick={()=>setModal('')}><form className="modal-card" onSubmit={saveForm} onClick={e=>e.stopPropagation()}><button type="button" className="modal-close" onClick={()=>setModal('')}>×</button><h2>{({heat:'Registrar início do cio',vaccine:'Registrar vacina',health:'Registro de saúde',event:'Novo compromisso',reproduction:'Registro reprodutivo'})[modal]}</h2><label>{modal==='heat'?'Data de início':'Data'}<input required type="date" value={form.start||form.date||''} onChange={e=>setForm(f=>({...f,[modal==='heat'?'start':'date']:e.target.value}))}/></label>{modal!=='heat'&&<label>Nome / tipo<input required value={form.name||form.title||form.type||''} onChange={e=>setForm(f=>({...f,[modal==='health'?'title':'name']:e.target.value}))}/></label>}<label>Observações<textarea value={form.notes||''} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}/></label><button className="btn btn-primary">Salvar registro</button></form></div>}
  </div>;
}
export default App;
