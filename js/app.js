(() => {
  const $ = (id) => document.getElementById(id);
  const categories = ["Documentos Privados","Cursos de Actualización","Documentos Académicos","Documentos Familiares"];
  const TABLE = "yahir_perez_razo";
  const BUCKET = "documentos";
  let supabaseClient, currentUser, activeCategory = "Todos", documents = [];

  const authView = $("authView"), appView = $("appView");
  function message(id, text, error=false) {
    const el = $(id); el.textContent = text; el.style.color = error ? "#b54747" : "#3169b3";
  }
  function configured() {
    return window.SUPABASE_URL && window.SUPABASE_ANON_KEY &&
      !window.SUPABASE_URL.includes("PEGA_AQUI") && !window.SUPABASE_ANON_KEY.includes("PEGA_AQUI");
  }
  function showAuth() { authView.classList.remove("hidden"); appView.classList.add("hidden"); }
  function showApp() { authView.classList.add("hidden"); appView.classList.remove("hidden"); }
  function fileSize(bytes) {
    if (!bytes) return "—";
    const units=["B","KB","MB","GB"]; let i=0,n=bytes;
    while(n>=1024 && i<3){n/=1024;i++;}
    return `${n.toFixed(i ? 1 : 0)} ${units[i]}`;
  }
  function safeName(name) { return name.replace(/[^\w.\-() áéíóúÁÉÍÓÚñÑ]/g,"_").slice(0,120); }

  function setAuthTab(register) {
    $("loginForm").classList.toggle("hidden", register);
    $("registerForm").classList.toggle("hidden", !register);
    $("showLogin").classList.toggle("active", !register);
    $("showRegister").classList.toggle("active", register);
    message("authMessage","");
  }
  $("showLogin").addEventListener("click",()=>setAuthTab(false));
  $("showRegister").addEventListener("click",()=>setAuthTab(true));

  $("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!supabaseClient) return message("authMessage","Primero configura Supabase en js/config.js.",true);
    message("authMessage","Verificando acceso...");
    const {error}=await supabaseClient.auth.signInWithPassword({
      email:$("loginEmail").value.trim(), password:$("loginPassword").value
    });
    if(error) return message("authMessage",error.message,true);
    await checkSession();
  });

  $("registerForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!supabaseClient) return message("authMessage","Primero configura Supabase en js/config.js.",true);
    const name=$("registerName").value.trim(), email=$("registerEmail").value.trim(), password=$("registerPassword").value;
    message("authMessage","Creando cuenta...");
    const {data,error}=await supabaseClient.auth.signUp({email,password,options:{data:{full_name:name}}});
    if(error) return message("authMessage",error.message,true);
    if(data.session) await checkSession();
    else message("authMessage","Cuenta creada. Revisa tu correo para confirmar el registro y después inicia sesión.");
  });

  $("logoutBtn").addEventListener("click",async()=>{
    const {error}=await supabaseClient.auth.signOut();
    if(error) message("appMessage",error.message,true); else showAuth();
  });

  async function checkSession() {
    const {data,error}=await supabaseClient.auth.getSession();
    if(error) return message("authMessage",error.message,true);
    if(data.session){currentUser=data.session.user;showApp();setUserInfo();await loadDocuments();}
    else showAuth();
  }
  function setUserInfo(){
    const name=currentUser.user_metadata?.full_name || currentUser.email || "Usuario";
    $("userName").textContent=name; $("userEmail").textContent=currentUser.email || "";
    $("userInitial").textContent=name.charAt(0).toUpperCase();
    $("welcomeTitle").textContent=`Hola, ${name.split(" ")[0]}`;
  }

  async function loadDocuments(){
    $("loadingState").classList.remove("hidden"); $("emptyState").classList.add("hidden");
    $("fileGrid").innerHTML="";
    const {data,error}=await supabaseClient.from(TABLE).select("*").order("created_at",{ascending:false});
    $("loadingState").classList.add("hidden");
    if(error){message("appMessage",`No se pudieron cargar los documentos: ${error.message}`,true);return;}
    documents=data || []; renderDocuments();
  }
  function renderDocuments(){
    const query=$("searchInput").value.trim().toLowerCase();
    const filtered=documents.filter(d=>(activeCategory==="Todos" || d.category===activeCategory) &&
      (d.file_name || "").toLowerCase().includes(query));
    $("sectionTitle").textContent=activeCategory==="Todos"?"Todos los archivos":activeCategory;
    $("fileCount").textContent=`${filtered.length} ${filtered.length===1?"archivo":"archivos"}`;
    $("fileGrid").innerHTML="";
    $("emptyState").classList.toggle("hidden",filtered.length!==0);
    filtered.forEach(doc=>{
      const ext=(doc.file_name.split(".").pop()||"FILE").toUpperCase().slice(0,4);
      const card=document.createElement("article"); card.className="file-card";
      const top=document.createElement("div"); top.className="file-card-top";
      const type=document.createElement("div"); type.className="file-type"; type.textContent=ext;
      const actions=document.createElement("div"); actions.className="file-actions";
      const edit=document.createElement("button"); edit.className="icon-btn"; edit.type="button"; edit.title="Editar"; edit.textContent="✎";
      edit.addEventListener("click",()=>openEdit(doc));
      const del=document.createElement("button"); del.className="icon-btn"; del.type="button"; del.title="Eliminar"; del.textContent="×";
      del.addEventListener("click",()=>deleteDocument(doc));
      actions.append(edit,del); top.append(type,actions);
      const title=document.createElement("h4"); title.textContent=doc.file_name;
      const meta=document.createElement("div"); meta.className="file-meta";
      const size=document.createElement("span"); size.textContent=fileSize(doc.file_size);
      const date=document.createElement("span"); date.textContent=new Date(doc.created_at).toLocaleDateString("es-MX");
      meta.append(size,date);
      const tag=document.createElement("span"); tag.className="category-tag"; tag.textContent=doc.category;
      const kind=document.createElement("div"); kind.className="file-kind"; kind.textContent=`Tipo: ${doc.document_type || "Otro"}`;
      const link=document.createElement("a"); link.className="file-open"; link.href="#"; link.textContent="Ver / descargar →";
      link.addEventListener("click",async(e)=>{e.preventDefault();await openDocument(doc);});
      card.append(top,title,meta,tag,kind,link); $("fileGrid").append(card);
    });
  }
  document.querySelectorAll(".nav-item").forEach(btn=>btn.addEventListener("click",()=>{
    document.querySelectorAll(".nav-item").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");activeCategory=btn.dataset.category;renderDocuments();
  }));
  $("searchInput").addEventListener("input",renderDocuments);

  function chooseFile(){ $("fileInput").click(); }
  $("chooseFileBtn").addEventListener("click",chooseFile);
  $("topUploadBtn").addEventListener("click",chooseFile);
  $("fileInput").addEventListener("change",async()=>{
    const file=$("fileInput").files[0]; if(!file)return;
    const allowed=["application/pdf","image/jpeg","image/png","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if(!allowed.includes(file.type)){message("appMessage","Formato no permitido. Usa PDF, JPG, PNG o Word.",true);$("fileInput").value="";return;}
    if(file.size>10*1024*1024){message("appMessage","El archivo supera el límite recomendado de 10 MB.",true);$("fileInput").value="";return;}
    const category=activeCategory==="Todos"?"Documentos Privados":activeCategory;
    const path=`${currentUser.id}/${Date.now()}_${safeName(file.name)}`;
    message("appMessage","Subiendo documento...");
    const {error:uploadError}=await supabaseClient.storage.from(BUCKET).upload(path,file,{upsert:false});
    if(uploadError){message("appMessage",`Error al subir: ${uploadError.message}`,true);$("fileInput").value="";return;}
    const {error:insertError}=await supabaseClient.from(TABLE).insert({
      user_id:currentUser.id,file_name:file.name,storage_path:path,category,
      file_size:file.size,mime_type:file.type,document_type:$("uploadType").value
    });
    if(insertError){
      await supabaseClient.storage.from(BUCKET).remove([path]);
      message("appMessage",`No se guardaron los datos: ${insertError.message}`,true);
    }else{message("appMessage","Documento guardado correctamente.");await loadDocuments();}
    $("fileInput").value="";
  });

  async function openDocument(doc){
    const {data,error}=await supabaseClient.storage.from(BUCKET).createSignedUrl(doc.storage_path,60);
    if(error){message("appMessage",`No se pudo abrir el archivo: ${error.message}`,true);return;}
    window.open(data.signedUrl,"_blank","noopener");
  }
  async function deleteDocument(doc){
    if(!confirm(`¿Eliminar "${doc.file_name}"? Esta acción no se puede deshacer.`))return;
    message("appMessage","Eliminando documento...");
    const {error:storageError}=await supabaseClient.storage.from(BUCKET).remove([doc.storage_path]);
    if(storageError){message("appMessage",storageError.message,true);return;}
    const {error}=await supabaseClient.from(TABLE).delete().eq("id",doc.id);
    if(error){message("appMessage",error.message,true);return;}
    message("appMessage","Documento eliminado.");await loadDocuments();
  }
  function openEdit(doc){
    $("editId").value=doc.id;$("editName").value=doc.file_name;$("editCategory").value=doc.category;
    $("editType").value=doc.document_type || "Otro";
    $("editDialog").showModal();
  }
  $("closeDialog").addEventListener("click",()=>$("editDialog").close());
  $("cancelEdit").addEventListener("click",()=>$("editDialog").close());
  $("editForm").addEventListener("submit",async(e)=>{
    e.preventDefault();
    const id=$("editId").value, file_name=$("editName").value.trim(), category=$("editCategory").value;
    const document_type=$("editType").value;
    const {error}=await supabaseClient.from(TABLE).update({file_name,category,document_type}).eq("id",id);
    if(error){message("appMessage",error.message,true);return;}
    $("editDialog").close();message("appMessage","Cambios guardados.");await loadDocuments();
  });

  async function init(){
    if(!configured()){
      showAuth();message("authMessage","Configura SUPABASE_URL y SUPABASE_ANON_KEY en js/config.js para comenzar.",true);return;
    }
    if(!window.supabase){message("authMessage","No se pudo cargar Supabase. Revisa tu conexión a internet.",true);return;}
    supabaseClient=window.supabase.createClient(window.SUPABASE_URL,window.SUPABASE_ANON_KEY);
    supabaseClient.auth.onAuthStateChange((_event,session)=>{
      if(session && !currentUser){currentUser=session.user;showApp();setUserInfo();loadDocuments();}
      if(!session){currentUser=null;showAuth();}
    });
    await checkSession();
  }
  init();
})();