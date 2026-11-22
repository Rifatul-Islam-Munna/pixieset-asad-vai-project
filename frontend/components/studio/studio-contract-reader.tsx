"use client";

import {useEffect, useMemo} from "react";
import {EditorContent, useEditor} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import type {JSONContent} from "@tiptap/core";
import {renderContractDoc, textContractDoc} from "./studio-contract-presets";
const EMPTY_VARIABLES:Record<string,string>={};

export const CONTRACT_DOC_STYLE=[
  "font-sans text-[#25222b] text-[14px] leading-[1.85]",
  "[&_.ProseMirror]:outline-none",
  "[&_h1]:mb-8 [&_h1]:mt-3 [&_h1]:text-[24px] [&_h1]:font-semibold [&_h1]:tracking-tight",
  "[&_h2]:mb-3 [&_h2]:mt-9 [&_h2]:text-[17px] [&_h2]:font-semibold",
  "[&_h3]:mb-2 [&_h3]:mt-6 [&_h3]:text-[15px] [&_h3]:font-semibold",
  "[&_p]:mb-3",
  "[&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-7",
  "[&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-7",
  "[&_li]:mb-1",
  "[&_blockquote]:my-6 [&_blockquote]:border-l-2 [&_blockquote]:border-[#8c6fcf] [&_blockquote]:pl-5",
  "[&_hr]:my-8 [&_hr]:border-[#e8e3ef]",
  "[&_a]:text-[#6337d8] [&_a]:underline",
].join(" ");

export function StudioContractReader({contentDoc,content="",variables=EMPTY_VARIABLES,className=""}:{
  contentDoc?:JSONContent|null;content?:string;variables?:Record<string,string>;className?:string;
}) {
  const resolved=useMemo(()=>
    renderContractDoc(contentDoc?.type==="doc"?contentDoc:textContractDoc(content),variables),
    [contentDoc,content,variables]
  );
  const editor=useEditor({
    extensions:[StarterKit,Underline,Link.configure({openOnClick:true,autolink:false})],
    editable:false,
    content:resolved,
    immediatelyRender:false,
  });
  useEffect(()=>{if(editor&&!editor.isDestroyed)editor.commands.setContent(resolved,{emitUpdate:false});},[editor,resolved]);
  return <div className={CONTRACT_DOC_STYLE+" "+className}><EditorContent editor={editor}/></div>;
}
