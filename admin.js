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
      ["nome","Nome","text",true],["nick","Nick no jogo","text",true],["id_jogo","ID do jogador","text",false],["patente","Patente","text",false],["funcao","Função","select",false,["Cura","Rush","Full Gás","Coringa","Capitão"]],["ativo","Ativo","checkbox",false]
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
  function openEditor(row=null) {
    const s=sections[active]; editingId=row?.id ?? null;
    $("editor").innerHTML='<form id="recordForm"><div class="editor-head"><h3>'+(row?'EDITAR REGISTRO':'NOVO REGISTRO')+'</h3><button type="button" id="cancelEdit" class="text-button">FECHAR ×</button></div><div class="editor-grid">'+s.fields.map(f=>renderField(f,row?.[f[0]])).join("")+'</div><div class="editor-actions"><button class="button button-red" type="submit">SALVAR</button></div><p id="editorMessage" class="admin-message"></p></form>';
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
    $("editor").hidden=true;editingId=null;setMessage("dashboardMessage","Registro salvo.");loadRows();
  }
  async function setStatus(id,status) {
    const {error}=await db.from("inscricoes_f7").update({status}).eq("id",id);
    if(error){setMessage("dashboardMessage",error.message,true);return;}
    setMessage("dashboardMessage","Inscrição marcada como "+status+".");loadRows();
  }
  async function removeRow(id, row=null) {
    if(!confirm("Tem certeza que deseja excluir este registro?")) return;
    let query=db.from(sections[active].table).delete();
    if(active==="vinculacoes" && row) query=query.eq("line_id",row.line_id).eq("membro_id",row.membro_id);
    else query=query.eq("id",id);
    const {error}=await query;
    if(error){setMessage("dashboardMessage",error.message,true);return;}
    setMessage("dashboardMessage","Registro excluído.");loadRows();
  }
  async function loadRows() {
    const s=sections[active];
    $("sectionTitle").textContent=s.title;$("sectionDescription").textContent=s.desc;
    $("addButton").hidden=!!s.readOnly;
    $("tableWrap").innerHTML='<p class="admin-loading">Carregando dados...</p>';
    const {data,error}=await db.from(s.table).select("*").limit(100);
    if(error){$("tableWrap").innerHTML='<p class="admin-error">Erro ao carregar: '+escapeHtml(error.message)+'</p>';return;}
    if(!data?.length){$("tableWrap").innerHTML='<div class="empty-state"><h3>NENHUM REGISTRO</h3><p>Use o botão Adicionar para cadastrar o primeiro.</p></div>';return;}
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