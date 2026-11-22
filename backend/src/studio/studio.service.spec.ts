import { BadRequestException, GoneException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { StudioService } from './studio.service';

const id = '123456789012345678901234';
const otherId = '223456789012345678901234';
const token = 'a'.repeat(64);

function found(value: unknown) {
  const chain: any = { lean: jest.fn().mockResolvedValue(value), select: jest.fn() };
  chain.select.mockReturnValue(chain);
  return chain;
}
function fixture() {
  const created: any[] = [];
  const model = {
    create: jest.fn(async (record: Record<string, any>) => {
      const stored: any = { _id: id, ...record, save: jest.fn().mockResolvedValue(undefined), toObject() { return { ...stored }; } };
      created.push(stored);
      return stored;
    }),
    exists: jest.fn().mockResolvedValue({ _id: otherId }),
    findOne: jest.fn(() => found(null)),
    findOneAndUpdate: jest.fn(() => found(null)),
    deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }),
    countDocuments: jest.fn().mockResolvedValue(0),
  };
  const mail = { send: jest.fn().mockResolvedValue({ sent: true }) };
  const config = { get: jest.fn((key: string) => key === 'FRONTEND_URL' ? 'https://gallerista.app' : undefined) };
  const service: StudioService = new StudioService(model as any, mail as any, config as any);
  return { service, model, mail, created };
}
describe('Studio Manager tenant-safe workflows', () => {
  it('rejects unknown record sections', () => {
    const { service } = fixture();
    expect(() => service.kind('__proto__')).toThrow(BadRequestException);
    expect(() => service.kind('root')).toThrow(BadRequestException);
  });
  it('scopes lists by authenticated owner, not by client-selected userId', async () => {
    const { service, model } = fixture();
    const chain: any = { sort: jest.fn(), skip: jest.fn(), limit: jest.fn(), lean: jest.fn().mockResolvedValue([]) };
    chain.sort.mockReturnValue(chain);
    chain.skip.mockReturnValue(chain);
    chain.limit.mockReturnValue(chain);
    model.find = jest.fn(() => chain) as any;
    await service.list('owner-A', 'contacts', { userId: 'owner-B', limit: 9999, page: 1 });
    expect(model.find).toHaveBeenCalledWith({ userId: 'owner-A', kind: 'contacts' });
    expect(chain.limit).toHaveBeenCalledWith(250);
  });
  it('requires a related contact to belong to the same studio owner', async () => {
    const { service, model } = fixture();
    model.exists.mockResolvedValue(null);
    await expect(service.create('owner-A', 'projects', { title: 'Wedding', contactId: otherId })).rejects.toBeInstanceOf(BadRequestException);
    expect(model.exists).toHaveBeenCalledWith({ userId: 'owner-A', kind: 'contacts', _id: otherId });
    expect(model.create).not.toHaveBeenCalled();
  });
  it('computes invoice total on the server and ignores supplied amount', async () => {
    const { service, model } = fixture();
    const result = await service.create('owner-A', 'invoices', {
      title: 'Wedding package', email: 'client@example.com', amount: 9999999, currency: 'BDT',
      details: { lines: [{ name: 'Session', quantity: 2, unitPrice: 750 }], discountPercent: 10, taxPercent: 5 },
    }) as any;
    // subtotal 1500; discount 150; tax 67.50
    expect(result.amount).toBe(1417.5);
    expect(result.details.total).toBe(1417.5);
    expect(result.status).toBe('draft');
    expect(result.userId).toBe('owner-A');
    expect(result.token).toMatch(/^[a-f0-9]{64}$/);
    expect(model.create).toHaveBeenCalledTimes(1);
  });
  it('never permits manually setting an invoice paid via generic create or update', async () => {
    const { service, model } = fixture();
    await expect(service.create('owner-A', 'invoices', {
      title: 'Invoice', email: 'client@example.com', status: 'paid',
    })).rejects.toBeInstanceOf(BadRequestException);
    const doc = { _id: id, userId: 'owner-A', kind: 'invoices', status: 'draft', details: {}, save: jest.fn() };
    model.findOne.mockReturnValue(doc as any);
    await expect(service.update('owner-A', 'invoices', id, { status: 'paid' })).rejects.toBeInstanceOf(BadRequestException);
  });
  it('only allows public contact forms after publishing', async () => {
    const { service, model } = fixture();
    model.findOne.mockReturnValue(found({ userId: 'owner-A', kind: 'forms', token, status: 'draft' }) as any);
    await expect(service.publicForm(token)).rejects.toBeInstanceOf(NotFoundException);
  });
  it('prevents signing an already completed contract', async () => {
    const { service, model } = fixture();
    model.findOne.mockResolvedValue(null as any);
    await expect(service.signContract(token, { signerName: 'Jane Smith', accept: true })).rejects.toBeInstanceOf(GoneException);
  });
  it('requires SMTP success before moving a contract into sent status', async () => {
    const { service, model, mail } = fixture();
    const record = {
      _id: id, userId: 'owner-A', kind: 'documents', type: 'contract',
      title: 'Wedding Contract', email: 'jane@example.com', status: 'draft', token,
      contactId: '', save: jest.fn(), toObject: jest.fn(),
    };
    model.findOne.mockReturnValue(record as any);
    mail.send.mockResolvedValue({ sent: false });
    await expect(service.sendContract('owner-A', id)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(record.status).toBe('draft');
    expect(record.save).not.toHaveBeenCalled();
  });
});
