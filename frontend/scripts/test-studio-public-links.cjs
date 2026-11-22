const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const ts=require("typescript");

function fixture(options={}){
  const popups=[];
  const copied=[];
  const calls=[];
  const share=async(kind,id)=>{
    calls.push({kind,id});
    return {url:"https://rifat39.gallerista.app/studio/invoice/"+ "a".repeat(64),
      preview:true,status:"draft"};
  };
  const window={
    open:(url,target)=>{
      if(options.blocked)return null;
      const popup={
        url,target,opener:{},closed:false,navigated:"",
        location:{replace(next){popup.navigated=next;}},
        focus(){popup.focused=true;},
        close(){popup.closed=true;},
      };
      popups.push(popup);
      return popup;
    },
  };
  const source=fs.readFileSync(path.join(__dirname,"../components/studio/studio-public-links.ts"),"utf8");
  const compiled=ts.transpileModule(source,{compilerOptions:{
    target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,
  }}).outputText;
  const module={exports:{}};
  vm.runInNewContext(compiled,{
    module,exports:module.exports,
    require(name){
      assert.equal(name,"@/actions/studio");
      return {studioShareUrl:options.share||share};
    },
    window,navigator:{clipboard:{writeText:async(text)=>{copied.push(text);}}},
    Error,
  });
  return {api:module.exports,popups,calls,copied};
}

test("clicking Preview immediately opens a fresh tab, then saves the draft",async()=>{
  const {api,popups,calls}=fixture();
  let started=false;
  const promise=api.previewStudioPublicDraft("invoices",async()=>{
    assert.equal(popups.length,1);
    assert.equal(popups[0].target,"_blank");
    assert.equal(popups[0].url,"about:blank");
    started=true;
    return {_id:"record-1"};
  });
  assert.equal(popups.length,1,"open a new tab synchronously before awaiting save");
  const url=await promise;
  assert.equal(started,true);
  assert.equal(calls.length,1);
  assert.equal(calls[0].id,"record-1");
  assert.equal(popups[0].navigated,url);
  assert.ok(url.startsWith("https://rifat39.gallerista.app/"));
  assert.equal(popups[0].opener,null);
});

test("failed draft saves never create a shareable link",async()=>{
  const {api,popups,calls}=fixture();
  await assert.rejects(api.previewStudioPublicDraft("documents",async()=>null),
    /Save this document/);
  assert.equal(calls.length,0);
  assert.equal(popups[0].closed,true);
});

test("blocked popup gives an actionable error",async()=>{
  const {api,calls}=fixture({blocked:true});
  await assert.rejects(api.previewStudioPublicDraft("documents",async()=>({_id:"record-1"})),
    /Allow pop-ups/);
  assert.equal(calls.length,0);
});

test("share URL failures close the temporary blank tab safely",async()=>{
  const {api,popups}=fixture({share:async()=>{throw Error("No studio website enabled");}});
  await assert.rejects(api.previewStudioPublicDraft("invoices",async()=>({_id:"record-1"})),
    /No studio website enabled/);
  assert.equal(popups[0].closed,true);
});

test("Copy public link uses the server-owned studio subdomain",async()=>{
  const {api,copied}=fixture();
  const url=await api.copyStudioPublicLink("invoices","record-2");
  assert.equal(copied[0],url);
  assert.ok(url.startsWith("https://rifat39.gallerista.app"));
});
