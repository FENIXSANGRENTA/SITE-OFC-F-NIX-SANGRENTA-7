(() => {
  const root = window.supabase;
  if (!root || !window.F7_SUPABASE_URL || !window.F7_SUPABASE_KEY) return;
  const db = root.createClient(window.F7_SUPABASE_URL, window.F7_SUPABASE_KEY);
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const empty = (id, title, msg) => { const el=$(id); if(el) el.innerHTML='<div class="empty-state"><span class="empty-icon">✦</span><h3>'+esc(title)+'</h3><p>'+esc(msg)+'</p></div>'; };
  const card = (title, meta, desc, extra="") => '<article class="public-card">'+extra+'<h3>'+esc(title)+'</h3>'+(meta?'<p class="public-meta">'+esc(meta)+'</p>':'')+(desc?'<p>'+esc(desc)+'</p>':'')+'</article>';
  const normalizeSearch = value => String(value ?? "").normalize("NFKC").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
  const roleKey = value => {
    const v=normalizeSearch(value);
    if(v.includes("cura")) return "cura";
    if(v.includes("gas")) return "gas";
    if(v.includes("rush")) return "rush";
    if(v.includes("suporte")) return "suporte";
    return v;
  };
  async function loadMembers(){
    const {data,error}=await db.from("membros_f7").select("id,nome,nick,id_jogo,patente,funcao,ativo").eq("ativo",true).limit(200);
    if(error){const count=$("activeMemberCount");if(count)count.textContent="CONTAGEM INDISPONÍVEL";empty("publicMembers","ELENCO INDISPONÍVEL","Não foi possível carregar os membros agora.");return;}
    const count=$("activeMemberCount");if(count){const result=await db.from("membros_f7").select("id",{count:"exact",head:true}).eq("ativo",true);count.textContent=result.error?"TOTAL DE MEMBROS ATIVOS INDISPONÍVEL":(result.count??data?.length??0)+" MEMBROS ATIVOS";}
    if(!data?.length){empty("publicMembers","ELENCO EM ORGANIZAÇÃO","Os integrantes oficiais da HYDRA 7 serão apresentados aqui.");return;}
    const search=$("publicMemberSearch"), role=$("publicMemberRole");
    const render=()=>{
      const term=normalizeSearch(search?.value||"");
      const selected=role?.value||"";
      const filtered=data.filter(m=>{
        const nick=normalizeSearch(m.nick||"");
        const name=normalizeSearch(m.nome||"");
        const matchesText=!term||nick.includes(term)||name.includes(term);
        const matchesRole=!selected||roleKey(m.funcao)===selected;
        return matchesText&&matchesRole;
      });
      if(!filtered.length){
        $("publicMembers").innerHTML='<div class="empty-state"><h3>NENHUM JOGADOR ENCONTRADO</h3><p>Tente outro trecho do nick ou altere o filtro de função.</p></div>';
        return;
      }
      $("publicMembers").innerHTML=filtered.map((m,i)=>{
        const nick=m.nick||m.nome||"Jogador HYDRA 7";
        const initials=String(nick).trim().split(/\s+/).slice(0,2).map(part=>part[0]||"").join("").toUpperCase();
        return '<article class="member-card"><div class="member-card-head"><span class="member-number">HYDRA 7 / '+String(i+1).padStart(2,"0")+'</span><span class="member-status"><i></i> ATIVO</span></div><div class="member-avatar">'+esc(initials||"HYDRA 7")+'</div><div class="member-identity"><p class="member-kicker">INTEGRANTE OFICIAL</p><h3>'+esc(nick)+'</h3>'+(m.nome&&m.nick&&m.nome!==m.nick?'<p class="member-realname">'+esc(m.nome)+'</p>':'')+'</div><div class="member-divider"></div><div class="member-tags">'+(m.funcao?'<span class="member-tag role-tag">'+esc(m.funcao)+'</span>':'')+(m.patente?'<span class="member-tag">'+esc(m.patente)+'</span>':'')+'</div>'+(m.id_jogo?'<p class="member-game-id">ID FREE FIRE <strong>'+esc(m.id_jogo)+'</strong></p>':'')+'<span class="member-watermark">HYDRA 7</span></article>';
      }).join("");
    };
    search?.addEventListener("input",render);
    role?.addEventListener("change",render);
    render();
  }
  async function loadLines(){
    const {data:lines,error}=await db.from("lines_f7").select("id,nome,descricao,ativa").eq("ativa",true).limit(50);
    if(error){empty("publicLines","LINES INDISPONÍVEIS","Não foi possível carregar as Lines: "+error.message);return;}
    if(!lines?.length){empty("publicLines","LINES EM ORGANIZAÇÃO","As formações da HYDRA 7 serão apresentadas aqui.");return;}
    const [{data:links,error:linksError},{data:members,error:membersError}]=await Promise.all([
      db.from("line_membros_f7").select("line_id,membro_id,funcao"),
      db.from("membros_f7").select("id,nick,nome,funcao").eq("ativo",true)
    ]);
    if(linksError||membersError){empty("publicLines","LINES INDISPONÍVEIS","Não foi possível carregar os integrantes: "+(linksError?.message||membersError?.message));return;}
    const html=lines.map(line=>{
      const lineLinks=(links||[]).filter(x=>String(x.line_id)===String(line.id));
      const roster=lineLinks.map(link=>{
        const member=(members||[]).find(m=>String(m.id)===String(link.membro_id));
        if(!member)return null;
        const role=link.funcao||member.funcao||"";
        const key=roleKey(role);
        const targets={rush:125,cura:70,gas:70,suporte:70};
        return {name:member.nick||member.nome||"Jogador",role,target:targets[key]??null};
      }).filter(Boolean);
      const allTargetsKnown=roster.length>0&&roster.every(player=>player.target!==null);
      const lineTarget=allTargetsKnown?roster.reduce((sum,player)=>sum+player.target,0):null;
      const rosterHtml=roster.length
        ? '<div class="public-line-roster">'+roster.map(player=>'<div class="public-line-player"><span>'+esc(player.name)+'</span><div class="public-line-player-info">'+(player.role?'<strong>'+esc(player.role)+'</strong>':'<strong>FUNÇÃO NÃO DEFINIDA</strong>')+(player.target!==null?'<small>Meta: '+player.target+' pts</small>':'<small class="target-pending">Meta pendente</small>')+'</div></div>').join("")+'</div>'
        : '<p class="public-line-empty">Line em formação</p>';
      const targetHtml=allTargetsKnown?'<p class="public-line-target">META TOTAL DA LINE <strong>'+lineTarget+' PONTOS</strong></p>':'<p class="public-line-target target-pending">META DA LINE PENDENTE: confira as funções dos integrantes.</p>';
      return '<article class="public-card public-line-card"><div class="public-card-mark">HYDRA 7</div><h3>'+esc(line.nome)+'</h3>'+rosterHtml+targetHtml+(line.descricao?'<p>'+esc(line.descricao)+'</p>':'')+'</article>';
    }).join("");
    $("publicLines").innerHTML=html;
  }
  async function loadResults(){
    const {data,error}=await db.from("resultados_f7").select("nick,pontos,colocacao,data_resultado,descricao").order("data_resultado",{ascending:false}).limit(30);
    if(error){empty("publicResults","RESULTADOS INDISPONÍVEIS","Não foi possível carregar os resultados.");}
    else if(!data?.length){empty("publicResults","PRÓXIMOS DESAFIOS","Os resultados das guerras e competições aparecerão nesta área.");}
    else $("publicResults").innerHTML=data.map(r=>card(r.nick||"Resultado HYDRA 7",[(r.colocacao? r.colocacao+"º lugar":""),(r.pontos!==null?r.pontos+" pontos":""),r.data_resultado].filter(Boolean).join(" • "),r.descricao||"")).join("");
    const {data:champ,error:champError}=await db.from("campeonatos_f7").select("nome,colocacao,descricao,data_inicio,data_fim").order("data_inicio",{ascending:false}).limit(20);
    if(champError){empty("publicChampionships","CAMPEONATOS","Não foi possível carregar os campeonatos.");return;}
    if(!champ?.length){empty("publicChampionships","CAMPEONATOS","As campanhas da HYDRA 7 aparecerão aqui.");return;}
    $("publicChampionships").innerHTML='<h3 class="public-subheading">CAMPEONATOS</h3>'+champ.map(c=>card(c.nome,c.colocacao||"",[c.descricao,c.data_inicio? "Início: "+c.data_inicio:"",c.data_fim?"Término: "+c.data_fim:""].filter(Boolean).join(" • "))).join("");
  }
  async function loadNews(){
    const {data,error}=await db.from("noticias_f7").select("titulo,conteudo,imagem_url,criado_em").eq("publicado",true).order("criado_em",{ascending:false}).limit(30);
    if(error){empty("publicNews","NOTÍCIAS INDISPONÍVEIS","Não foi possível carregar os avisos.");return;}
    if(!data?.length){empty("publicNews","NENHUM AVISO PUBLICADO","As novidades oficiais da organização serão divulgadas aqui.");return;}
    $("publicNews").innerHTML=data.map(n=>card(n.titulo,n.criado_em?new Date(n.criado_em).toLocaleDateString("pt-BR"):"",n.conteudo,n.imagem_url?'<img class="public-news-image" src="'+esc(n.imagem_url)+'" alt="">':"")).join("");
  }
  Promise.all([loadMembers(),loadLines(),loadResults(),loadNews()]);
})();