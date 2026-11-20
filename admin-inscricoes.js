/* Painel exclusivo de inscrições F7 */
(() => {
  const $ = id => document.getElementById(id);
  if (!window.F7_SUPABASE_URL || !window.F7_SUPABASE_KEY || !window.supabase) {
    $("loginMessage").textContent = "Não foi possível carregar a configuração do Supabase.";
    return;
  }
  const db = window.supabase.createClient(window.F7_SUPABASE_URL, window.F7_SUPABASE_KEY);
  let filter = "Todas";
  let rows = [];
  let siteMembers = [];
  const esc = value => String(value ?? "—").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const pretty = value => value === true ? "Sim" : value === false ? "Não" : (value ?? "—");
  const message = (value,bad=false) => { $("dashboardMessage").textContent=value; $("dashboardMessage").classList.toggle("error",bad); };
  async function authorize(user) {
    const {data,error}=await db.from("admins_f7").select("nome").eq("user_id",user.id).maybeSingle();
    if(error || !data) {
      await db.auth.signOut();
      $("loginMessage").textContent="Esta conta não está autorizada como administradora.";
      return;
    }
    $("loginPanel").hidden=true;
    $("dashboard").hidden=false;
    $("welcome").textContent="Bem-vindo(a), "+(data.nome || user.email)+".";
    await load();
  }
  async function load() {
    $("applications").innerHTML='<p class="admin-loading">Carregando inscrições...</p>';
    const [{data,error},{data:members,error:membersError}]=await Promise.all([
      db.from("inscricoes_f7").select("*").order("id",{ascending:false}).limit(200),
      db.from("membros_f7").select("nick,id_jogo")
    ]);
    if(error) {
      $("applications").innerHTML='<p class="admin-error">Erro ao carregar: '+esc(error.message)+'</p>';
      return;
    }
    rows=data||[];
    siteMembers=membersError ? [] : (members||[]);
    render();
  }
  const normalizedStatus = value => String(value || "Pendente").trim().toLowerCase();
  function render() {
    const visible=filter==="Todas" ? rows : rows.filter(r=>normalizedStatus(r.status)===normalizedStatus(filter));
    const countPending=rows.filter(r=>(r.status||"Pendente")==="Pendente").length;
    const countApproved=rows.filter(r=>r.status==="Aprovado").length;
    const countRejected=rows.filter(r=>r.status==="Reprovado").length;
    const stats='<div class="admin-stats"><div class="admin-stat"><span>Total recebidas</span><strong>'+rows.length+'</strong></div><div class="admin-stat pending"><span>Pendentes</span><strong>'+countPending+'</strong></div><div class="admin-stat approved"><span>Aprovadas</span><strong>'+countApproved+'</strong></div><div class="admin-stat rejected"><span>Reprovadas</span><strong>'+countRejected+'</strong></div></div>';
    if(!visible.length) {
      $("applications").innerHTML=stats+'<div class="empty-state"><h3>NENHUMA INSCRIÇÃO</h3><p>Não há candidatos nesta categoria.</p></div>';
      return;
    }
    const fields=[
      ["nick","Nick"],["jogador_id","ID do jogador"],["idade","Idade"],["nivel_conta","Nível"],["cidade","Cidade"],["whatsapp","WhatsApp"],["funcao","Função"],["patente","Patente"],["disponibilidade_guerras","Disponibilidade"],["atividade","Atividade"],["acompanha_grupo","Acompanha grupo"],["line_organizada","Line organizada"],["status","Status"]
    ];
    $("applications").innerHTML=stats+visible.map((r,i)=>{
      const alreadyAdded=siteMembers.some(m=>(r.jogador_id && m.id_jogo && String(m.id_jogo)===String(r.jogador_id)) || (m.nick && String(m.nick).trim().toLowerCase()===String(r.nick||"").trim().toLowerCase()));
      const addButton=normalizedStatus(r.status)==="aprovado" ? (alreadyAdded?'<span class="application-status">JÁ NO SITE</span>':'<button data-add-member="'+esc(r.id)+'">ADICIONAR AO SITE</button>') : "";
      return '<article class="application-card"><div class="application-top"><div><p class="public-meta">INSCRIÇÃO #'+esc(r.id)+'</p><h3>'+esc(r.nick)+'</h3><p class="application-status">'+esc(r.status||"Pendente")+'</p></div><div class="row-actions"><button data-detail="'+i+'">VER DETALHES</button>'+(normalizedStatus(r.status)==="aprovado"||normalizedStatus(r.status)==="reprovado"?'':'<button data-approve="'+esc(r.id)+'">APROVAR</button><button data-reject="'+esc(r.id)+'">REPROVAR</button>')+addButton+'<button class="danger" data-delete="'+esc(r.id)+'">EXCLUIR</button></div></div><div class="application-details" id="details-'+i+'" hidden>'+fields.map(([key,label])=>'<div><b>'+label+'</b><span>'+esc(pretty(r[key]))+'</span></div>').join("")+'</div></article>';
    }).join("");
    $("applications").querySelectorAll("[data-detail]").forEach(b=>b.addEventListener("click",()=>{const el=$("details-"+b.dataset.detail);el.hidden=!el.hidden;b.textContent=el.hidden?"VER DETALHES":"OCULTAR DETALHES";}));
    $("applications").querySelectorAll("[data-approve]").forEach(b=>b.addEventListener("click",()=>setStatus(b.dataset.approve,"Aprovado")));
    $("applications").querySelectorAll("[data-reject]").forEach(b=>b.addEventListener("click",()=>setStatus(b.dataset.reject,"Reprovado")));
    $("applications").querySelectorAll("[data-delete]").forEach(b=>b.addEventListener("click",()=>remove(b.dataset.delete)));
    $("applications").querySelectorAll("[data-add-member]").forEach(b=>b.addEventListener("click",()=>addMemberToSite(b.dataset.addMember)));
  }
  async function setStatus(id,status) {
    const {error}=await db.from("inscricoes_f7").update({status}).eq("id",id);
    if(error){message(error.message,true);return;}
    message("Inscrição marcada como "+status+".");
    await load();
  }
  async function addMemberToSite(id) {
    const applicant=rows.find(r=>String(r.id)===String(id));
    if(!applicant || normalizedStatus(applicant.status)!=="aprovado") return;
    const duplicate=siteMembers.some(m=>(applicant.jogador_id && m.id_jogo && String(m.id_jogo)===String(applicant.jogador_id)) || (m.nick && String(m.nick).trim().toLowerCase()===String(applicant.nick||"").trim().toLowerCase()));
    if(duplicate){message("Este jogador já está cadastrado no site.",true);return;}
    const payload={nome:applicant.nick,nick:applicant.nick,id_jogo:applicant.jogador_id||null,patente:applicant.patente||null,funcao:applicant.funcao||null,ativo:true};
    const {error}=await db.from("membros_f7").insert(payload);
    if(error){message("Não foi possível adicionar o membro: "+error.message,true);return;}
    message(applicant.nick+" foi adicionado à lista oficial de membros!");
    await load();
  }
  async function remove(id) {
    if(!confirm("Deseja excluir esta inscrição definitivamente?")) return;
    const {error}=await db.from("inscricoes_f7").delete().eq("id",id);
    if(error){message(error.message,true);return;}
    message("Inscrição excluída.");
    await load();
  }
  $("loginForm").addEventListener("submit",async ev=>{
    ev.preventDefault();
    $("loginMessage").textContent="Verificando acesso...";
    const {data,error}=await db.auth.signInWithPassword({email:$("email").value.trim(),password:$("password").value});
    if(error){$("loginMessage").textContent="Não foi possível entrar: "+error.message;return;}
    await authorize(data.user);
  });
  $("logoutButton").addEventListener("click",async()=>{await db.auth.signOut();$("dashboard").hidden=true;$("loginPanel").hidden=false;$("password").value="";});
  $("refreshButton").addEventListener("click",load);
  document.querySelectorAll("[data-filter]").forEach(b=>b.addEventListener("click",()=>{filter=b.dataset.filter;document.querySelectorAll("[data-filter]").forEach(x=>x.classList.toggle("active",x===b));render();}));
  db.auth.getSession().then(({data})=>{if(data.session)authorize(data.session.user);});
})();