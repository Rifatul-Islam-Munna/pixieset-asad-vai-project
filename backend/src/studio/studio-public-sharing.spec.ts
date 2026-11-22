import {BadRequestException,NotFoundException,ServiceUnavailableException} from '@nestjs/common';
import {StudioService} from './studio.service';
import {StudioPaymentLinksService} from './studio-payment-links.service';

const id='123456789012345678901234';
const token='a'.repeat(64);
const otherToken='b'.repeat(64);
const sites={sites:[{slug:'rifat39',name:'Studio'}],rootDomain:'gallerista.app'};
const invoice={
  _id:id,userId:'owner-A',kind:'invoices',status:'draft',type:'invoice',
  title:'Wedding photography',token,email:'jane@example.com',
  amount:100,currency:'EUR',contactId:'',projectId:'',
  details:{number:'INV-001',subtotal:100,lines:[{name:'Photography',quantity:1,unitPrice:100}]},
};
const contract={
  ...invoice,kind:'documents',type:'contract',title:'Wedding contract',
  details:{content:'Wedding terms',variables:{client_name:'Jane'}},
};
const wrap=(value:any)=>({lean:jest.fn().mockResolvedValue(value),select:jest.fn().mockReturnThis()});
function fixture(record:any=invoice,siteSettings:any=sites){
  const model:any={
    findOne:jest.fn((filter:any)=>{
      if(filter.userId&&filter.userId!==record.userId)return wrap(null);
      if(filter.kind&&filter.kind!==record.kind)return wrap(null);
      if(filter.token&&filter.token!==record.token)return wrap(null);
      if(filter._id&&String(filter._id)!==String(record._id))return wrap(null);
      return wrap(record);
    }),
  };
  const mail:any={send:jest.fn().mockResolvedValue({sent:true})};
  const config:any={get:(name:string)=>name==='FRONTEND_URL'?'https://gallerista.app':name==='NODE_ENV'?'production':undefined};
  const links:any={ownerSites:jest.fn().mockResolvedValue(siteSettings)};
  const studio=new StudioService(model,mail,config,links);
  return {studio,model,mail,links};
}

