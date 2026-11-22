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
    vinculacoes: { title:"JOGADORES NAS LINES", desc:"Vincule um membro a uma line usando os IDs dos registros.", table:"line_membros_f7", fields:[
      ["line_id","ID da Line","text",true],["membro_id","ID do membro","text",true]
    ], columns:["line_id","membro_id"] },
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
  async function openEditor(row=null) {
    const s=sections[active]; editingId=row?.id ?? null;
    let memberPicker="";
    if(active==="lines"){
      const [{data:members,error:memberError},{data:links,error:linkError}]=await Promise.all([
        db.from("membros_f7").select("id,nome,nick,id_jogo,funcao,ativo").eq("ativo",true).order("nick"),
        row?db.from("line_membros_f7").select("membro_id").eq("line_id",row.id):Promise.resolve({data:[],error:null})
      ]);
      if(memberError||linkError){setMessage("dashboardMessage","Não foi possível carregar os membros da line: "+(memberError?.message||linkError?.message),true);return;}
      const selected=new Set((links||[]).map(x=>String(x.membro_id)));
      memberPicker='<div class="line-member-picker"><div class="line-picker-heading"><div><h4>JOGADORES DA LINE</h4><p>Selecione os membros já cadastrados no site.</p></div><span id="lineSelectedCount">'+selected.size+' selecionado(s)</span></div><input id="lineMemberSearch" class="line-member-search" type="search" placeholder="Buscar membro pelo nick ou nome..."><div class="line-member-list">'+(members||[]).map(m=>'<label class="line-member-option"><input type="checkbox" name="line_member" value="'+escapeHtml(m.id)+'" '+(selected.has(String(m.id))?'checked':'')+'><span class="line-member-option-main"><strong>'+escapeHtml(m.nick||m.nome||"Jogador")+'</strong><small>'+escapeHtml([m.nome&&m.nick&&m.nome!==m.nick?m.nome:"",m.funcao||"",m.id_jogo?"ID "+m.id_jogo:""].filter(Boolean).join(" • ")||"Membro F7")+'</small></span><span class="line-member-check">✓</span></label>').join("")+'</div></div>';
    }
    $("editor").innerHTML='<form id="recordForm"><div class="editor-head"><h3>'+(row?'EDITAR LINE':'NOVA LINE')+'</h3><button type="button" id="cancelEdit" class="text-button">FECHAR ×</button></div><div class="editor-grid">'+s.fields.map(f=>renderField(f,row?.[f[0]])).join("")+'</div>'+memberPicker+'<div class="editor-actions"><button class="button button-red" type="submit">SALVAR '+(active==="lines"?'LINE E JOGADORES':'')+'</button></div><p id="editorMessage" class="admin-message"></p></form>';
    $("editor").hidden=false;
    $("cancelEdit").addEventListener("click",()=>{$("editor").hidden=true;editingId=null;});
    $("recordForm").addEventListener("submit",saveRecord);
    if(active==="lines"){
      const updateCount=()=>{const n=document.querySelectorAll('#recordForm input[name="line_member"]:checked').length;$("lineSelectedCount").textContent=n+" selecionado(s)";};
      const search=$("lineMemberSearch");
      search.addEventListener("input",()=>{const term=normalizeSearch(search.value);document.querySelectorAll("#recordForm .line-member-option").forEach(el=>{el.hidden=!normalizeSearch(el.textContent).includes(term);});});
      document.querySelectorAll('#recordForm input[name="line_member"]').forEach(el=>el.addEventListener("change",updateCount));
    }
    $("editor").scrollIntoView({behavior:"smooth",block:"start"});
  }
  async function saveRecord(ev) {
    ev.preventDefault();
    const s=sections[active], form=new FormData(ev.currentTarget), payload={};
    s.fields.forEach(f=>{ const [name,,type]=f; if(type==="checkbox") payload[name]=!!ev.currentTarget.elements[name].checked; else { const v=form.get(name); if(v!==null && v!=="") payload[name]=type==="number"?Number(v):v; } });
    if(active==="lines"){
      const memberIds=[...ev.currentTarget.querySelectorAll('input[name="line_member"]:checked')].map(el=>el.value);
      $("editorMessage").textContent="Salvando line e jogadores...";
      let lineId=editingId;
      if(lineId){
        const {error}=await db.from("lines_f7").update(payload).eq("id",lineId);
        if(error){$("editorMessage").textContent=error.message;return;}
      }else{
        const {data,error}=await db.from("lines_f7").insert(payload).select("id").single();
        if(error){$("editorMessage").textContent=error.message;return;}
        lineId=data.id;
      }
      const {error:deleteError}=await db.from("line_membros_f7").delete().eq("line_id",lineId);
      if(deleteError){$("editorMessage").textContent="A line foi salva, mas não foi possível atualizar os jogadores: "+deleteError.message;return;}
      if(memberIds.length){
        const rows=memberIds.map(membro_id=>({line_id:lineId,membro_id}));
        const {error:insertError}=await db.from("line_membros_f7").insert(rows);
        if(insertError){$("editorMessage").textContent="A line foi salva, mas houve erro ao vincular jogadores: "+insertError.message;return;}
      }
      $("editor").hidden=true;editingId=null;setMessage("dashboardMessage","Line e jogadores salvos com sucesso.");loadRows();return;
    }
    const result=editingId ? await db.from(s.table).update(payload).eq("id",editingId) : await db.from(s.table).insert(payload);
    if(result.error){$("editorMessage").textContent=result.error.message;return;}
    $("editor").hidden=true;editingId=null;setMessage("dashboardMessage","Registro salvo.");loadRows();
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
    $("tableWrap").innerHTML='<div class="member-tools admin-member-tools"><label><span>PROCURAR POR NICK</span><input id="adminMemberSearch" type="search" placeholder="Digite parte do nick, mesmo personalizado"></label><label><span>FILTRAR POR FUNÇÃO</span><select id="adminMemberRole"><option value="">Todas as funções</option><option value="cura">Cura</option><option value="gas">Gás / Full Gás</option><option value="rush">Rush</option><option value="suporte">Suporte</option></select></label><label><span>STATUS</span><select id="adminMemberStatus"><option value="ativos">Somente ativos</option><option value="todos">Todos</option><option value="inativos">Somente inativos</option></select></label></div><div id="adminMemberCards" class="admin-member-grid"></div>';
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
  async function renderLineCards(lines) {
    const [{data:links,error:linkError},{data:members,error:memberError}]=await Promise.all([
      db.from("line_membros_f7").select("line_id,membro_id"),
      db.from("membros_f7").select("id,nick,nome,funcao,ativo")
    ]);
    if(linkError||memberError){$("tableWrap").innerHTML='<p class="admin-error">Erro ao carregar jogadores das lines: '+escapeHtml(linkError?.message||memberError?.message)+'</p>';return;}
    const html=lines.map(line=>{
      const ids=(links||[]).filter(x=>String(x.line_id)===String(line.id)).map(x=>String(x.membro_id));
      const players=(members||[]).filter(m=>ids.includes(String(m.id)));
      return '<article class="admin-line-card"><div class="admin-line-card-top"><span class="admin-member-tag">FORMAÇÃO F7</span><span class="admin-line-count">'+players.length+' jogador(es)</span></div><h3>'+escapeHtml(line.nome)+'</h3><p class="admin-line-description">'+escapeHtml(line.descricao||"Sem descrição")+'</p><div class="admin-line-players">'+(players.length?players.map(m=>'<span class="admin-line-player"><strong>'+escapeHtml(m.nick||m.nome||"Jogador")+'</strong><small>'+escapeHtml(m.funcao||"Membro")+'</small></span>').join(""):'<p class="admin-line-empty">Nenhum jogador selecionado nesta line.</p>')+'</div><div class="row-actions"><button data-edit="'+line.id+'">EDITAR LINE / JOGADORES</button><button class="danger" data-delete="'+line.id+'">EXCLUIR</button></div></article>';
    }).join("");
    $("tableWrap").innerHTML='<div class="admin-line-grid">'+html+'</div>';
    $("tableWrap").querySelectorAll("[data-edit]").forEach(b=>b.addEventListener("click",()=>openEditor(lines.find(x=>String(x.id)===b.dataset.edit))));
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
    if(!data?.length){$("tableWrap").innerHTML='<div class="empty-state"><h3>NENHUM REGISTRO</h3><p>Use o botão Adicionar para cadastrar o primeiro.</p></div>';return;}
    if(active==="membros"){renderMemberCards(data);return;}
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