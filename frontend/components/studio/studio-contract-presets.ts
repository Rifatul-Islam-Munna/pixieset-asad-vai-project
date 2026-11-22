import type { JSONContent } from "@tiptap/core";

export type ContractTemplatePreset = {
  id:string;
  title:string;
  description:string;
  documentTitle:string;
  contentDoc:JSONContent;
};

type Block={heading?:string;paragraph?:string;bullets?:string[]};

const T = (text:string):JSONContent=>({type:"text",text});
const P = (text:string):JSONContent=>({type:"paragraph",content:[T(text)]});
const H = (text:string,level=2):JSONContent=>({type:"heading",attrs:{level},content:[T(text)]});
const L = (items:string[]):JSONContent=>({type:"bulletList",content:items.map(item=>({type:"listItem",content:[P(item)]}))});
const makeDoc=(heading:string,sections:Block[]):JSONContent=>({
  type:"doc",
  content:[
    H(heading,1),
    P("Client: {{client_name}} ({{client_email}})"),
    P("Photographer / Studio: {{photographer_name}}"),
    P("Project: {{project_title}}"),
    P("Event date: {{event_date}}    Location: {{location}}"),
    P("Date of agreement: {{today}}"),
    ...sections.flatMap(section=>[
      ...(section.heading?[H(section.heading)]:[]),
      ...(section.paragraph?[P(section.paragraph)]:[]),
      ...(section.bullets?.length?[L(section.bullets)]:[]),
    ]),
    H("Acknowledgement"),
    P("By acknowledging this document, the client confirms that they have reviewed the written terms. The parties should keep a copy of the final agreement and resolve any changes in writing."),
    P("Client name: {{client_name}}"),
    P("Photographer / Studio: {{photographer_name}}"),
  ],
});
const shared:Block[]=[
  {heading:"Project and services",paragraph:"The Photographer will provide photographic services for {{project_title}} at {{location}} on {{event_date}}. The specific hours, deliverables, and any special requirements will be confirmed in writing before the session."},
  {heading:"Fees and payment",paragraph:"The project fee is {{fee}}. The invoice and any written payment schedule will specify any deposit, balance due, and payment method. Additional work requires agreement on its cost before it begins."},
  {heading:"Editing and delivery",paragraph:"The Photographer will select and edit the images according to the agreed package. The parties will confirm the approximate delivery timeframe, file format, and any revision allowance in writing."},
  {heading:"Rescheduling and cancellation",paragraph:"If a date change or cancellation becomes necessary, the client should notify the Photographer promptly. Any deposit treatment, refund, or rescheduling charge must be separately specified and agreed in writing."},
  {heading:"Copyright and permitted use",paragraph:"Unless otherwise agreed in a signed written amendment, the Photographer retains copyright in their original work. The client receives permission to use delivered images for the uses specifically agreed for this project."},
  {heading:"Unforeseen circumstances",paragraph:"If illness, equipment failure, venue restrictions, unsafe conditions, or other circumstances prevent the agreed work, both parties will communicate promptly and discuss reasonable alternatives. Applicable local law governs any liability or remedies."},
];