describe('Public, tenant-scoped draft previews',()=>{
  it('returns a shareable owner-subdomain link for a saved draft',async()=>{
    const {studio}=fixture();
    const result=await studio.shareUrl('owner-A','invoices',id);
    expect(result).toEqual({
      url:'https://rifat39.gallerista.app/studio/invoice/'+token,
      preview:true,status:'draft',
    });
  });
  it('uses the verified studio site route during localhost development',async()=>{
    const {studio}=fixture(invoice,{sites:[{slug:'rifat39',name:'Studio'}],rootDomain:'localhost'});
    (studio as any).config.get=(key:string)=>key==='FRONTEND_URL'?
      'http://localhost:3000':key==='NODE_ENV'?'development':undefined;
    const result=await studio.shareUrl('owner-A','invoices',id);
    expect(result.url).toBe('http://localhost:3000/studio/site/rifat39/invoice/'+token);
    expect(result.preview).toBe(true);
  });
  it('generates the assigned public subdomain URL even though the app runs on localhost',async()=>{
    const previous={
      public:process.env.STUDIO_PUBLIC_ROOT_DOMAIN,
      local:process.env.ROOT_DOMAIN,
    };
    try{
      process.env.STUDIO_PUBLIC_ROOT_DOMAIN='gallerista.app';
      process.env.ROOT_DOMAIN='localhost';
      const {model,mail}=fixture(invoice);
      const homes:any={findOne:jest.fn().mockReturnValue(wrap({
        userId:'owner-A',slug:'test9582',enabled:true,
        mainSiteName:'Client Studio',subdomains:[],
      }))};
      const links=new StudioPaymentLinksService(model,homes,{} as any);
      const configuration:any={get:(key:string)=>key==='FRONTEND_URL'?
        'http://localhost:3000':key==='NODE_ENV'?'development':undefined};
      const studio=new StudioService(model,mail,configuration,links);
      const result=await studio.shareUrl('owner-A','invoices',id);
      expect(result.url).toBe('https://test9582.gallerista.app/studio/invoice/'+token);
    }finally{
      if(previous.public===undefined)delete process.env.STUDIO_PUBLIC_ROOT_DOMAIN;
      else process.env.STUDIO_PUBLIC_ROOT_DOMAIN=previous.public;
      if(previous.local===undefined)delete process.env.ROOT_DOMAIN;
      else process.env.ROOT_DOMAIN=previous.local;
    }
  });
  it('does not expose drafts through the legacy main-domain invoice API',async()=>{
    const {studio}=fixture();
    await expect(studio.publicInvoice(token)).rejects.toBeInstanceOf(NotFoundException);
  });
  it('allows a read-only invoice draft through its validated owner site',async()=>{
    const {studio,model}=fixture();
    const response=await studio.publicSiteDocument('owner-A','invoice',token);
    expect(response.preview).toBe(true);
    expect(response.data).toMatchObject({status:'draft',amount:100,currency:'EUR'});
    expect(model.findOne).toHaveBeenCalledWith(expect.objectContaining({
      userId:'owner-A',kind:'invoices',token,
    }));
  });
  it('does not expose owner A drafts to owner B or guessed tokens',async()=>{
    const {studio}=fixture();
    await expect(studio.publicSiteDocument('owner-B','invoice',token))
      .rejects.toBeInstanceOf(NotFoundException);
    await expect(studio.publicSiteDocument('owner-A','invoice',otherToken))
      .rejects.toBeInstanceOf(NotFoundException);
    await expect(studio.shareUrl('owner-B','invoices',id))
      .rejects.toBeInstanceOf(NotFoundException);
  });
  it('never lets a draft be signed, accepted or paid through public submission APIs',async()=>{
    const {studio}=fixture(contract);
    await expect(studio.signContract(token,{signerName:'Jane',accept:true}))
      .rejects.toThrow();
    const quoteFixture=fixture({...contract,type:'quote'});
    await expect(quoteFixture.studio.acceptQuote(token,{signerName:'Jane',accept:true}))
      .rejects.toThrow();
  });
  it('rejects public sharing without an enabled website',async()=>{
    const {studio}=fixture(invoice,{sites:[],rootDomain:'gallerista.app'});
    await expect(studio.shareUrl('owner-A','invoices',id))
      .rejects.toBeInstanceOf(BadRequestException);
  });
  it('rejects a dangerous configured domain rather than generating an untrusted link',async()=>{
    const {studio}=fixture(invoice,{sites:[{slug:'rifat39'}],rootDomain:'attacker.example.org/redirect'});
    await expect(studio.shareUrl('owner-A','invoices',id))
      .rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});

describe('Studio email workflow and payment status',()=>{
  function sentFixture(record:any){
    const {studio,model,mail}=fixture(record);
    const document={...record,save:jest.fn().mockResolvedValue(true),
      toObject(){return {...this};}};
    model.findOne.mockImplementation((query:any)=>{
      if(query.kind==='contacts')return {select:()=>wrap(null)};
      if(query._id&&query.userId===record.userId&&query.kind===record.kind)return document;
      return wrap(record);
    });
    const logs:any[]=[];
    model.create=jest.fn(async(payload:any)=>{
      const entry:any={...payload,save:jest.fn().mockResolvedValue(true),toObject(){return {...this};}};
      logs.push(entry);
      return entry;
    });
    return {studio,model,mail,document,logs};
  }
  it('emails a studio-subdomain invoice payment button, then marks the invoice sent',async()=>{
    const {studio,mail,document,logs}=sentFixture(invoice);
    const result=await studio.sendInvoice('owner-A',id);
    expect(result.emailSent).toBe(true);
    expect(result.url).toBe('https://rifat39.gallerista.app/studio/invoice/'+token);
    expect(mail.send).toHaveBeenCalledWith(expect.objectContaining({
      to:'jane@example.com',
      html:expect.stringContaining('View Invoice &amp; Pay Now'),
      text:expect.stringContaining('https://rifat39.gallerista.app/studio/invoice/'+token),
    }));
    expect(mail.send.mock.calls[0][0].html).toContain('href="https://rifat39.gallerista.app/studio/invoice/');
    expect(document.status).toBe('sent');
    expect(document.save).toHaveBeenCalledTimes(1);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({kind:'messages',type:'outbound',status:'sent',email:'jane@example.com'});
    expect(logs[0].details).toMatchObject({sourceKind:'invoice',smtpStatus:'accepted',acceptedBySmtp:true});
  });
  it('sends a manually composed email to a direct address and stores its SMTP activity',async()=>{
    const {studio,mail,logs}=sentFixture(invoice);
    const result=await studio.sendEmail('owner-A',{email:'jane@example.com',subject:'Session details',content:'Your session is confirmed.'});
    expect(mail.send).toHaveBeenCalledWith(expect.objectContaining({to:'jane@example.com',subject:'Session details'}));
    expect(result).toMatchObject({kind:'messages',type:'outbound',status:'sent',email:'jane@example.com'});
    expect(logs[0].details).toMatchObject({sourceKind:'manual-message',smtpStatus:'accepted'});
  });
  it('sends contract links through the studio subdomain and moves to in-progress',async()=>{
    const {studio,mail,document}=sentFixture(contract);
    const result=await studio.sendContract('owner-A',id);
    expect(result.url).toBe('https://rifat39.gallerista.app/studio/contract/'+token);
    expect(document.status).toBe('in-progress');
    expect(mail.send.mock.calls[0][0].html).toContain('Review &amp; Sign Contract');
  });
  it('never changes draft status if SMTP refuses the message',async()=>{
    const {studio,mail,document,logs}=sentFixture(invoice);
    mail.send.mockResolvedValue({sent:false});
    await expect(studio.sendInvoice('owner-A',id))
      .rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(document.status).toBe('draft');
    expect(document.save).not.toHaveBeenCalled();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({kind:'messages',type:'outbound',status:'failed'});
    expect(logs[0].details.smtpStatus).toBe('failed');
  });
  it('keeps a direct email address visible on a public invoice when no contact is linked',async()=>{
    const {studio}=fixture(invoice);
    const result=await studio.publicInvoice(token,true);
    expect(result.clientName).toBe('');
    expect(result.clientEmail).toBe('jane@example.com');
  });
  it('shows sent documents as active instead of a preview',async()=>{
    const {studio}=fixture({...invoice,status:'sent'});
    const result=await studio.publicSiteDocument('owner-A','invoice',token);
    expect(result.preview).toBe(false);
    expect(result.data).toMatchObject({status:'sent'});
  });
});

describe('Enabled public website ownership',()=>{
  it('derives owner from an enabled site, not an arbitrary userId provided by the client',async()=>{
    const homes:any={findOne:jest.fn().mockReturnValue(wrap({userId:'owner-A'}))};
    const links=new StudioPaymentLinksService({} as any,homes,{} as any);
    await expect(links.siteOwner('rifat39')).resolves.toBe('owner-A');
    expect(homes.findOne).toHaveBeenCalledWith({
      $or:[{slug:'rifat39',enabled:true},
        {subdomains:{$elemMatch:{slug:'rifat39',enabled:true}}}],
    });
  });
  it('rejects unknown and malformed tenant site slugs',async()=>{
    const homes:any={findOne:jest.fn().mockReturnValue(wrap(null))};
    const links=new StudioPaymentLinksService({} as any,homes,{} as any);
    await expect(links.siteOwner('not-registered')).rejects.toBeInstanceOf(NotFoundException);
    await expect(links.siteOwner('../../admin')).rejects.toBeInstanceOf(NotFoundException);
  });
});
