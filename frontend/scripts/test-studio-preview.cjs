const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const ts=require("typescript");

function storage(){
  const data=new Map();
  return {
    get length(){return data.size;},
    key(i){return Array.from(data.keys())[i]??null;},
    getItem(k){return data.get(k)??null;},
    setItem(k,v){data.set(k,String(v));},
    removeItem(k){data.delete(k);},
  };
}
function setup(){
  const localStorage=storage();
  const sessionStorage=storage();
  const opened=[];
  const handlers=new Map();
  const window={
    open:(url,target)=>{
      opened.push({url,target});
      return {opener:{},focus(){}};
    },
    addEventListener:(kind,handler)=>handlers.set(kind,handler),
    removeEventListener:(kind)=>handlers.delete(kind),
  };
  const crypto={randomUUID:()=> "11111111-2222-4333-8444-555555555555"};
  const source=fs.readFileSync(
    path.join(__dirname,"../components/studio/studio-client-preview.ts"),"utf8",
  );
  const compiled=ts.transpileModule(source,{compilerOptions:{
    target:ts.ScriptTarget.ES2021,module:ts.ModuleKind.CommonJS,
  }}).outputText;
  const module={exports:{}};
  vm.runInNewContext(compiled,{
    module,exports:module.exports,require,window,crypto,localStorage,sessionStorage,
    Date,JSON,Error,
  });
  return {api:module.exports,localStorage,sessionStorage,window,opened,handlers};
}

test("clicking Preview opens a separate tab with a private opaque key",()=>{
  const {api,opened,localStorage}=setup();
  const data={title:"A confidential client contract",description:"Client e-mail: private@example.com"};
  const id=api.openStudioClientPreview("contract",data);
  assert.equal(id,"11111111222243338444555555555555");
  assert.equal(opened.length,1);
  assert.equal(opened[0].target,"_blank");
  assert.ok(opened[0].url.startsWith("/dashboard/studio-management/preview#"));
  assert.ok(!opened[0].url.includes("private@example.com"));
  assert.ok(!opened[0].url.includes("confidential"));
  assert.equal(localStorage.length,1);
});

test("recipient-facing preview loads the latest unsaved values in the new tab",()=>{
  const {api,localStorage,sessionStorage}=setup();
  const data={title:"Unsaved invoice",amount:125,currency:"EUR"};
  const id=api.openStudioClientPreview("invoice",data);
  const loaded=api.readStudioClientPreview(id);
  assert.equal(loaded.kind,"invoice");
  assert.deepEqual(JSON.parse(JSON.stringify(loaded.data)),data);
  assert.equal(localStorage.length,0);
  assert.equal(sessionStorage.length,1);
  assert.equal(api.readStudioClientPreview(id).data.title,"Unsaved invoice");
});

test("blocked pop-ups do not leave a temporary preview behind",()=>{
  const {api,localStorage,window}=setup();
  window.open=()=>null;
  assert.throws(()=>api.openStudioClientPreview("form",{title:"Private"}),/blocked/);
  assert.equal(localStorage.length,0);
});

test("preview snapshots expire and cannot be fetched with a guessed key",()=>{
  const {api}=setup();
  assert.equal(api.readStudioClientPreview("nonexistent"),null);
  const id=api.openStudioClientPreview("quote",{title:"Quote"});
  const snapshot=api.readStudioClientPreview(id);
  api.updateStudioClientPreview(id,{...snapshot,createdAt:Date.now()-3600000});
  assert.equal(api.readStudioClientPreview(id),null);
});

test("studio owner save notifications are delivered only to the matching preview",()=>{
  const {api,handlers}=setup();
  const seen=[];
  const stop=api.listenForStudioPreviewSave("my-preview",recordId=>seen.push(recordId));
  const listener=handlers.get("storage");
  listener({key:"gallerista:studio-document-preview-updated",
    newValue:JSON.stringify({id:"other-preview",recordId:"wrong"})});
  listener({key:"gallerista:studio-document-preview-updated",
    newValue:JSON.stringify({id:"my-preview",recordId:"correct"})});
  assert.deepEqual(seen,["correct"]);
  stop();
  assert.equal(handlers.has("storage"),false);
});