const presets:ContractTemplatePreset[]=[
  {
    id:"general-photography",title:"Photography Services Agreement",
    description:"General portrait and event photography",
    documentTitle:"Photography Services Agreement",
    contentDoc:makeDoc("Photography Services Agreement",shared),
  },
  {
    id:"wedding",title:"Wedding Photography",
    description:"Wedding-day coverage, deliverables and shot priorities",
    documentTitle:"Wedding Photography Agreement",
    contentDoc:makeDoc("Wedding Photography Agreement",[
      {heading:"Coverage and schedule",paragraph:"The Photographer will cover the agreed wedding celebrations for {{project_title}} on {{event_date}} at {{location}}. The couple and Photographer will confirm coverage hours, primary locations, the timeline and key family photographs in advance."},
      {heading:"Deliverables",paragraph:"The parties will confirm the photo-gallery delivery timeframe, approximate number or scope of edited images, digital formats and any albums or prints included in the package."},
      {heading:"Additional photographers",paragraph:"If an assistant or second photographer is required, the Photographer will clarify staffing arrangements before the event. No particular photograph is guaranteed when access, weather, schedules or participant cooperation are outside the Photographer's control."},
      ...shared.slice(1),
    ]),
  },
  {
    id:"portrait",title:"Portrait / Family Session",
    description:"Individual, family, maternity or graduation portraits",
    documentTitle:"Portrait Session Agreement",
    contentDoc:makeDoc("Portrait Session Agreement",[
      {heading:"Session details",paragraph:"The Photographer will conduct a portrait session for {{client_name}} on {{event_date}} at {{location}}. Participants, session duration, outfit guidance and any location permissions should be agreed beforehand."},
      {heading:"Selection and retouching",paragraph:"The client will receive a selection of edited photographs consistent with the agreed package. Additional retouching requests or extra images may require a separately approved fee."},
      ...shared.slice(1),
    ]),
  },
  {
    id:"event",title:"Event Photography",
    description:"Corporate events, conferences and celebrations",
    documentTitle:"Event Photography Agreement",
    contentDoc:makeDoc("Event Photography Agreement",[
      {heading:"Event coverage",paragraph:"The Photographer will document {{project_title}} at {{location}} on {{event_date}}. The client will arrange venue access, provide an itinerary, and identify any restricted areas or consent requirements."},
      {heading:"Priority shots",paragraph:"The client may supply a written list of preferred people, moments and activities. The Photographer will use reasonable efforts to capture them, subject to event conditions and access."},
      ...shared.slice(1),
    ]),
  },
  {
    id:"commercial",title:"Commercial Photography & Licensing",
    description:"Brand, product, advertising and marketing images",
    documentTitle:"Commercial Photography and Image Licence",
    contentDoc:makeDoc("Commercial Photography and Image Licence",[
      {heading:"Creative brief and production",paragraph:"The Photographer will create images for {{project_title}} based on the final written brief. The parties should agree on usage, production schedule, talent, locations, props, editing, and delivery requirements."},
      {heading:"Image licence",paragraph:"The final licence should specify the permitted media, territories, duration, exclusivity, alterations and whether sublicensing is allowed. No broad or perpetual rights should be assumed unless expressly granted in writing."},
      {heading:"Third-party permissions",paragraph:"The client is responsible for identifying any required trademarks, products, property or model permissions, unless the parties have assigned those tasks differently in writing."},
      ...shared.slice(1,4),
    ]),
  },
  {
    id:"videography",title:"Videography / Film Production",
    description:"Video coverage, revisions and music licensing",
    documentTitle:"Videography Services Agreement",
    contentDoc:makeDoc("Videography Services Agreement",[
      {heading:"Scope of film services",paragraph:"The Videographer will provide the services described in the agreed brief for {{project_title}} on {{event_date}} at {{location}}. The brief should state filming hours, crew, equipment and intended deliverables."},
      {heading:"Editing and revisions",paragraph:"The parties should agree on the number and duration of finished videos, aspect ratios, captions, review rounds and a reasonable estimated delivery date. Additional revisions require written approval."},
      {heading:"Music and third-party rights",paragraph:"Music, stock footage, logos and other third-party materials must be properly licensed for the client's intended distribution. The parties will identify who is responsible for the licences."},
      ...shared.slice(1,4),
    ]),
  },
  {
    id:"equipment",title:"Camera / Equipment Rental",
    description:"Camera gear rental, use, return and condition",
    documentTitle:"Camera Equipment Rental Agreement",
    contentDoc:makeDoc("Camera Equipment Rental Agreement",[
      {heading:"Equipment and period",paragraph:"The Owner will provide the camera equipment described in an attached equipment schedule for use on {{project_title}}. The parties will record serial numbers, accessories, rental dates and the handover condition."},
      {heading:"Fees, deposit and return",paragraph:"The rental fee is {{fee}}. Any refundable deposit, payment date, return location and late-return charge must be agreed in writing before handover."},
      {heading:"Care, loss and damage",paragraph:"The renter will use the equipment responsibly, follow reasonable instructions and promptly report faults, loss or damage. Any repair or replacement responsibility is subject to the written terms and applicable law."},
      {heading:"Insurance and permitted operators",paragraph:"The parties should specify who may operate the equipment, any insurance requirements, and restrictions on sub-rental or use in hazardous conditions."},
    ]),
  },
  {
    id:"model-release",title:"Photo / Model Release",
    description:"Permission for specified image publication",
    documentTitle:"Photography Model Release",
    contentDoc:makeDoc("Photography Model Release",[
      {heading:"Images and permitted use",paragraph:"The Subject named {{client_name}} is asked to grant permission for photographs taken for {{project_title}} to be used for the purposes and media explicitly listed in the final agreement. The scope, duration and geographic reach should be filled in before signing."},
      {heading:"Compensation and withdrawal",paragraph:"Any compensation, restrictions and withdrawal procedure should be recorded in writing. The parties should consider applicable consent, privacy and image-rights laws, including any rules affecting minors."},
      {heading:"No implied consent",paragraph:"This template does not itself authorize uses that are not described clearly in the completed document. The Photographer should obtain any required additional permissions."},
    ]),
  },
];

export const CONTRACT_PRESETS=presets;

export type ContractVariables=Record<string,string>;
export function replaceContractVariables(value:string, variables:ContractVariables):string{
  return value.replace(/\{\{([a-z_]+)\}\}/g,(whole,key)=>{
    const replacement=variables[key];
    return replacement?.trim()?replacement:"—";
  });
}
export function renderContractDoc(doc:JSONContent,variables:ContractVariables):JSONContent{
  return {
    ...doc,
    ...(typeof doc.text==="string"?{text:replaceContractVariables(doc.text as string,variables)}:{}),
    ...(doc.content?{content:doc.content.map(child=>renderContractDoc(child,variables))}:{}),
  };
}
export function contractDocPlainText(doc:JSONContent):string{
  if(doc.type==="text")return doc.text||"";
  const text=(doc.content||[]).map(contractDocPlainText).join(doc.type==="paragraph"?"":" ");
  return ["paragraph","heading","listItem"].includes(doc.type||"")?text+"\n":text;
}
export function textContractDoc(value:string):JSONContent{
  return {type:"doc",content:value.split(/\n+/).filter(Boolean).map(line=>P(line))};
}
