import { StudioSubscriptionService } from './studio-subscription.service';
import { AdminService } from '../admin/admin.service';

const freeLimits = { studioContactLimit:10, studioProjectLimit:10, studioProductLimit:3, studioQuestionnaireLimit:3, studioQuoteLimit:3, studioMonthlyEmails:25 };
function makeService(user: Record<string, unknown>, plan: Record<string,unknown>|null=null, count=0){
  const users={findById:jest.fn().mockReturnValue({lean:jest.fn().mockResolvedValue(user)}),updateOne:jest.fn().mockResolvedValue({modifiedCount:1})};
  const plans={findOne:jest.fn().mockReturnValue({lean:jest.fn().mockResolvedValue(plan)})};
  const records={countDocuments:jest.fn().mockResolvedValue(count)};
  const products={countDocuments:jest.fn().mockResolvedValue(count)};
  const free={get:jest.fn().mockResolvedValue(freeLimits)};
  const service=new StudioSubscriptionService(users as any,plans as any,records as any,products as any,free as any);
  return {service,users,plans,records,products,free};
}

describe('independent Studio Manager subscriptions',()=>{
  it.each([
    ['administrator', {role:'admin',studioPlanId:'studio-1'}, {priceMonthly:20}, '/admin'],
    ['free account', {role:'user'}, null, '/dashboard/client-gallery'],
    ['Gallery subscriber', {role:'user',planId:'gallery-1'}, null, '/dashboard/client-gallery'],
    ['active Studio purchase', {studioPlanId:'studio-1',studioPlanExpiresAt:new Date(Date.now()+60000)}, {priceMonthly:20}, '/dashboard/studio-management/home'],
    ['both subscriptions', {planId:'gallery-1',studioPlanId:'studio-1',studioPlanExpiresAt:new Date(Date.now()+60000)}, {priceMonthly:20}, '/dashboard/studio-management/home'],
    ['expired Studio purchase', {studioPlanId:'studio-1',studioPlanExpiresAt:new Date(Date.now()-60000)}, {priceMonthly:20}, '/dashboard/client-gallery'],
    ['admin-assigned Studio plan', {studioPlanId:'studio-1'}, {priceMonthly:20}, '/dashboard/studio-management/home'],
    ['free Studio plan', {studioPlanId:'studio-1'}, {priceMonthly:0}, '/dashboard/client-gallery'],
    ['missing Studio plan', {studioPlanId:'studio-1',studioPlanExpiresAt:new Date(Date.now()+60000)}, null, '/dashboard/client-gallery'],
  ] as const)('routes %s to the correct dashboard', async (_label,user,plan,destination)=>{
    const {service,users,plans,records,products}=makeService(user,plan);
    users.findById.mockReturnValue({select:jest.fn().mockReturnValue({lean:jest.fn().mockResolvedValue(user)})});
    plans.findOne.mockReturnValue({select:jest.fn().mockReturnValue({lean:jest.fn().mockResolvedValue(plan)})});
    expect(await service.dashboardDestination('user-1')).toBe(destination);
    expect(records.countDocuments).not.toHaveBeenCalled();
    expect(products.countDocuments).not.toHaveBeenCalled();
  });
  it('uses free Studio allowances independently of a paid Client Gallery plan',async()=>{
    const {service,plans}=makeService({planName:'Gallery Pro',planId:'gallery-1'});
    const result=await service.overview('user-1');
    expect(result).toMatchObject({planName:'Free',status:'free',gallery:{planName:'Gallery Pro'},limits:{contacts:10,emails:25}});
    expect(plans.findOne).not.toHaveBeenCalled();
  });
  it('resolves current paid Studio limits without changing gallery entitlements',async()=>{
    const {service,plans,free}=makeService({studioPlanId:'studio-1',studioPlanExpiresAt:new Date(Date.now()+60000),planName:'Gallery Basic'},{_id:'studio-1',name:'Studio Pro',...freeLimits,studioContactLimit:100,studioMonthlyEmails:400});
    const result=await service.overview('user-1');
    expect(result).toMatchObject({planName:'Studio Pro',status:'active',gallery:{planName:'Gallery Basic'},limits:{contacts:100,emails:400}});
    expect(plans.findOne).toHaveBeenCalledWith({_id:'studio-1',productType:'studio-manager'});
    expect(free.get).not.toHaveBeenCalled();
  });
  it('returns to free limits after expiry while retaining previous expiration',async()=>{
    const expires=new Date(Date.now()-60000);
    const {service,plans}=makeService({studioPlanId:'studio-1',studioPlanExpiresAt:expires});
    expect(await service.overview('user-1')).toMatchObject({planName:'Free',status:'expired',previousExpiresAt:expires,limits:{contacts:10}});
    expect(plans.findOne).not.toHaveBeenCalled();
  });
  it('blocks a record at its limit and releases the quota lock',async()=>{
    const {service,users}=makeService({},null,10);
    const create=jest.fn();
    await expect(service.withRecordQuota('user-1','contacts',create)).rejects.toThrow('contacts limit reached');
    expect(create).not.toHaveBeenCalled();
    expect(users.updateOne).toHaveBeenLastCalledWith(expect.objectContaining({_id:'user-1','studioQuotaLock.token':expect.any(String)}),{$unset:{studioQuotaLock:''}});
  });
  it('allows a record within quota and releases the lock after the write',async()=>{
    const {service,records,users}=makeService({},null,2);
    const create=jest.fn().mockResolvedValue({id:'quote-1'});
    expect(await service.withRecordQuota('user-1','quotes',create)).toEqual({id:'quote-1'});
    expect(records.countDocuments).toHaveBeenCalledWith({userId:'user-1',kind:'documents',type:'quote'});
    expect(create).toHaveBeenCalledTimes(1);
    expect(users.updateOne).toHaveBeenCalledTimes(2);
  });
  it('atomically reserves email quota and refuses when the counter is full',async()=>{
    const {service,users}=makeService({});
    const key=await service.reserveEmail('user-1');
    expect(key).toMatch(/^\d{4}-\d{2}$/);
    expect(users.updateOne).toHaveBeenLastCalledWith({_id:'user-1',studioMonthlyUsageKey:key,studioMonthlyEmailsUsed:{$lt:25}},{$inc:{studioMonthlyEmailsUsed:1}});
    users.updateOne.mockResolvedValueOnce({modifiedCount:0}).mockResolvedValueOnce({modifiedCount:0});
    await expect(service.reserveEmail('user-1')).rejects.toThrow('monthly email limit reached');
  });
  it('activates only Studio fields when a Studio plan is purchased',async()=>{
    const admin=Object.create(AdminService.prototype) as AdminService;
    const plan={_id:'studio-1',productType:'studio-manager',name:'Studio Pro',priceMonthly:20,priceYearly:200};
    const updateOne=jest.fn().mockResolvedValue({});
    const purchases={exists:jest.fn().mockResolvedValue(false),updateOne:jest.fn().mockResolvedValue({})};
    Object.assign(admin,{planModel:{findById:jest.fn().mockReturnValue({lean:jest.fn().mockResolvedValue(plan)})},userModel:{updateOne},planPurchaseModel:purchases});
    await admin.assignPlanToUser('user-1','studio-1','checkout','stripe-session','month');
    const update=updateOne.mock.calls[0][1];
    expect(update.$set).toMatchObject({studioPlanId:'studio-1',studioPlanName:'Studio Pro',studioPlanExpiresAt:expect.any(Date)});
    expect(update.$set).not.toHaveProperty('planId');
    expect(update.$set).not.toHaveProperty('storageLimitGb');
    expect(update.$set).not.toHaveProperty('monthlyEmailsUsed');
    expect(purchases.updateOne).toHaveBeenCalledWith({stripeSessionId:'stripe-session'},{$setOnInsert:expect.objectContaining({productType:'studio-manager',expiresAt:expect.any(Date),amount:20})},{upsert:true});
  });
});
