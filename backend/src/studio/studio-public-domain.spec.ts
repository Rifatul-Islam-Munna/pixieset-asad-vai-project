import {studioPublicRootDomain} from './studio-public-domain';

const settings=['STUDIO_PUBLIC_ROOT_DOMAIN','ROOT_DOMAIN','NEXT_PUBLIC_ROOT_DOMAIN'] as const;
let original:Record<string,string|undefined>={};
beforeEach(()=>{
  original=Object.fromEntries(settings.map(key=>[key,process.env[key]]));
  for(const key of settings)delete process.env[key];
});
afterEach(()=>{
  for(const key of settings){
    if(original[key]===undefined)delete process.env[key];
    else process.env[key]=original[key];
  }
});
describe('Customer website hostname configuration',()=>{
  it('uses the public tenant domain even while Next.js runs on localhost',()=>{
    process.env.STUDIO_PUBLIC_ROOT_DOMAIN='gallerista.app';
    process.env.ROOT_DOMAIN='localhost';
    process.env.NEXT_PUBLIC_ROOT_DOMAIN='http://localhost:3000';
    expect(studioPublicRootDomain()).toBe('gallerista.app');
  });
  it('accepts a public https origin but returns only its hostname',()=>{
    process.env.STUDIO_PUBLIC_ROOT_DOMAIN='https://gallerista.app/';
    expect(studioPublicRootDomain()).toBe('gallerista.app');
  });
  it('accepts the older public ROOT_DOMAIN configuration',()=>{
    process.env.ROOT_DOMAIN='https://gallerista.app';
    expect(studioPublicRootDomain()).toBe('gallerista.app');
  });
  it('returns localhost only when a public domain has not been configured',()=>{
    process.env.NEXT_PUBLIC_ROOT_DOMAIN='http://localhost:3000';
    expect(studioPublicRootDomain()).toBe('localhost');
  });
});
