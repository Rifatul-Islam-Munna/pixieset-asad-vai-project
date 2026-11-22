import { BadRequestException, GoneException, NotFoundException } from '@nestjs/common';
import { StudioService } from './studio.service';

const id = '123456789012345678901234';
const templateId = '223456789012345678901234';
const token = 'a'.repeat(64);
function query(value: unknown) {
  const q: any = { lean: jest.fn().mockResolvedValue(value), select: jest.fn() };
  q.select.mockReturnValue(q);
  return q;
}
function fixture() {
  const created: any[] = [];
  const model = {
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    create: jest.fn(async (data: any) => {
      const document = { _id: id, ...data, toObject: () => ({ _id: id, ...data }) };
      created.push(document);
      return document;
    }),
    updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    exists: jest.fn().mockResolvedValue(true),
  };
  const service = new StudioService(model as any, {
    send: jest.fn().mockResolvedValue({ sent: true }),
  } as any, { get: (key: string) => key === 'FRONTEND_URL' ? 'https://gallerista.app' : undefined } as any);
  return { service, model, created };
}

describe('Studio Manager external workflows', () => {
  it('publishes contact forms and delivers validated enquiries to the inbox', async () => {
    const { service, model, created } = fixture();
    const form = {
      _id: id, userId: 'owner-A', kind: 'forms', token, status: 'published',
      title: 'New Inquiry',
      details: { fields: [{ name: 'date', label: 'Event date', required: true }], contactType: 'lead' },
    };
    model.findOne.mockImplementation((filter) => filter.kind === 'forms' ? query(form) : null);
    await expect(service.submitForm(token, { name: 'Jane', email: 'jane@example.com', responses: {} })).rejects.toBeInstanceOf(BadRequestException);
    expect(created).toHaveLength(0);
    const result = await service.submitForm(token, { name: 'Jane', email: 'jane@example.com', responses: { date: '2027-01-14' } });
    expect(result.submitted).toBe(true);
    expect(created).toHaveLength(2);
    expect(created[0].kind).toBe('contacts');
    expect(created[0].userId).toBe('owner-A');
    expect(created[1].kind).toBe('messages');
    expect(created[1].details.responses.date).toBe('2027-01-14');
  });

  it('keeps draft manual payment links private', async () => {
    const { service, model } = fixture();
    model.findOne.mockReturnValue(query({
      kind: 'payment-links', token, status: 'draft', amount: 250, currency: 'USD', details: {},
    }));
    await expect(service.publicPaymentLink(token)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('exposes only active, unexpired manual payment instructions', async () => {
    const { service, model } = fixture();
    model.findOne.mockReturnValue(query({
      kind: 'payment-links', token, status: 'active', title: 'Studio session', amount: 250, currency: 'USD',
      dueDate: new Date(Date.now() + 86400000), details: { notes: 'Bank transfer to studio' },
    }));
    const result = await service.publicPaymentLink(token);
    expect(result.onlinePaymentEnabled).toBe(false);
    expect(result.instructions).toBe('Bank transfer to studio');
    expect(result.amount).toBe(250);
  });

  it('creates an editable new document from an owned template', async () => {
    const { service, model, created } = fixture();
    model.findOne.mockReturnValue(query({
      _id: templateId, userId: 'owner-A', kind: 'templates', type: 'contract',
      title: 'Standard Wedding Contract', description: '', details: { content: 'Client terms here.' },
    }));
    await service.useTemplate('owner-A', templateId);
    expect(created).toHaveLength(1);
    expect(created[0].kind).toBe('documents');
    expect(created[0].details.content).toBe('Client terms here.');
    expect(created[0].status).toBe('draft');
  });

  it('cannot accept a quote twice', async () => {
    const { service, model } = fixture();
    model.findOne.mockResolvedValue(null);
    await expect(service.acceptQuote(token, { signerName: 'Jane', accept: true })).rejects.toBeInstanceOf(GoneException);
  });

  it('records paid invoices using an atomic status transition', async () => {
    const { service, model, created } = fixture();
    const invoice = {
      _id: id, userId: 'owner-A', kind: 'invoices', title: 'Wedding',
      status: 'sent', amount: 100, currency: 'USD',
      details: { number: 'INV-1' }, contactId: '', projectId: '',
    };
    model.findOne.mockResolvedValue(invoice);
    model.findOneAndUpdate.mockReturnValue(query({ ...invoice, status: 'paid' }));
    const result = await service.recordPayment('owner-A', id, { method: 'Cash' });
    expect(result.invoice.status).toBe('paid');
    expect(created).toHaveLength(1);
    expect(created[0].kind).toBe('transactions');
    expect(model.findOneAndUpdate.mock.calls[0][0]).toMatchObject({
      userId: 'owner-A', kind: 'invoices', status: { $nin: ['paid', 'cancelled'] },
    });
  });

  it('rejects racing double-payment requests if status was already changed', async () => {
    const { service, model, created } = fixture();
    model.findOne.mockResolvedValue({
      _id: id, userId: 'owner-A', kind: 'invoices', title: 'Wedding',
      status: 'sent', amount: 100, currency: 'USD', details: {},
    });
    model.findOneAndUpdate.mockReturnValue(query(null));
    await expect(service.recordPayment('owner-A', id, { method: 'Cash' })).rejects.toBeInstanceOf(BadRequestException);
    expect(created).toHaveLength(0);
  });
});
