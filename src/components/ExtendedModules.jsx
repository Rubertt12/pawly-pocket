import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';

const today = () => new Date().toISOString().slice(0,10);
const fmtDate = value => value ? new Date(value+'T12:00:00').toLocaleDateString('pt-BR') : '—';
const makeId = () => crypto.randomUUID();
const emptyDraft = page => ({
  date: today(),
  status: 'Em andamento',
  category: page === 'care' ? 'Banho' : 'Consulta',
  repeatEvery: '1',
  active: true
});
const csvCell = value => '"' + String(value ?? '').replace(/"/g,'""') + '"';

async function compressPhoto(file) {
  if (!file || !file.type.startsWith('image/')) return '';
  const source = await new Promise((resolve,reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  const image = await new Promise((resolve,reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = source;
  });
  const scale = Math.min(1, 1100 / Math.max(image.width,image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
  return canvas.toDataURL('image/jpeg',0.76);
}

function Panel({title,children,action}) {
  return <section className="panel"><div className="panel-head"><h3>{title}</h3>{action}</div>{children}</section>;
}

export default function ExtendedModules({page,pet,updatePet,tutorEmail=''}) {
  const profile = pet?.profile || {};
  const [draft,setDraft] = useState(emptyDraft(page));
  const [editing,setEditing] = useState('');
  const [qr,setQr] = useState('');
  const [photoBusy,setPhotoBusy] = useState(false);
  const [notice,setNotice] = useState('');
  const medications = pet?.medications || [];
  const care = pet?.care || [];
  const vets = pet?.veterinary || [];
  const memories = pet?.memories || [];
  const [cardProfile,setCardProfile] = useState({
    species:profile.species||'Cão',
    guardianPhone:profile.guardianPhone||'',
    emergencyContact:profile.emergencyContact||'',
    medicalAlerts:profile.medicalAlerts||''
  });

  const cardText = useMemo(() => [
    'PAWLY POCKET · CARTEIRINHA DO PET',
    'Nome: '+(profile.name||'Não informado'),
    'Espécie: '+(profile.species||'Cão'),
    'Raça: '+(profile.breed||'Não informada'),
    'Sexo: '+(profile.sex||'Não informado'),
    'Nascimento: '+fmtDate(profile.birth),
    'Microchip: '+(profile.microchip||'Não informado'),
    'Tutor: '+(tutorEmail||'Não informado'),
    'Contato: '+(profile.guardianPhone||'Não informado'),
    'Emergência: '+(profile.emergencyContact||'Não informado'),
    'Alertas de saúde: '+(profile.medicalAlerts||'Nenhum informado')
  ].join('\n'),[profile,tutorEmail]);

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(cardText,{width:260,margin:2,errorCorrectionLevel:'M',color:{dark:'#294638',light:'#FFFFFF'}})
      .then(value=>{if(active)setQr(value);})
      .catch(()=>{if(active)setQr('');});
    return ()=>{active=false;};
  },[cardText]);

  const updateList = (key,item,id) => updatePet(current => ({
    ...current,
    [key]: id
      ? (current[key]||[]).map(row=>row.id===id?{...item,id}:row)
      : [...(current[key]||[]),{...item,id:makeId()}]
  }));
  const removeItem = (key,id) => {
    if (!window.confirm('Excluir este registro?')) return;
    updatePet(current=>({...current,[key]:(current[key]||[]).filter(row=>row.id!==id)}));
  };
  const startEdit = (item) => {
    setEditing(item.id);
    setDraft({...item});
    setNotice('');
  };
  const resetForm = () => {
    setEditing('');
    setDraft(emptyDraft(page));
    setNotice('');
  };
  const submit = event => {
    event.preventDefault();
    const key = page === 'medications' ? 'medications' : 'care';
    const item = {...draft,updatedAt:new Date().toISOString()};
    updateList(key,item,editing);
    resetForm();
    setNotice('Registro salvo.');
  };
  const exportCsv = () => {
    const rows = [
      ['Data','Categoria','Registro','Detalhes'],
      ...(pet.vaccines||[]).map(x=>[x.date,'Vacina',x.name,x.notes]),
      ...(pet.health||[]).map(x=>[x.date,x.type,x.title,x.notes]),
      ...(medications||[]).map(x=>[x.start,'Medicamento',x.name,[x.dose,x.frequency,x.status,x.notes].filter(Boolean).join(' · ')]),
      ...(care||[]).map(x=>[x.date,'Higiene',x.title,[x.category,x.notes].filter(Boolean).join(' · ')]),
      ...(pet.events||[]).map(x=>[x.date,'Compromisso',x.title,x.notes]),
      ...(pet.feeding||[]).map(x=>[x.date,'Alimentação',x.food,x.notes]),
      ...(pet.expenses||[]).map(x=>[x.date,'Despesa',x.description,x.amount]),
      ...(memories||[]).map(x=>[x.date,'Memória',x.title,x.notes])
    ];
    const csv = '\uFEFF'+rows.map(row=>row.map(csvCell).join(';')).join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download='pawly-relatorio-'+(profile.name||'pet').toLowerCase().replace(/[^a-z0-9]+/g,'-')+'.csv';a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
  };
  const printReport = () => window.print();
  const shareCard = async () => {
    try {
      if (navigator.share) await navigator.share({title:'Carteirinha de '+(profile.name||'pet'),text:cardText});
      else {await navigator.clipboard.writeText(cardText);setNotice('Dados da carteirinha copiados.');}
    } catch {}
  };

  if (page === 'medications' || page === 'care') {
    const isMedication = page === 'medications';
    const key = isMedication ? 'medications' : 'care';
    const entries = [...(isMedication?medications:care)].sort((a,b)=>(b.start||b.date||'').localeCompare(a.start||a.date||''));
    const activeCount = isMedication ? entries.filter(x=>x.status!=='Concluído').length : entries.filter(x=>x.next && x.next>=today()).length;
    return <>
      <div className="page-heading"><div><span className="eyebrow">{isMedication?'TRATAMENTOS E PRESCRIÇÕES':'ROTINA DE BEM-ESTAR'}</span><h1>{isMedication?'Medicamentos e tratamentos':'Higiene e cuidados'}</h1><p>{isMedication?'Organize prescrições, doses, duração e próximos horários do tratamento.':'Acompanhe banho, tosa, unhas, ouvidos, dentes e prevenção.'}</p></div></div>
      <div className="record-summary"><div className="record-summary-item"><span>{isMedication?'Tratamentos ativos':'Próximos cuidados'}</span><strong>{activeCount}</strong></div><div className="record-summary-item"><span>Total registrado</span><strong>{entries.length}</strong></div><div className="record-summary-item"><span>Pet</span><strong>{profile.name||'Meu pet'}</strong></div></div>
      <Panel title={editing?'Editar registro':'Adicionar registro'}>
        <form className="form-grid extended-form" onSubmit={submit}>
          {isMedication ? <>
            <label>Medicamento / tratamento *<input required value={draft.name||''} onChange={e=>setDraft(v=>({...v,name:e.target.value}))} placeholder="Ex.: Antibiótico"/></label>
            <label>Dosagem prescrita<input value={draft.dose||''} onChange={e=>setDraft(v=>({...v,dose:e.target.value}))} placeholder="Ex.: 1 comprimido / 5 ml"/></label>
            <label>Via de administração<select value={draft.route||'Oral'} onChange={e=>setDraft(v=>({...v,route:e.target.value}))}>{['Oral','Tópica','Oftálmica','Auricular','Injetável','Outra'].map(x=><option key={x}>{x}</option>)}</select></label>
            <label>Frequência<input value={draft.frequency||''} onChange={e=>setDraft(v=>({...v,frequency:e.target.value}))} placeholder="Ex.: a cada 12 horas"/></label>
            <label>Início<input type="date" value={draft.start||today()} onChange={e=>setDraft(v=>({...v,start:e.target.value}))}/></label>
            <label>Fim previsto<input type="date" value={draft.end||''} onChange={e=>setDraft(v=>({...v,end:e.target.value}))}/></label>
            <label>Próxima dose / lembrete<input type="datetime-local" value={draft.next||''} onChange={e=>setDraft(v=>({...v,next:e.target.value}))}/></label>
            <label>Status<select value={draft.status||'Em andamento'} onChange={e=>setDraft(v=>({...v,status:e.target.value}))}>{['Em andamento','Pausado','Concluído'].map(x=><option key={x}>{x}</option>)}</select></label>
            <label>Veterinário responsável<input value={draft.vet||''} onChange={e=>setDraft(v=>({...v,vet:e.target.value}))}/></label>
          </> : <>
            <label>Tipo de cuidado *<select value={draft.category||'Banho'} onChange={e=>setDraft(v=>({...v,category:e.target.value}))}>{['Banho','Tosa','Corte de unhas','Escovação dental','Limpeza de ouvidos','Antipulgas','Vermífugo','Hidratação da pele','Outro'].map(x=><option key={x}>{x}</option>)}</select></label>
            <label>Descrição *<input required value={draft.title||''} onChange={e=>setDraft(v=>({...v,title:e.target.value}))} placeholder="Ex.: Banho no pet shop"/></label>
            <label>Data do último cuidado<input type="date" value={draft.date||today()} onChange={e=>setDraft(v=>({...v,date:e.target.value}))}/></label>
            <label>Próxima data<input type="date" value={draft.next||''} onChange={e=>setDraft(v=>({...v,next:e.target.value}))}/></label>
            <label>Profissional / estabelecimento<input value={draft.professional||''} onChange={e=>setDraft(v=>({...v,professional:e.target.value}))}/></label>
            <label className="repeat-check"><input type="checkbox" checked={!!draft.repeatEnabled} onChange={e=>setDraft(v=>({...v,repeatEnabled:e.target.checked}))}/> Repetir lembrete</label>
            <label>Intervalo em meses<select value={draft.repeatEvery||'1'} onChange={e=>setDraft(v=>({...v,repeatEvery:e.target.value}))}><option value="1">Mensal</option><option value="2">A cada 2 meses</option><option value="3">Trimestral</option><option value="6">Semestral</option><option value="12">Anual</option></select></label>
          </>}
          <label className="extended-full">Observações<textarea value={draft.notes||''} onChange={e=>setDraft(v=>({...v,notes:e.target.value}))} placeholder="Orientações, reações observadas ou detalhes importantes"/></label>
          <div className="extended-actions"><button className="btn btn-primary">{editing?'Salvar alterações':'Adicionar registro'}</button>{editing&&<button type="button" className="btn btn-soft" onClick={resetForm}>Cancelar</button>}</div>
        </form>
      </Panel>
      <Panel title="Histórico de registros">{entries.length?entries.map(item=><article className="record-card" key={item.id}><div className="record-card-main"><div className="record-card-title"><b>{isMedication?item.name:item.title}</b><span className={'record-status '+(item.status==='Concluído'?'ok':'')}>{isMedication?(item.status||'Em andamento'):(item.category||'Cuidado')}</span></div><p>{isMedication?'Início: '+fmtDate(item.start)+' · Fim: '+fmtDate(item.end):'Último cuidado: '+fmtDate(item.date)+' · Próximo: '+fmtDate(item.next)}</p><div className="record-details">{isMedication?<><span>Dosagem: {item.dose||'—'}</span><span>Frequência: {item.frequency||'—'}</span><span>Via: {item.route||'—'}</span>{item.vet&&<span>Veterinário: {item.vet}</span>}</>:<>{item.professional&&<span>Profissional: {item.professional}</span>}{item.repeatEnabled&&<span>Recorrência: a cada {item.repeatEvery||1} mês(es)</span>}</>}</div>{item.notes&&<p>{item.notes}</p>}</div><div className="actions"><button className="small-btn" onClick={()=>startEdit(item)}>Editar</button><button className="small-btn" onClick={()=>removeItem(key,item.id)}>Excluir</button></div></article>):<div className="empty-state"><span>{isMedication?'💊':'🛁'}</span><b>Nenhum registro por enquanto</b><p>Adicione o primeiro para manter o histórico do cuidado organizado.</p></div>}</Panel>
      <p className="notice">O Pawly organiza as informações; dose, frequência, duração e interrupção de medicamentos devem seguir a prescrição do médico-veterinário. Os lembretes não substituem a orientação profissional.</p>
      {notice&&<p className="notice" role="status">{notice}</p>}
    </>;
  }

  if (page === 'veterinary') {
    const saveVet = e => {e.preventDefault();const form=new FormData(e.currentTarget);const item={id:makeId(),name:form.get('name'),clinic:form.get('clinic'),specialty:form.get('specialty'),phone:form.get('phone'),email:form.get('email'),address:form.get('address'),notes:form.get('notes'),primary:form.get('primary')==='on'};updatePet(p=>({...p,veterinary:[...(p.veterinary||[]),item]}));e.currentTarget.reset();};
    return <><div className="page-heading"><div><span className="eyebrow">REDE DE CUIDADO</span><h1>Veterinários e clínicas</h1><p>Tenha os contatos importantes do cuidado do seu pet em um só lugar.</p></div></div><Panel title="Adicionar profissional"><form className="form-grid extended-form" onSubmit={saveVet}><label>Nome do veterinário *<input name="name" required placeholder="Nome completo"/></label><label>Clínica / hospital<input name="clinic" placeholder="Nome do estabelecimento"/></label><label>Especialidade<input name="specialty" placeholder="Ex.: Clínica geral"/></label><label>Telefone<input name="phone" type="tel" placeholder="(00) 00000-0000"/></label><label>E-mail<input name="email" type="email" placeholder="contato@clinica.com"/></label><label>Endereço<input name="address" placeholder="Rua, número, cidade"/></label><label className="extended-full">Observações<textarea name="notes" placeholder="Horários, instruções de atendimento..."/></label><label className="repeat-check"><input type="checkbox" name="primary"/> Marcar como contato principal</label><button className="btn btn-primary">Salvar contato</button></form></Panel><Panel title="Contatos cadastrados">{vets.length?vets.map(v=><article className="record-card" key={v.id}><div className="record-card-main"><div className="record-card-title"><b>{v.name}</b>{v.primary&&<span className="record-status ok">Principal</span>}</div><p>{[v.specialty,v.clinic].filter(Boolean).join(' · ')||'Profissional veterinário'}</p><div className="record-details">{v.phone&&<a href={'tel:'+v.phone}>{v.phone}</a>}{v.email&&<a href={'mailto:'+v.email}>{v.email}</a>}{v.address&&<span>{v.address}</span>}</div>{v.notes&&<p>{v.notes}</p>}</div><div className="actions"><button className="small-btn" onClick={()=>{if(confirm('Excluir este contato?'))updatePet(p=>({...p,veterinary:(p.veterinary||[]).filter(x=>x.id!==v.id)}));}}>Excluir</button></div></article>):<div className="empty-state"><span>⚕️</span><b>Cadastre seu veterinário</b><p>Guarde telefone, endereço e especialidade para encontrar rapidamente quando precisar.</p></div>}</Panel></>;
  }

  if (page === 'memories') {
    const saveMemory = async e => {e.preventDefault();const form=new FormData(e.currentTarget);const file=form.get('photo');let photo='';try{if(file?.size){if(file.size>12*1024*1024)throw new Error('Escolha uma foto de até 12 MB.');setPhotoBusy(true);photo=await compressPhoto(file);}}catch(error){setNotice(error.message||'Não foi possível processar a foto.');setPhotoBusy(false);return;}const item={id:makeId(),title:form.get('title'),date:form.get('date')||today(),notes:form.get('notes'),photo};updatePet(p=>({...p,memories:[...(p.memories||[]),item]}));e.currentTarget.reset();setPhotoBusy(false);setNotice('Memória adicionada ao álbum.');};
    return <><div className="page-heading"><div><span className="eyebrow">MOMENTOS ESPECIAIS</span><h1>Memórias e fotos</h1><p>Um álbum para guardar pequenas conquistas e grandes momentos.</p></div></div><Panel title="Adicionar memória"><form className="form-grid extended-form" onSubmit={saveMemory}><label>Título do momento *<input name="title" required placeholder="Ex.: Primeiro passeio no parque"/></label><label>Data<input name="date" type="date" defaultValue={today()}/></label><label className="extended-full">Legenda / história<textarea name="notes" placeholder="Conte o que aconteceu nesse dia..."/></label><label className="extended-full">Foto (opcional)<input name="photo" type="file" accept="image/*"/></label><button className="btn btn-primary" disabled={photoBusy}>{photoBusy?'Preparando foto...':'Guardar memória'}</button></form></Panel><div className="memory-grid">{[...memories].sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map(m=><article className="memory-card" key={m.id}>{m.photo?<img src={m.photo} alt={m.title}/>:<div className="memory-placeholder">♡</div>}<div><small>{fmtDate(m.date)}</small><h3>{m.title}</h3>{m.notes&&<p>{m.notes}</p>}<button className="small-btn" onClick={()=>removeItem('memories',m.id)}>Excluir memória</button></div></article>)}</div>{!memories.length&&<div className="empty-state"><span>📷</span><b>Seu álbum começa com uma lembrança</b><p>Registre fotos, passeios, conquistas e momentos importantes.</p></div>}{notice&&<p className="notice" role="status">{notice}</p>}<p className="notice">As fotos são compactadas antes de salvar. Como ficam vinculadas ao perfil, muitas imagens podem aumentar o tamanho dos dados sincronizados e do backup.</p></>;
  }

  if (page === 'reports') {
    const all = [
      ...(pet.vaccines||[]).map(x=>({date:x.date,category:'Vacina',title:x.name})),
      ...(pet.health||[]).map(x=>({date:x.date,category:x.type||'Saúde',title:x.title})),
      ...medications.map(x=>({date:x.start,category:'Medicamento',title:x.name})),
      ...care.map(x=>({date:x.date,category:'Higiene',title:x.title})),
      ...(pet.events||[]).map(x=>({date:x.date,category:'Compromisso',title:x.title})),
      ...(pet.feeding||[]).map(x=>({date:x.date,category:'Alimentação',title:x.food})),
      ...(pet.expenses||[]).map(x=>({date:x.date,category:'Despesa',title:x.description})),
      ...memories.map(x=>({date:x.date,category:'Memória',title:x.title}))
    ];
    const totalExpenses=(pet.expenses||[]).reduce((sum,x)=>sum+(Number(x.amount)||0),0);
    const money=value=>Number(value||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
    const groups=Object.entries(all.reduce((acc,row)=>{acc[row.category]=(acc[row.category]||0)+1;return acc;},{})).sort((a,b)=>b[1]-a[1]);
    return <><div className="page-heading"><div><span className="eyebrow">VISÃO CONSOLIDADA</span><h1>Relatórios do pet</h1><p>Resumo dos cuidados, histórico e despesas de {profile.name||'seu pet'}.</p></div><div className="actions"><button className="btn btn-soft" onClick={exportCsv}>Exportar CSV</button><button className="btn btn-primary" onClick={printReport}>Imprimir / PDF</button></div></div><div className="record-summary"><div className="record-summary-item"><span>Registros totais</span><strong>{all.length}</strong></div><div className="record-summary-item"><span>Vacinas</span><strong>{(pet.vaccines||[]).length}</strong></div><div className="record-summary-item"><span>Tratamentos</span><strong>{medications.length}</strong></div><div className="record-summary-item"><span>Despesas acumuladas</span><strong>{money(totalExpenses)}</strong></div></div><Panel title="Distribuição por categoria">{groups.length?groups.map(([name,count])=><div className="report-bar-row" key={name}><span>{name}</span><div><i style={{width:(count/Math.max(...groups.map(x=>x[1]))*100)+'%'}}/></div><b>{count}</b></div>):<p className="muted">Ainda não há registros suficientes para montar o relatório.</p>}</Panel><Panel title="Atividade recente">{all.sort((a,b)=>(b.date||'').localeCompare(a.date||'')).slice(0,12).map((x,i)=><div className="list-row" key={i}><div><small>{x.category} · {fmtDate(x.date)}</small><b>{x.title||'Registro'}</b></div></div>)}</Panel><p className="notice">O relatório reúne os registros cadastrados no Pawly. Não substitui prontuário ou avaliação clínica do médico-veterinário.</p></>;
  }

  if (page === 'pet-card') {
    const saveCardProfile = e => {e.preventDefault();updatePet(p=>({...p,profile:{...p.profile,...cardProfile}}));setNotice('Dados da carteirinha atualizados.');};
    return <><div className="page-heading"><div><span className="eyebrow">IDENTIFICAÇÃO</span><h1>Carteirinha digital</h1><p>Uma ficha rápida para apresentar os dados essenciais do pet.</p></div><button className="btn btn-primary" onClick={()=>window.print()}>Imprimir carteirinha</button></div><div className="pet-id-layout"><section className="pet-id-card"><div className="pet-id-brand"><span>🐾</span><b>Pawly Pocket</b></div><div className="pet-id-main"><div className="pet-id-avatar">{profile.photo?<img src={profile.photo} alt=""/>:'🐶'}</div><div><h2>{profile.name||'Nome do pet'}</h2><p>{profile.species||'Cão'} · {profile.breed||'Raça não informada'}</p><small>{profile.sex||'Sexo não informado'} · {pet?.profile?.birth?fmtDate(profile.birth):'Nascimento não informado'}</small></div></div><div className="pet-id-details"><span><small>MICROCHIP</small><b>{profile.microchip||'Não informado'}</b></span><span><small>TUTOR</small><b>{tutorEmail||'Não informado'}</b></span><span><small>CONTATO</small><b>{profile.guardianPhone||'Não informado'}</b></span><span><small>EMERGÊNCIA</small><b>{profile.emergencyContact||'Não informado'}</b></span></div>{profile.medicalAlerts&&<div className="pet-id-alert"><b>Alertas de saúde</b><p>{profile.medicalAlerts}</p></div>}<div className="pet-id-footer">Identificação digital · Confira os dados antes de compartilhar</div></section><section className="pet-id-side"><div className="qr-wrap">{qr?<img src={qr} alt="QR Code da carteirinha digital"/>:<span>Gerando QR Code…</span>}<b>Escaneie para ler a ficha</b><small>O QR Code é gerado no aparelho e contém os dados exibidos na carteirinha.</small></div><button className="btn btn-soft" onClick={shareCard}>Compartilhar dados</button></section></div><Panel title="Dados de identificação e emergência"><form className="form-grid extended-form" onSubmit={saveCardProfile}><label>Espécie<input value={cardProfile.species} onChange={e=>setCardProfile(v=>({...v,species:e.target.value}))} placeholder="Cão, gato, ave..."/></label><label>Telefone do tutor<input value={cardProfile.guardianPhone} onChange={e=>setCardProfile(v=>({...v,guardianPhone:e.target.value}))} placeholder="(00) 00000-0000"/></label><label>Contato de emergência<input value={cardProfile.emergencyContact} onChange={e=>setCardProfile(v=>({...v,emergencyContact:e.target.value}))} placeholder="Nome e telefone"/></label><label className="extended-full">Alertas de saúde<textarea value={cardProfile.medicalAlerts} onChange={e=>setCardProfile(v=>({...v,medicalAlerts:e.target.value}))} placeholder="Alergias ou condições importantes, se houver"/></label><button className="btn btn-primary">Salvar identificação</button></form></Panel>{notice&&<p className="notice" role="status">{notice}</p>}<p className="notice">O QR Code armazena a ficha no próprio código; qualquer pessoa que o escanear poderá ler as informações. Compartilhe somente os dados que deseja tornar acessíveis.</p></>;
  }
  return null;
}
