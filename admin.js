/* Painel F7: autenticação e gerenciamento via Supabase */
(() => {
  const cfg = window.F7_SUPABASE_URL && window.F7_SUPABASE_KEY;
  const clientLib = window.supabase;
  const $ = (id) => document.getElementById(id);
  if (!cfg || !clientLib) {
    $("loginMessage").textContent = "Não foi possível carregar a configuração do Supabase.";
    return;
  }
  const db = clientLib.createClient(window.F7_SUPABASE_URL, window.F7_SUPABASE_KEY);
  const sections = {
    membros: { title:"MEMBROS", desc:"Gerencie o elenco oficial.", table:"membros_f7", fields:[
      ["nome","Nome","text",true],["nick","Nick no jogo","text",true],["id_jogo","ID do jogador","text",false],["patente","Patente","text",false],["funcao","Função","select",false,["Cura","Gás","Rush","Suporte","Full Gás","Coringa","Capitão"]],["ativo","Ativo","checkbox",false]
    ], columns:["nome","nick","id_jogo","patente","funcao","ativo"] },
    lines: { title:"LINES", desc:"Crie as equipes e organize as formações.", table:"lines_f7", fields:[
      ["nome","Nome da Line","text",true],["descricao","Descrição","textarea",false],["ativa","Ativa","checkbox",false]
    ], columns:["nome","descricao","ativa"] },
    resultados: { title:"RESULTADOS", desc:"Registre pontuações e colocações dos jogadores.", table:"resultados_f7", fields:[
      ["membro_id","ID do membro (opcional)","text",false],["nick","Nick","text",true],["pontos","Pontos","number",true],["colocacao","Colocação","number",false],["data_resultado","Data do resultado","date",true],["descricao","Descrição","textarea",false]
    ], columns:["nick","pontos","colocacao","data_resultado","descricao"] },
    campeonatos: { title:"CAMPEONATOS", desc:"Registre campanhas e colocações da organização.", table:"campeonatos_f7", fields:[
      ["nome","Nome do campeonato","text",true],["colocacao","Colocação","text",false],["descricao","Descrição","textarea",false],["data_inicio","Data de início","date",false],["data_fim","Data de término","date",false]
    ], columns:["nome","colocacao","descricao","data_inicio","data_fim"] },
    noticias: { title:"NOTÍCIAS", desc:"Publique avisos no espaço oficial da F7.", table:"noticias_f7", fields:[
      ["titulo","Título","text",true],["conteudo","Conteúdo","textarea",true],["imagem_url","URL da imagem (opcional)","url",false],["publicado","Publicado","checkbox",false]
    ], columns:["titulo","conteudo","publicado","criado_em"] },
    advertencias: { title:"ADVERTÊNCIAS", desc:"Registre ocorrências administrativas dos membros.", table:"advertencias_f7", fields:[
      ["membro_id","ID do membro (opcional)","text",false],["nick","Nick","text",true],["motivo","Motivo","textarea",true],["data_advertencia","Data","date",true]
    ], columns:["nick","motivo","data_advertencia"] }
  };
  let active = "membros";
  let editingId = null;
  const setMessage = (id, msg, bad=false) => { $(id).textContent = msg || ""; $(id).classList.toggle("error", !!bad); };
  const escapeHtml = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const pretty = (v) => v === true ? "Sim" : v === false ? "Não" : (v ?? "—");
  function renderTabs() {
    $("adminTabs").innerHTML = Object.entries(sections).map(([key,s]) => '<button type="button" class="admin-tab '+(key===active?'active':'')+'" data-tab="'+key+'">'+s.title+'</button>').join("");
    $("adminTabs").querySelectorAll("[data-tab]").forEach(b => b.addEventListener("click", () => { active=b.dataset.tab; editingId=null; $("editor").hidden=true; renderTabs(); loadRows(); }));
  }
  function renderField(f, value) {
    const [name,label,type,required,options] = f;
    const val = value ?? "";
    if (type === "checkbox") return '<label class="admin-check"><input name="'+name+'" type="checkbox" '+(val===true?'checked':'')+'> '+label+'</label>';
    if (type === "textarea") return '<label class="field"><span>'+label+'</span><textarea name="'+name+'" '+(required?'required':'')+' rows="3">'+escapeHtml(val)+'</textarea></label>';
    if (type === "select") return '<label class="field"><span>'+label+'</span><select name="'+name+'"><option value="">Selecione</option>'+options.map(o=>'<option '+(o===val?'selected':'')+'>'+o+'</option>').join("")+'</select></label>';
    return '<label class="field"><span>'+label+'</span><input name="'+name+'" type="'+type+'" value="'+escapeHtml(val)+'" '+(required?'required':'')+'></label>';
  }
  function openEditor(row=null) {
    const s=sections[active]; editingId=row?.id ?? null;
    $("editor").innerHTML='<form id="recordForm"><div class="editor-head"><h3>'+(row?'EDITAR '+s.title:'NOVO '+(active==="lines"?"LINE":s.title.slice(0,-1)))+'</h3><button type="button" id="cancelEdit" class="text-button">FECHAR ×</button></div><div class="editor-grid">'+s.fields.map(f=>renderField(f,row?.[f[0]])).join("")+'</div><div class="editor-actions"><button class="button button-red" type="submit">SALVAR LINE</button></div><p id="editorMessage" class="admin-message"></p></form>';
    $("editor").hidden=false;
    $("cancelEdit").addEventListener("click",()=>{$("editor").hidden=true;editingId=null;});
    $("recordForm").addEventListener("submit",saveRecord);
    $("editor").scrollIntoView({behavior:"smooth",block:"start"});
  }
  async function saveRecord(ev) {
    ev.preventDefault();
    const s=sections[active], form=new FormData(ev.currentTarget), payload={};
    s.fields.forEach(f=>{ const [name,,type]=f; if(type==="checkbox") payload[name]=!!ev.currentTarget.elements[name].checked; else { const v=form.get(name); if(v!==null && v!=="") payload[name]=type==="number"?Number(v):v; } });
    const result=editingId ? await db.from(s.table).update(payload).eq("id",editingId) : await db.from(s.table).insert(payload);
    if(result.error){$("editorMessage").textContent=result.error.message;return;}
    $("editor").hidden=true;editingId=null;setMessage("dashboardMessage",active==="lines"?"Line salva. Agora use JOGADORES no card para montar a equipe.":"Registro salvo.");loadRows();
  }
  async function setStatus(id,status) {
    const {error}=await db.from("inscricoes_f7").update({status}).eq("id",id);
    if(error){setMessage("dashboardMessage",error.message,true);return;}
    setMessage("dashboardMessage","Inscrição marcada como "+status+".");loadRows();
  }
  async function removeRow(id, row=null) {
    if(!confirm(active==="membros"?"Este membro deixará de aparecer no site oficial. Deseja continuar?":"Tem certeza que deseja excluir este registro?")) return;
    if(active==="membros") {
      const {error}=await db.from("membros_f7").update({ativo:false}).eq("id",id);
      if(error){setMessage("dashboardMessage",error.message,true);return;}
      setMessage("dashboardMessage","Membro removido do elenco público. O histórico foi preservado.");
      await loadRows();return;
    }
    if(active==="lines"){
      const {error:linkError}=await db.from("line_membros_f7").delete().eq("line_id",id);
      if(linkError){setMessage("dashboardMessage",linkError.message,true);return;}
    }
    const {error}=await db.from(sections[active].table).delete().eq("id",id);
    if(error){setMessage("dashboardMessage",error.message,true);return;}
    setMessage("dashboardMessage","Registro excluído.");loadRows();
  }
  const normalizeSearch = value => String(value ?? "").normalize("NFKC").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
  const roleKey = value => {
    const v=normalizeSearch(value);
    if(v.includes("cura")) return "cura";
    if(v.includes("gas")) return "gas";
    if(v.includes("rush")) return "rush";
    if(v.includes("suporte")) return "suporte";
    return v;
  };
  function renderMemberCards(data) {
    const activeCount=data.filter(m=>m.ativo!==false).length;
    $("tableWrap").innerHTML='<div class="admin-member-count"><span>MEMBROS ATIVOS</span><strong>'+activeCount+'</strong></div><div class="member-tools admin-member-tools"><label><span>PROCURAR POR NICK</span><input id="adminMemberSearch" type="search" placeholder="Digite parte do nick, mesmo personalizado"></label><label><span>FILTRAR POR FUNÇÃO</span><select id="adminMemberRole"><option value="">Todas as funções</option><option value="cura">Cura</option><option value="gas">Gás / Full Gás</option><option value="rush">Rush</option><option value="suporte">Suporte</option></select></label><label><span>STATUS</span><select id="adminMemberStatus"><option value="ativos">Somente ativos</option><option value="todos">Todos</option><option value="inativos">Somente inativos</option></select></label></div><div id="adminMemberCards" class="admin-member-grid"></div>';
    const search=$("adminMemberSearch"), role=$("adminMemberRole"), status=$("adminMemberStatus"), grid=$("adminMemberCards");
    const render=()=>{
      const term=normalizeSearch(search.value), selected=role.value, state=status.value;
      const filtered=data.filter(m=>{
        const text=normalizeSearch(m.nick||"").includes(term)||normalizeSearch(m.nome||"").includes(term);
        const roleMatch=!selected||roleKey(m.funcao)===selected;
        const statusMatch=state==="todos"||(state==="ativos"&&m.ativo!==false)||(state==="inativos"&&m.ativo===false);
        return text&&roleMatch&&statusMatch;
      });
      if(!filtered.length){grid.innerHTML='<div class="empty-state"><h3>NENHUM MEMBRO ENCONTRADO</h3><p>Altere a busca ou os filtros para ver outros jogadores.</p></div>';return;}
      grid.innerHTML=filtered.map(m=>'<article class="admin-member-card"><div class="admin-member-top"><span class="admin-member-tag">F7 • ELENCO</span><span class="admin-member-state '+(m.ativo===false?'inactive':'')+'">'+(m.ativo===false?'INATIVO':'ATIVO')+'</span></div><h3>'+escapeHtml(m.nick||m.nome||"Jogador")+'</h3>'+(m.nome&&m.nick&&m.nome!==m.nick?'<p class="admin-member-realname">'+escapeHtml(m.nome)+'</p>':'')+'<div class="admin-member-info"><span><b>FUNÇÃO</b>'+escapeHtml(pretty(m.funcao))+'</span><span><b>PATENTE</b>'+escapeHtml(pretty(m.patente))+'</span><span><b>ID FREE FIRE</b>'+escapeHtml(pretty(m.id_jogo))+'</span></div><div class="row-actions"><button data-edit="'+m.id+'">EDITAR</button>'+(m.ativo===false?'':'<button class="danger" data-delete="'+m.id+'">REMOVER DO SITE</button>')+'</div></article>').join("");
      grid.querySelectorAll("[data-edit]").forEach(b=>b.addEventListener("click",()=>openEditor(data.find(m=>String(m.id)===b.dataset.edit))));
      grid.querySelectorAll("[data-delete]").forEach(b=>b.addEventListener("click",()=>removeRow(b.dataset.delete)));
    };
    search.addEventListener("input",render);role.addEventListener("change",render);status.addEventListener("change",render);render();
  }
  async function openLinePlayers(line) {
    const [{data:members,error:memberError},{data:links,error:linkError}]=await Promise.all([
      db.from("membros_f7").select("id,nick,nome,id_jogo,funcao").eq("ativo",true).order("nick"),
      db.from("line_membros_f7").select("membro_id").eq("line_id",line.id)
    ]);
    if(memberError||linkError){setMessage("dashboardMessage","Não foi possível abrir os jogadores: "+(memberError?.message||linkError?.message),true);return;}
    const selected=new Set((links||[]).map(x=>String(x.membro_id)));
    const overlay=document.createElement("div");
    overlay.className="line-modal-backdrop";
    overlay.id="linePlayersModal";
    overlay.innerHTML='<section class="line-modal" role="dialog" aria-modal="true" aria-labelledby="lineModalTitle"><div class="line-modal-head"><div><p class="line-modal-kicker">ORGANIZAÇÃO F7</p><h3 id="lineModalTitle">JOGADORES · '+escapeHtml(line.nome)+'</h3><p>Selecione os membros ativos que farão parte desta Line.</p></div><button type="button" class="line-modal-close" id="closeLineModal">×</button></div><div class="line-modal-tools"><input id="lineModalSearch" type="search" placeholder="Pesquisar membro por nick ou nome..."><span id="lineModalCount">'+selected.size+' selecionado(s)</span></div><button type="button" class="line-member-select-trigger" id="lineMemberToggle"><span id="lineMemberSelectText">Selecionar jogadores</span><b>⌄</b></button><label class="field line-captain-field"><span>CAPITÃO DA LINE</span><select id="lineCaptainSelect"><option value="">Selecione o capitão</option>'+(members||[]).filter(m=>selected.has(String(m.id))).map(m=>'<option value="'+escapeHtml(m.id)+'" '+(String(line.capitao_id||"")===String(m.id)?"selected":"")+'>'+escapeHtml(m.nick||m.nome||"Jogador")+'</option>').join("")+'</select></label><div class="line-member-dropdown" id="lineMemberDropdown" hidden><div class="line-modal-list">'+(members||[]).map(m=>'<label class="line-modal-member"><input type="checkbox" name="line_member" value="'+escapeHtml(m.id)+'" '+(selected.has(String(m.id))?'checked':'')+'><span class="line-modal-member-text"><strong>'+escapeHtml(m.nick||m.nome||"Jogador")+'</strong><small>'+escapeHtml([m.nome&&m.nick&&m.nome!==m.nick?m.nome:"",m.funcao||"Sem função",m.id_jogo?"ID "+m.id_jogo:""].filter(Boolean).join(" · "))+'</small></span><span class="line-modal-check">✓</span></label>').join("")+'</div></div><div class="line-modal-footer"><span class="line-modal-hint">Marque os jogadores que farão parte desta Line.</span><div><button type="button" class="button button-outline" id="cancelLinePlayers">CANCELAR</button><button type="button" class="button button-red" id="saveLinePlayers">SALVAR JOGADORES</button></div></div><p id="lineModalMessage" class="admin-message"></p></section>';
    document.body.appendChild(overlay);
    const close=()=>overlay.remove();
    $("closeLineModal").addEventListener("click",close);
    $("cancelLinePlayers").addEventListener("click",close);
    overlay.addEventListener("click",ev=>{if(ev.target===overlay)close();});
    const checkboxes=()=>[...overlay.querySelectorAll('input[name="line_member"]:checked')];
    const updateCount=()=>{const n=checkboxes().length;$("lineModalCount").textContent=n+" selecionado(s)";$("lineMemberSelectText").textContent=n? n+" jogador(es) selecionado(s)":"Selecionar jogadores";};
    const captainSelect=$("lineCaptainSelect");
    const updateCaptainOptions=()=>{
      const previous=captainSelect.value||String(line.capitao_id||"");
      const chosen=checkboxes().map(el=>el.value);
      captainSelect.innerHTML='<option value="">Selecione o capitão</option>'+(members||[]).filter(m=>chosen.includes(String(m.id))).map(m=>'<option value="'+escapeHtml(m.id)+'">'+escapeHtml(m.nick||m.nome||"Jogador")+'</option>').join("");
      captainSelect.value=chosen.includes(previous)?previous:"";
    };
    overlay.querySelectorAll('input[name="line_member"]').forEach(el=>el.addEventListener("change",()=>{updateCount();updateCaptainOptions();}));
    updateCount();
    updateCaptainOptions();
    $("lineMemberToggle").addEventListener("click",()=>{$("lineMemberDropdown").hidden=!$("lineMemberDropdown").hidden;});
    $("lineModalSearch").addEventListener("input",ev=>{
      const term=normalizeSearch(ev.target.value);
      overlay.querySelectorAll(".line-modal-member").forEach(el=>{el.hidden=!normalizeSearch(el.textContent).includes(term);});
    });
    $("saveLinePlayers").addEventListener("click",async()=>{
      const ids=checkboxes().map(el=>el.value);
      const captainId=$("lineCaptainSelect").value;
      if(captainId&&!ids.includes(captainId)){$("lineModalMessage").textContent="O capitão também precisa estar selecionado como jogador da Line.";return;}
      $("saveLinePlayers").disabled=true;
      $("lineModalMessage").textContent="Salvando jogadores...";
      const {error:clearCurrentError}=await db.from("line_membros_f7").delete().eq("line_id",line.id);
      if(clearCurrentError){$("lineModalMessage").textContent=clearCurrentError.message;$("saveLinePlayers").disabled=false;return;}
      if(ids.length){
        const {error:moveError}=await db.from("line_membros_f7").delete().in("membro_id",ids).neq("line_id",line.id);
        if(moveError){$("lineModalMessage").textContent=moveError.message;$("saveLinePlayers").disabled=false;return;}
        const rows=ids.map(membro_id=>({line_id:line.id,membro_id}));
        const {error:insertError}=await db.from("line_membros_f7").insert(rows);
        if(insertError){$("lineModalMessage").textContent=insertError.message;$("saveLinePlayers").disabled=false;return;}
      }
      const {error:captainError}=await db.from("lines_f7").update({capitao_id:captainId||null}).eq("id",line.id);
      if(captainError){$("lineModalMessage").textContent="Jogadores salvos, mas não foi possível salvar o capitão: "+captainError.message;$("saveLinePlayers").disabled=false;return;}
      close();setMessage("dashboardMessage","Jogadores e capitão da "+line.nome+" atualizados.");await loadRows();
    });
  }
  async function renderLineCards(lines) {
    const [{data:links,error:linkError},{data:members,error:memberError}]=await Promise.all([
      db.from("line_membros_f7").select("line_id,membro_id"),
      db.from("membros_f7").select("id,nick,nome,funcao,ativo")
    ]);
    if(linkError||memberError){$("tableWrap").innerHTML='<p class="admin-error">Erro ao carregar jogadores das Lines: '+escapeHtml(linkError?.message||memberError?.message)+'</p>';return;}
    const html=lines.map(line=>{
      const ids=(links||[]).filter(x=>String(x.line_id)===String(line.id)).map(x=>String(x.membro_id));
      const players=(members||[]).filter(m=>ids.includes(String(m.id))&&m.ativo!==false);
      const captain=(members||[]).find(m=>String(m.id)===String(line.capitao_id));
      return '<article class="admin-line-card"><div class="admin-line-card-head"><div><span class="admin-line-kicker">FORMAÇÃO OFICIAL F7</span><h3>'+escapeHtml(line.nome)+'</h3></div><span class="admin-line-count">'+players.length+' MEMBRO(S)</span></div><p class="admin-line-captain">CAPITÃO: <strong>'+escapeHtml(captain?.nick||captain?.nome||"Não definido")+'</strong></p><p class="admin-line-description">'+escapeHtml(line.descricao||"Sem descrição cadastrada.")+'</p><div class="admin-line-roster">'+(players.length?players.map(m=>'<div class="admin-line-roster-member"><span class="admin-line-avatar">'+escapeHtml(String(m.nick||m.nome||"F7").trim().slice(0,2).toUpperCase())+'</span><span><strong>'+escapeHtml(m.nick||m.nome||"Jogador")+'</strong><small>'+escapeHtml(m.funcao||"Membro")+'</small></span></div>').join(""):'<p class="admin-line-empty">Nenhum jogador vinculado. Clique em JOGADORES para montar esta equipe.</p>')+'</div><div class="admin-line-actions"><button type="button" class="button button-red" data-players="'+line.id+'">JOGADORES</button><button type="button" class="button button-outline" data-edit="'+line.id+'">EDITAR LINE</button><button type="button" class="button button-outline line-delete" data-delete="'+line.id+'">EXCLUIR</button></div></article>';
    }).join("");
    $("tableWrap").innerHTML='<div class="admin-lines-heading"><div><h3>LINES CADASTRADAS</h3><p>Gerencie as formações e seus integrantes em um só lugar.</p></div><span>'+lines.length+' LINE(S)</span></div><div class="admin-line-grid">'+html+'</div>';
    $("tableWrap").querySelectorAll("[data-edit]").forEach(b=>b.addEventListener("click",()=>openEditor(lines.find(x=>String(x.id)===b.dataset.edit))));
    $("tableWrap").querySelectorAll("[data-players]").forEach(b=>b.addEventListener("click",()=>openLinePlayers(lines.find(x=>String(x.id)===b.dataset.players))));
    $("tableWrap").querySelectorAll("[data-delete]").forEach(b=>b.addEventListener("click",()=>removeRow(b.dataset.delete)));
  }
  async function loadRows() {
    const s=sections[active];
    $("sectionTitle").textContent=s.title;$("sectionDescription").textContent=s.desc;
    $("addButton").hidden=!!s.readOnly;
    $("addButton").textContent=active==="membros"?"+ ADICIONAR MEMBRO":"+ ADICIONAR";
    $("addButton").setAttribute("aria-label",active==="membros"?"Adicionar membro ao site":"Adicionar registro");
    $("tableWrap").innerHTML='<p class="admin-loading">Carregando dados...</p>';
    const {data,error}=await db.from(s.table).select("*").limit(200);
    if(error){$("tableWrap").innerHTML='<p class="admin-error">Erro ao carregar: '+escapeHtml(error.message)+'</p>';return;}
    if(active==="membros"){renderMemberCards(data||[]);return;}
    if(!data?.length){$("tableWrap").innerHTML='<div class="empty-state"><h3>NENHUM REGISTRO</h3><p>Use o botão Adicionar para cadastrar o primeiro.</p></div>';return;}
    if(active==="lines"){await renderLineCards(data);return;}
    const cols=s.columns;
    let html='<div class="admin-table-scroll"><table class="data-table"><thead><tr>'+cols.map(c=>'<th>'+escapeHtml(c.replaceAll("_"," "))+'</th>').join("")+'<th>AÇÕES</th></tr></thead><tbody>';
    html+=data.map(row=>'<tr>'+cols.map(c=>'<td>'+escapeHtml(pretty(row[c]))+'</td>').join("")+'<td class="row-actions">'+(active==="inscricoes"?'<button data-status="Aprovado" data-id="'+row.id+'">Aprovar</button><button data-status="Reprovado" data-id="'+row.id+'">Reprovar</button>':(active==="vinculacoes"?'':'<button data-edit="'+row.id+'">Editar</button>'))+'<button class="danger" data-delete="'+(active==="vinculacoes"?encodeURIComponent(JSON.stringify(row)):row.id)+'">Excluir</button></td></tr>').join("");
    html+='</tbody></table></div>';$("tableWrap").innerHTML=html;
    $("tableWrap").querySelectorAll("[data-edit]").forEach(b=>b.addEventListener("click",()=>openEditor(data.find(r=>String(r.id)===b.dataset.edit))));
    $("tableWrap").querySelectorAll("[data-delete]").forEach(b=>b.addEventListener("click",()=>active==="vinculacoes"?removeRow(null,JSON.parse(decodeURIComponent(b.dataset.delete))):removeRow(b.dataset.delete)));
    $("tableWrap").querySelectorAll("[data-status]").forEach(b=>b.addEventListener("click",()=>setStatus(b.dataset.id,b.dataset.status)));
  }
  async function showDashboard(user) {
    const {data:admin,error}=await db.from("admins_f7").select("nome").eq("user_id",user.id).maybeSingle();
    if(error || !admin){await db.auth.signOut();setMessage("loginMessage","Esta conta não está autorizada como administradora.",true);return;}
    $("loginPanel").hidden=true;$("dashboard").hidden=false;
    $("welcome").textContent="Bem-vindo(a), "+(admin.nome||user.email)+".";
    renderTabs();await loadRows();
  }
  $("loginForm").addEventListener("submit",async ev=>{
    ev.preventDefault();setMessage("loginMessage","Verificando acesso...");
    const {data,error}=await db.auth.signInWithPassword({email:$("email").value.trim(),password:$("password").value});
    if(error){setMessage("loginMessage","Não foi possível entrar: "+error.message,true);return;}
    await showDashboard(data.user);
  });
  $("addButton").addEventListener("click",()=>openEditor());
  $("logoutButton").addEventListener("click",async()=>{await db.auth.signOut();$("dashboard").hidden=true;$("loginPanel").hidden=false;$("password").value="";});
  db.auth.getSession().then(({data})=>{if(data.session)showDashboard(data.session.user);});
})();