import { BadRequestException, GoneException, Injectable, NotFoundException, Optional, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { randomBytes } from 'node:crypto';
import { Model, Types } from 'mongoose';
import { MailService } from 'src/mail/mail.service';
import { STUDIO_KINDS, StudioKind, StudioRecord, StudioRecordDocument } from './studio-record.entity';
import { contractDocument, contractVariables } from './studio-contract-document';
import { normalizePaymentLinkSettings } from './studio-payment-link-settings';
import {quotePrice,validateQuoteItems,validateQuestionnaireAnswers,validateQuestionnaireFields} from './studio-interactive-documents';
import {validateStudioSignature} from './studio-signature';
import {StudioPaymentLinksService} from './studio-payment-links.service';

type Payload = Record<string, unknown>;
const validStatuses: Partial<Record<StudioKind, string[]>> = {
  contacts: ['client', 'lead', 'other'],
  projects: ['inquiry', 'booked', 'post-production', 'completed', 'cancelled'],
  invoices: ['draft', 'sent', 'paid', 'cancelled'],
  'payment-links': ['draft', 'active', 'expired', 'cancelled'],
  transactions: ['paid', 'refunded', 'pending'],
  documents: ['draft', 'in-progress', 'completed', 'cancelled'],
  templates: ['active', 'archived'],
  forms: ['draft', 'published', 'archived'],
  messages: ['unread', 'read', 'sending', 'sent', 'failed', 'archived'],
  discounts: ['active', 'inactive'],
};
const defaults: Partial<Record<StudioKind, string>> = {
  contacts: 'client', projects: 'inquiry', invoices: 'draft', 'payment-links': 'draft',
  transactions: 'paid', documents: 'draft', templates: 'active',
  forms: 'draft', messages: 'unread', discounts: 'active',
};
const tokenKinds: StudioKind[] = ['invoices', 'documents', 'forms', 'payment-links'];
const clean = (v: unknown, max = 240) => String(v ?? '').trim().slice(0, max);
const escapeMailHtml=(value:string)=>value.replace(/[&<>"']/g,char=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;',
}[char]||char));
function id(value: string) {
  if (!Types.ObjectId.isValid(value)) throw new NotFoundException('Record not found');
  return value;
}
function amount(value: unknown) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number) || number < 0 || number > 100000000) throw new BadRequestException('Invalid amount');
  return Math.round(number * 100) / 100;
}
function email(value: unknown) {
  const address = clean(value, 200).toLowerCase();
  if (address && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) throw new BadRequestException('Invalid email address');
  return address;
}
function date(value: unknown) {
  if (!value) return undefined;
  const result = new Date(String(value));
  if (!Number.isFinite(result.getTime())) throw new BadRequestException('Invalid date');
  return result;
}
function details(value: unknown, maxSize = 40000): Record<string, unknown> {
  if (value == null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) throw new BadRequestException('Invalid details');
  const raw = JSON.stringify(value);
  if (raw.length > maxSize) throw new BadRequestException('Record details too large');
  const result = JSON.parse(raw) as Record<string, unknown>;
  for (const key of Object.keys(result)) {
    if (key.startsWith('$') || key.includes('.') || ['__proto__', 'constructor', 'prototype'].includes(key))
      throw new BadRequestException('Invalid details field');
  }
  return result;
}
function pricing(data: Record<string, unknown>) {
  const rows = Array.isArray(data.lines) ? data.lines.slice(0, 50) : [];
  const lines = rows.map((r) => {
    const row = r && typeof r === 'object' && !Array.isArray(r) ? r as Payload : {};
    return {
      name: clean(row.name, 180) || 'Service',
      description: clean(row.description, 500),
      quantity: Math.max(0.01, Math.min(10000, Number(row.quantity) || 1)),
      unitPrice: amount(row.unitPrice),
    };
  });
  const subtotal = Math.round(lines.reduce((s, x) => s + x.quantity * x.unitPrice, 0) * 100) / 100;
  const boundedPercent = (n: unknown) => Math.min(100, amount(n));
  const discountPercent = boundedPercent(data.discountPercent);
  const taxPercent = boundedPercent(data.taxPercent);
  const discount = Math.round(subtotal * discountPercent) / 100;
  const tax = Math.round((subtotal - discount) * taxPercent) / 100;
  return { lines, subtotal, discountPercent, taxPercent, discount, tax,
    total: Math.round((subtotal - discount + tax) * 100) / 100 };
}

@Injectable()
export class StudioService {
  constructor(
    @InjectModel(StudioRecord.name) private readonly model: Model<StudioRecordDocument>,
    private readonly mail: MailService,
    private readonly config: ConfigService,
    @Optional() private readonly studioSites?:StudioPaymentLinksService,
  ) {}

  kind(raw: string): StudioKind {
    if (!(STUDIO_KINDS as readonly string[]).includes(raw))
      throw new BadRequestException('Unknown Studio Manager section');
    return raw as StudioKind;
  }

  async list(userId: string, rawKind: string, query: Payload = {}) {
    const kind = this.kind(rawKind);
    const filter: Record<string, unknown> = { userId, kind };
    if ((kind === 'contacts' || kind === 'projects') && query.search !== undefined) {
      const term = clean(query.search, 100).trim();
      if (term) {
        // Treat typed search terms literally, not as regular expression operators.
        const pattern = term.replace(/[.*+?^$()|[\]{}\\]/g, '\\$&');
        const searchable: Record<string,unknown>[] = [
          { title: { $regex: pattern, $options: 'i' } },
        ];
        if (kind === 'contacts') searchable.push({ email: { $regex: pattern, $options: 'i' } });
        else searchable.push(
          { type: { $regex: pattern, $options: 'i' } },
          { status: { $regex: pattern, $options: 'i' } },
        );
        filter.$or = searchable;
      }
    }
    if (kind === 'projects' && query.type) filter.type = clean(query.type, 90);
    if (query.status) filter.status = clean(query.status, 40);
    if (query.archived === 'true') filter.archived = true;
    else if (kind === 'projects' && query.archived !== 'all') filter.archived = false;
    if (query.projectId) filter.projectId = id(clean(query.projectId, 40));
    if (query.contactId) filter.contactId = id(clean(query.contactId, 40));
    const limit = Math.min(250, Math.max(10, Number(query.limit) || 100));
    const page = Math.max(1, Math.min(10000, Number(query.page) || 1));
    const order = kind === 'projects' && query.sort === 'oldest' ? 1 : -1;
    const [items, total] = await Promise.all([
      this.model.find(filter).sort({ createdAt: order }).skip((page - 1) * limit).limit(limit).lean(),
      this.model.countDocuments(filter),
    ]);
    return { items, total, page, limit };
  }

  async get(userId: string, rawKind: string, recordId: string) {
    const found = await this.model.findOne({ _id: id(recordId), userId, kind: this.kind(rawKind) }).lean();
    if (!found) throw new NotFoundException('Studio record not found');
    return found;
  }

  private async relation(userId: string, kind: StudioKind, recordId: string) {
    if (!recordId) return '';
    id(recordId);
    if (!(await this.model.exists({ userId, kind, _id: recordId })))
      throw new BadRequestException('Related ' + kind + ' record not found');
    return recordId;
  }

  private async payload(userId: string, kind: StudioKind, raw: Payload, old?: StudioRecordDocument | null) {
    const data: Record<string, unknown> = {};
    if (raw.title !== undefined) data.title = clean(raw.title, 220);
    if (raw.description !== undefined) data.description = clean(raw.description, 12000);
    if (raw.type !== undefined) data.type = clean(raw.type, 90);
    if (raw.email !== undefined) data.email = email(raw.email);
    if (raw.phone !== undefined) data.phone = clean(raw.phone, 60);
    if (raw.contactId !== undefined) data.contactId = await this.relation(userId, 'contacts', clean(raw.contactId, 50));
    if (raw.projectId !== undefined) data.projectId = await this.relation(userId, 'projects', clean(raw.projectId, 50));
    if (raw.date !== undefined)
      data.date = raw.date === null || raw.date === '' ? null : date(raw.date);
    if (raw.dueDate !== undefined)
      data.dueDate = raw.dueDate === null || raw.dueDate === '' ? null : date(raw.dueDate);
    if (raw.currency !== undefined) {
      const code = clean(raw.currency, 3).toUpperCase();
      if (!/^[A-Z]{3}$/.test(code)) throw new BadRequestException('Invalid currency');
      data.currency = code;
    }
    if (raw.archived !== undefined) data.archived = raw.archived === true;
    if (raw.status !== undefined) {
      const status = clean(raw.status, 40).toLowerCase();
      if (kind === 'projects' && !/^[a-z][a-z0-9-]{0,39}$/.test(status))
        throw new BadRequestException('Invalid project stage');
      if (kind !== 'projects' && validStatuses[kind] && !validStatuses[kind]!.includes(status))
        throw new BadRequestException('Invalid status');
      if (kind === 'invoices' && status === 'paid' && old?.status !== 'paid')
        throw new BadRequestException('Use Record Payment to mark an invoice paid');
      if (kind === 'documents' && status === 'completed' && old?.status !== 'completed')
        throw new BadRequestException('A contract must be signed by its recipient');
      data.status = status;
    }
    if (raw.details !== undefined) {
      data.details = details(raw.details,
        kind === 'documents' || kind === 'templates' ? 80000 : 40000);
      if (kind === 'projects' && (data.details as Payload).additionalClientIds !== undefined) {
        const ids = (data.details as Payload).additionalClientIds;
        if (!Array.isArray(ids) || ids.length > 20) throw new BadRequestException('Invalid additional clients');
        for (const contactId of ids) {
          if (typeof contactId !== 'string')
            throw new BadRequestException('Invalid additional client');
          await this.relation(userId, 'contacts', contactId);
        }
      }
      if (kind === 'projects' &&
          Object.keys(data.details as Payload).some(key => !['location', 'additionalClientIds'].includes(key)))
        throw new BadRequestException('Use project workflows to manage notes and linked galleries');
    }
    if (raw.amount !== undefined) data.amount = amount(raw.amount);
    if (kind === 'invoices') {
      const values = (data.details as Record<string, unknown>) ?? old?.details ?? {};
      const result = pricing(values);
      data.details = { ...values, ...result };
      data.amount = result.total;
    }
    if (kind === 'payment-links' && data.details) {
      const existing = old?.details || {};
      const rawDetails = { ...existing, ...(data.details as Payload) };
      const normalized = normalizePaymentLinkSettings(rawDetails);
      data.details = { ...rawDetails, ...normalized };
      if (normalized.fixedAmount && Number(data.amount ?? old?.amount ?? 0) <= 0)
        throw new BadRequestException('Choose a fixed amount greater than zero');
    }
    if (kind === 'forms' && data.details) {
      const fields = (data.details as Payload).fields;
      if (fields !== undefined) {
        if (!Array.isArray(fields) || fields.length > 30)
          throw new BadRequestException('Forms support up to 30 fields');
        const names = new Set<string>();
        for (const item of fields) {
          const field = item && typeof item === 'object' ? item as Payload : {};
          const name = clean(field.name, 70);
          if (!/^[a-zA-Z0-9_-]{1,70}$/.test(name) || !clean(field.label, 140) || names.has(name))
            throw new BadRequestException('Form questions require unique keys and labels');
          names.add(name);
        }
      }
    }
    if ((kind === 'documents' || kind === 'templates') && data.details) {
      const body = data.details as Payload;
      const documentType = String(data.type||old?.type||'');
      if(documentType==='contract'&&kind==='templates'&&body.defaultStudioSignature!==undefined){
        body.defaultStudioSignature=body.defaultStudioSignature===null?null:validateStudioSignature(body.defaultStudioSignature);
      }
      if(documentType==='contract'&&kind==='documents'&&body.studioSignatureDraft!==undefined){
        body.studioSignatureDraft=body.studioSignatureDraft===null?null:validateStudioSignature(body.studioSignatureDraft);
      }
      if(documentType==='contract'&&kind==='documents'&&body.studioSignature!==undefined){
        if(body.studioSignature===null){
          body.studioSignature=null;
          body.studioSignerName='';
          body.studioSignedAt='';
        }else{
          body.studioSignature=validateStudioSignature(body.studioSignature);
          const studioSigner=clean(body.studioSignerName||body.photographerName,180);
          if(!studioSigner)throw new BadRequestException('Studio signer name is required');
          body.studioSignerName=studioSigner;
          body.studioSignedAt=old?.details?.studioSignature&&
            JSON.stringify(old.details.studioSignature)===JSON.stringify(body.studioSignature)?
            old.details.studioSignedAt:new Date().toISOString();
        }
      }
      if(kind==='documents'&&documentType==='contract'&&old?.details?.studioSignature){
        if(body.studioSignature===undefined)
          throw new BadRequestException('Remove the studio signature before replacing a signed draft');
        if(body.studioSignature!==null){
          if(JSON.stringify(old.details.studioSignature)!==JSON.stringify(body.studioSignature)||
            JSON.stringify(old.details.contentDoc)!==JSON.stringify(body.contentDoc)||
            JSON.stringify(old.details.variables)!==JSON.stringify(body.variables)||
            body.studioSignerName!==old.details.studioSignerName||
            (data.title!==undefined&&data.title!==old.title)||
            (data.description!==undefined&&data.description!==old.description)||
            (data.contactId!==undefined&&data.contactId!==old.contactId)||
            (data.projectId!==undefined&&data.projectId!==old.projectId)||
            (data.email!==undefined&&data.email!==old.email))
            throw new BadRequestException('Remove the studio signature before editing signed terms');
        }
      }
      if (documentType === 'questionnaire' && body.fields !== undefined)
        body.fields = validateQuestionnaireFields(body.fields);
      if (documentType === 'quote' && body.quoteItems !== undefined) {
        const items=validateQuoteItems(body.quoteItems);
        const discount=amount(body.discountPercent??0);
        const tax=amount(body.taxPercent??0);
        if(discount>100||tax>100)throw new BadRequestException('Quote discount/tax must be at most 100%');
        body.quoteItems=items;
        body.discountPercent=discount;
        body.taxPercent=tax;
        body.autoCreateInvoice=body.autoCreateInvoice===true;
        data.amount=quotePrice(items,{},discount,tax,true).total;
      }
      if (body.contentDoc !== undefined) body.contentDoc = contractDocument(body.contentDoc);
      if (body.variables !== undefined) body.variables = contractVariables(body.variables);
      if (body.photographerName !== undefined) body.photographerName = clean(body.photographerName, 180);
      if (body.photographerEmail !== undefined) body.photographerEmail = email(body.photographerEmail);
      if (body.clientSignerName !== undefined) body.clientSignerName = clean(body.clientSignerName, 180);
      if (body.clientSignerEmail !== undefined) body.clientSignerEmail = email(body.clientSignerEmail);
      if (body.content !== undefined) body.content = clean(body.content, 25000);
      if (body.accentColor !== undefined)
        body.accentColor = /^#[0-9a-f]{6}$/i.test(String(body.accentColor)) ? body.accentColor : '#6337d8';
    }
    if (kind === 'contacts' && raw.status === undefined && !old)
      data.status = clean(raw.type, 30).toLowerCase() || 'client';
    if (kind === 'settings') {
      const entry = data.details as Payload | undefined;
      if (entry && (entry.projectStageColors !== undefined || entry.projectStageLabels !== undefined)) {
        const stageColors = entry.projectStageColors;
        const stageLabels = entry.projectStageLabels;
        for (const set of [stageColors, stageLabels]) {
          if (set !== undefined && (typeof set !== 'object' || set === null || Array.isArray(set) || Object.keys(set).length > 40))
            throw new BadRequestException('Invalid project stage settings');
        }
        if (stageColors) for (const [key,value] of Object.entries(stageColors as Payload)) {
          if (!/^[a-z][a-z0-9-]{0,39}$/.test(key) || !/^#[0-9a-f]{6}$/i.test(String(value)))
            throw new BadRequestException('Invalid stage colour');
        }
        if (stageLabels) for (const [key,value] of Object.entries(stageLabels as Payload)) {
          if (!/^[a-z][a-z0-9-]{0,39}$/.test(key) || !clean(value,70) || typeof value !== 'string')
            throw new BadRequestException('Invalid stage title');
        }
      }
      data.title = 'Studio settings';
      data.status = 'active';
    }
    return data;
  }

  async create(userId: string, rawKind: string, body: Payload) {
    const kind = this.kind(rawKind);
    if (kind === 'messages' || kind === 'transactions') throw new BadRequestException('Use the relevant workflow');
    if (kind === 'settings') {
      const prior = await this.model.findOne({ userId, kind }).select('_id').lean();
      if (prior) return this.update(userId, kind, String(prior._id), body);
    }
    const data = await this.payload(userId, kind, body);
    if (kind !== 'settings' && !data.title) throw new BadRequestException('Name is required');
    if (kind === 'projects' && !data.contactId)
      throw new BadRequestException('Choose a client from Contacts before creating a project');
    if (kind === 'contacts' && !data.email)
      throw new BadRequestException('Contact email is required');
    if (kind === 'invoices' && !data.contactId && !data.email)
      throw new BadRequestException('Choose a client or enter an email address');
    if (kind === 'forms' && data.status === 'published')
      throw new BadRequestException('Create a draft before publishing');
    const record = await this.model.create({
      userId, kind, status: defaults[kind] || 'active', ...data,
      ...(tokenKinds.includes(kind) ? { token: randomBytes(32).toString('hex') } : {}),
      ...(kind === 'invoices' ? { details: { ...(data.details as Payload || {}),
        number: 'INV-' + Date.now().toString(36).toUpperCase() + '-' + randomBytes(2).toString('hex').toUpperCase() } } : {}),
    });
    return record.toObject();
  }

  async update(userId: string, rawKind: string, recordId: string, body: Payload) {
    const kind = this.kind(rawKind);
    if (kind === 'transactions') throw new BadRequestException('Transactions cannot be modified');
    const old = await this.model.findOne({ _id: id(recordId), userId, kind });
    if (!old) throw new NotFoundException('Studio record not found');
    if (kind === 'invoices' && ['paid', 'cancelled'].includes(old.status))
      throw new BadRequestException('Paid and cancelled invoices are read-only');
    if (kind === 'documents' && ['completed', 'cancelled'].includes(old.status))
      throw new BadRequestException('Completed and cancelled documents are read-only');
    if (kind === 'documents' && old.type === 'contract' && old.status === 'in-progress' &&
      (body.title !== undefined || body.description !== undefined || body.details !== undefined ||
       body.contactId !== undefined || body.projectId !== undefined || body.email !== undefined))
      throw new BadRequestException('A sent contract cannot be edited. Create a new draft instead.');
    if (kind === 'documents' && ['quote','questionnaire'].includes(old.type) &&
        old.status === 'in-progress' &&
        (body.title !== undefined || body.description !== undefined || body.details !== undefined ||
         body.contactId !== undefined || body.projectId !== undefined || body.amount !== undefined ||
         body.email !== undefined || body.currency !== undefined || body.dueDate !== undefined))
      throw new BadRequestException('A sent document cannot be changed. Duplicate it to edit another version.');
    if (kind === 'documents' && old.status === 'in-progress' &&
        ['contract','quote','questionnaire'].includes(old.type) &&
        body.status !== undefined && !['in-progress','cancelled'].includes(String(body.status)))
      throw new BadRequestException('A sent document can only remain sent or be cancelled');
    if (kind === 'messages' &&
        (old.status === 'sent' || Object.keys(body).length !== 1 || !['read', 'unread', 'archived'].includes(String(body.status))))
      throw new BadRequestException('Inbox messages only allow read, unread or archive status updates');
    const data = await this.payload(userId, kind, body, old);
    if (kind === 'projects' && data.details) {
      // Use targeted nested writes so editing the project cannot erase a note or gallery
      // that was linked concurrently in another Studio Manager screen.
      const projectDetails = data.details as Payload;
      delete data.details;
      if (projectDetails.location !== undefined)
        data['details.location'] = clean(projectDetails.location, 240);
      if (projectDetails.additionalClientIds !== undefined)
        data['details.additionalClientIds'] = projectDetails.additionalClientIds;
    }
    if (kind === 'invoices') {
      if (old.status === 'paid' && body.status !== undefined && body.status !== 'paid')
        throw new BadRequestException('Paid invoices cannot be reopened');
      if (old.status === 'paid' && (body.details !== undefined || body.amount !== undefined))
        throw new BadRequestException('Paid invoice amounts cannot be modified');
      data.details = { ...(data.details as Payload || {}), number: old.details?.number };
    }
    if (kind === 'documents' && old.status === 'completed' && body.status !== undefined && body.status !== 'completed')
      throw new BadRequestException('Completed documents cannot be reopened');
    if (kind === 'documents' && old.status === 'completed' &&
        (body.description !== undefined || body.details !== undefined))
      throw new BadRequestException('Signed contracts cannot be edited');
    const next = await this.model.findOneAndUpdate(
      { _id: old._id, userId, kind }, { $set: data }, { returnDocument: 'after', runValidators: true },
    ).lean();
    return next;
  }

  async remove(userId: string, rawKind: string, recordId: string) {
    const kind = this.kind(rawKind);
    const old = await this.model.findOne({ _id: id(recordId), userId, kind });
    if (!old) throw new NotFoundException('Studio record not found');
    if (kind === 'transactions' || (kind === 'invoices' && old.status === 'paid') ||
        (kind === 'documents' && ['in-progress','completed'].includes(old.status)))
      throw new BadRequestException('Completed financial or signed records must be retained');
    await this.model.deleteOne({ _id: old._id, userId, kind });
    return { deleted: true, id: recordId };
  }

  async overview(userId: string) {
    const [counts, recentProjects, recentInvoices, recentMessages] = await Promise.all([
      this.model.aggregate([{ $match: { userId } },
        { $group: { _id: '$kind', count: { $sum: 1 }, amount: {
          $sum: { $cond: [{ $and: [{ $eq: ['$kind', 'invoices'] }, { $eq: ['$status', 'paid'] }] }, '$amount', 0] },
        } } }]),
      this.model.find({ userId, kind: 'projects', archived: false }).sort({ updatedAt: -1 }).limit(5).lean(),
      this.model.find({ userId, kind: 'invoices' }).sort({ createdAt: -1 }).limit(5).lean(),
      this.model.find({ userId, kind: 'messages', status: 'unread' }).sort({ createdAt: -1 }).limit(5).lean(),
    ]);
    return { counts: Object.fromEntries(counts.map((x) => [x._id, x.count])),
      revenue: counts.find((x) => x._id === 'invoices')?.amount || 0,
      recentProjects, recentInvoices, recentMessages };
  }

  async projectPayments(userId: string) {
    const rows = await this.model.aggregate([
      { $match: { userId, projectId: { $nin: ['', null] }, $or: [
        { kind: 'invoices', status: 'paid' },
        { kind: 'transactions', status: 'paid', 'details.paymentLinkId': { $exists: true } },
      ] } },
      { $group: { _id: { projectId: '$projectId', currency: '$currency' }, amount: { $sum: '$amount' } } },
    ]);
    return rows.map((row) => ({
      projectId: String(row._id.projectId), currency: String(row._id.currency || 'EUR'), amount: row.amount,
    }));
  }

  async financialReport(userId: string) {
    const now = new Date();
    const [totals, months, recentTransactions] = await Promise.all([
      this.model.aggregate([
        { $match: { userId, kind: 'invoices' } },
        { $group: {
          _id: { currency: '$currency', status: '$status' },
          amount: { $sum: '$amount' }, count: { $sum: 1 },
          overdue: { $sum: { $cond: [
            { $and: [
              { $not: [{ $in: ['$status', ['paid', 'cancelled']] }] },
              { $lt: ['$dueDate', now] }, { $ne: ['$dueDate', null] },
            ] }, '$amount', 0,
          ] } },
        } },
      ]),
      this.model.aggregate([
        { $match: { userId, kind: 'invoices', status: 'paid' } },
        { $group: {
          _id: {
            currency: '$currency',
            month: { $dateToString: { format: '%Y-%m',
              date: { $ifNull: ['$updatedAt', '$createdAt'] }, timezone: 'UTC' } },
          },
          amount: { $sum: '$amount' },
        } },
        { $sort: { '_id.month': -1 } },
      ]),
      this.model.find({ userId, kind: 'transactions' }).sort({ createdAt: -1 }).limit(20).lean(),
    ]);
    const currencyMap = new Map<string, {
      currency: string; paid: number; unpaid: number; overdue: number; paidCount: number;
      invoiceCount: number; monthly: Array<{ month: string; amount: number }>;
    }>();
    for (const row of totals) {
      const currency = String(row._id.currency || 'EUR');
      if (!currencyMap.has(currency)) currencyMap.set(currency, {
        currency, paid: 0, unpaid: 0, overdue: 0, paidCount: 0,
        invoiceCount: 0, monthly: [],
      });
      const item = currencyMap.get(currency)!;
      const status = String(row._id.status || '');
      if (status === 'paid') { item.paid += Number(row.amount); item.paidCount += Number(row.count); }
      if (status !== 'paid' && status !== 'cancelled') item.unpaid += Number(row.amount);
      item.overdue += Number(row.overdue || 0);
      item.invoiceCount += Number(row.count);
    }
    for (const row of months) {
      const currency = String(row._id.currency || 'EUR');
      if (!currencyMap.has(currency)) currencyMap.set(currency, {
        currency, paid: 0, unpaid: 0, overdue: 0, paidCount: 0,
        invoiceCount: 0, monthly: [],
      });
      currencyMap.get(currency)!.monthly.push({ month: String(row._id.month), amount: Number(row.amount) });
    }
    return { currencies: [...currencyMap.values()].sort((a, b) => a.currency.localeCompare(b.currency)),
      recentTransactions };
  }

  async useTemplate(userId: string, recordId: string, payload: Payload = {}) {
    const template = await this.model.findOne({ _id: id(recordId), userId, kind: 'templates' }).lean();
    if (!template) throw new NotFoundException('Template not found');
    if (!['contract', 'questionnaire', 'quote', 'invoice'].includes(template.type))
      throw new BadRequestException('Email templates are applied when composing an email');
    const contactId = clean(payload.contactId, 50);
    const projectId = clean(payload.projectId, 50);
    const clientEmail = email(payload.email);
    if (template.type === 'invoice') {
      if (!contactId && !clientEmail) throw new BadRequestException('Select a client for this invoice');
      const original = template.details || {};
      return this.create(userId, 'invoices', {
        title: template.title, type: 'invoice', email: clientEmail,
        contactId, projectId, currency: clean(payload.currency, 3) || template.currency || 'EUR',
        description: template.description,
        details: { lines: original.lines || [], notes: original.notes || '',
          discountPercent: original.discountPercent || 0, taxPercent: original.taxPercent || 0 },
      });
    }
    return this.create(userId, 'documents', {
      title: template.title, description: template.description,
      type: template.type, contactId, projectId, email: clientEmail,
      currency: clean(payload.currency, 3) || template.currency || 'EUR',
      amount: Number(template.amount || 0),
      details: { content: clean(template.details?.content, 20000), notes: clean(template.details?.notes, 5000),
        fields: template.details?.fields || [],
        ...(template.type === 'contract' && template.details?.contentDoc
          ? { contentDoc: contractDocument(template.details.contentDoc),
            variables: contractVariables(template.details.variables),
            photographerName: clean(template.details.photographerName, 180),
            photographerEmail: email(template.details.photographerEmail),
            clientSignerName: clean(template.details.clientSignerName, 180),
            clientSignerEmail: email(template.details.clientSignerEmail),
            accentColor: template.details.accentColor || '#6337d8' }
          : {}),
        sourceTemplateId: String(template._id) },
    });
  }

  private async sendStudioEmail(userId: string, payload: { to: string; subject: string; text: string; html?: string }, meta: { sourceKind: string; sourceId?: string; sourceTitle?: string; contactId?: string; projectId?: string }) {
    const recipient = email(payload.to);
    const attemptedAt = new Date().toISOString();
    const log = await this.model.create({
      userId, kind: 'messages', title: payload.subject, status: 'sending', type: 'outbound',
      email: recipient, contactId: meta.contactId || '', projectId: meta.projectId || '',
      description: payload.text || payload.subject,
      details: { channel: 'smtp', sourceKind: meta.sourceKind, sourceId: meta.sourceId || '',
        sourceTitle: meta.sourceTitle || '', attemptedAt, smtpStatus: 'sending' },
    });
    let outcome: Awaited<ReturnType<MailService['send']>>;
    try {
      outcome = await this.mail.send({ ...payload, to: recipient });
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'SMTP_SEND_FAILED';
      log.status = 'failed';
      log.details = { ...log.details, smtpStatus: 'failed', error: reason, failedAt: new Date().toISOString() };
      await log.save().catch(() => undefined);
      throw new ServiceUnavailableException('SMTP could not send this email: ' + reason);
    }
    if (!outcome.sent) {
      const reason = outcome.reason || 'SMTP_SEND_FAILED';
      log.status = 'failed';
      log.details = { ...log.details, smtpStatus: 'failed', error: reason, failedAt: new Date().toISOString() };
      await log.save().catch(() => undefined);
      throw new ServiceUnavailableException(reason === 'SMTP_NOT_CONFIGURED'
        ? 'Email was not sent: SMTP is not configured on the backend.'
        : 'Email was not sent: the SMTP server rejected the message. Check the backend mail log.');
    }
    const sentAt = new Date().toISOString();
    log.status = 'sent';
    log.details = { ...log.details, smtpStatus: 'accepted', acceptedBySmtp: true,
      messageId: outcome.messageId || '', sentAt };
    await log.save().catch(() => undefined);
    return { ...outcome, log: log.toObject() };
  }

  async sendEmail(userId: string, body: Payload) {
    const contactId = await this.relation(userId, 'contacts', clean(body.contactId, 50));
    const projectId = await this.relation(userId, 'projects', clean(body.projectId, 50));
    const contact = contactId
      ? await this.model.findOne({ _id: contactId, userId, kind: 'contacts' }).select('email title').lean()
      : null;
    const recipient = email(body.email || contact?.email);
    const subject = clean(body.subject, 180);
    const content = clean(body.content, 12000);
    if (!recipient || !subject || !content)
      throw new BadRequestException('Recipient, subject, and message are required');
    const outcome = await this.sendStudioEmail(userId, { to: recipient, subject, text: content },
      { sourceKind: 'manual-message', sourceTitle: subject, contactId, projectId });
    return outcome.log;
  }

  private frontendUrl(path: string) {
    const origin = this.config.get<string>('FRONTEND_URL') ||
      (this.config.get<string>('NODE_ENV') === 'production' ? 'https://gallerista.app' : 'http://localhost:3000');
    const url = new URL(path, origin.replace(/\/+$/, '') + '/');
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
      throw new ServiceUnavailableException('Frontend URL is misconfigured');
    return url.toString();
  }

  /** Only enabled owner websites can host recipient links. */
  private async studioDocumentUrl(userId:string,route:string,token:string){
    if(!this.studioSites)
      return this.frontendUrl('/studio/'+route+'/'+token); // Unit-test fallback.
    const {sites,rootDomain}=await this.studioSites.ownerSites(userId);
    const selected=sites[0];
    if(!selected?.slug)
      throw new BadRequestException('Enable your website subdomain in Website Settings before sharing or sending a studio document');
    if(!/^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/.test(selected.slug)||
       !/^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i.test(rootDomain)){
      if(rootDomain==='localhost'&&this.config.get<string>('NODE_ENV')!=='production')
        return this.frontendUrl('/studio/site/'+encodeURIComponent(selected.slug)+'/'+
          route+'/'+encodeURIComponent(token));
      throw new ServiceUnavailableException('Website domain is not configured for public Studio Manager links');
    }
    return new URL('/studio/'+route+'/'+encodeURIComponent(token),
      'https://'+selected.slug+'.'+rootDomain).toString();
  }

  async shareUrl(userId:string,rawKind:string,recordId:string){
    const kind=this.kind(rawKind);
    if(!['invoices','documents','forms'].includes(kind))
      throw new BadRequestException('This record does not have a public document link');
    const record=await this.model.findOne({_id:id(recordId),userId,kind}).lean();
    if(!record?.token||['cancelled','archived'].includes(record.status))
      throw new NotFoundException('Shareable document not found');
    const route=kind==='invoices'?'invoice':kind==='forms'?'form':record.type;
    if(!['form','invoice','contract','questionnaire','quote'].includes(route))
      throw new BadRequestException('Unsupported document type');
    return {url:await this.studioDocumentUrl(userId,route,record.token),
      preview:record.status==='draft',status:record.status};
  }

  /** Public draft previews are read-only and bound to an enabled owner's site. */
  async publicSiteDocument(userId:string,kind:string,token:string){
    if(!/^[a-f0-9]{64}$/i.test(token))
      throw new NotFoundException('Document link not found');
    const category=kind==='invoice'?'invoices':kind==='form'?'forms':'documents';
    if(!['invoice','form','contract','questionnaire','quote'].includes(kind))
      throw new NotFoundException('Document link not found');
    const record=await this.model.findOne({userId,kind:category,token}).lean();
    if(!record||['cancelled','archived'].includes(record.status)||
       (category==='documents'&&record.type!==kind))
      throw new NotFoundException('Document link not found');
    const preview=record.status==='draft';
    const data=kind==='form'?await this.publicForm(token,preview):
      kind==='invoice'?await this.publicInvoice(token,preview):
      kind==='contract'?await this.publicContract(token,preview):
      await this.publicOtherDocument(token,kind as 'questionnaire'|'quote',preview);
    return {preview,data};
  }

  private async sendRecord(userId: string, kind: 'invoices' | 'documents', recordId: string) {
    const record = await this.model.findOne({ _id: id(recordId), userId, kind });
    if (!record) throw new NotFoundException('Record not found');
    if (['cancelled', 'completed', 'paid'].includes(record.status)) throw new BadRequestException('Record is closed');
    const related = record.contactId ? await this.model.findOne({
      _id: record.contactId, userId, kind: 'contacts',
    }).select('email').lean() : null;
    const to = record.email || related?.email || '';
    if (!to) throw new BadRequestException('Client email is required');
    if (!record.token) throw new NotFoundException('Public link unavailable');
    if (kind === 'documents' && !['contract', 'questionnaire', 'quote'].includes(record.type))
      throw new BadRequestException('This document type cannot be sent for signing or completion');
    const route = kind === 'invoices' ? 'invoice' : record.type;
    const url = await this.studioDocumentUrl(userId,route,record.token);
    const message = (kind === 'invoices' ? 'Invoice' : 'Document to review') + ': ' + record.title;
    const studioName=this.studioSites?
      (await this.studioSites.ownerSites(userId)).sites[0]?.name||'Your Studio':'Gallerista Studio';
    const buttonText=kind==='invoices'?'View Invoice & Pay Now':
      record.type==='contract'?'Review & Sign Contract':
      record.type==='quote'?'Review & Accept Quote':'Complete Questionnaire';
    const safeUrl=escapeMailHtml(url);
    const safeMessage=escapeMailHtml(message);
    const html='<div style="max-width:600px;margin:24px auto;padding:32px;font-family:Arial,sans-serif;color:#292530;">'+
      '<p style="color:#777;font-size:13px;">'+escapeMailHtml(studioName)+'</p>'+
      '<h1 style="font-size:23px;line-height:1.3;">'+safeMessage+'</h1>'+
      '<p style="font-size:15px;line-height:1.8;">Hello, your studio has shared a document for you to review.'+
      (kind==='invoices'?' Open the secure invoice and choose Stripe or PayPal if your studio has connected that payment method.':'')+'</p>'+
      '<p style="margin:30px 0;"><a href="'+safeUrl+'" style="display:inline-block;padding:16px 25px;background:#6337d8;color:#fff;'+
      'text-decoration:none;font-weight:bold;font-size:14px;">'+escapeMailHtml(buttonText)+'</a></p>'+
      '<p style="font-size:12px;color:#888;">Or copy this link: <a href="'+safeUrl+'">'+safeUrl+'</a></p>'+
      '<p style="font-size:12px;color:#999;margin-top:35px;">Please contact your studio directly if you did not expect this email.</p></div>';
    const accepted = await this.sendStudioEmail(userId, {
      to, subject: message, html,
      text: 'Hello,\n\n' + message + '\n\n'+buttonText+':\n' + url + '\n\nThank you.',
    }, { sourceKind: kind === 'invoices' ? 'invoice' : record.type, sourceId: recordId,
      sourceTitle: record.title, contactId: record.contactId, projectId: record.projectId });
    record.status = kind === 'invoices' ? 'sent' : 'in-progress';
    await record.save();
    return { record: record.toObject(), url, emailSent: true, messageId: accepted.messageId || '', emailLog: accepted.log };
  }

  sendInvoice(userId: string, recordId: string) { return this.sendRecord(userId, 'invoices', recordId); }
  sendContract(userId: string, recordId: string) { return this.sendRecord(userId, 'documents', recordId); }

  async recordPayment(userId: string, recordId: string, body: Payload) {
    const invoice = await this.model.findOne({ _id: id(recordId), userId, kind: 'invoices' });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (['paid', 'cancelled'].includes(invoice.status)) throw new BadRequestException('Invoice is already closed');
    if (invoice.amount <= 0) throw new BadRequestException('Invoice amount must be greater than zero');
    const method = clean(body.method, 40) || 'manual';
    const note = clean(body.note, 600);
    const paidAt = new Date().toISOString();
    const paymentDetails = { ...invoice.details, paidAt, paymentMethod: method, paymentNote: note };
    const markedPaid = await this.model.findOneAndUpdate(
      { _id: invoice._id, userId, kind: 'invoices', status: { $nin: ['paid', 'cancelled'] } },
      { $set: { status: 'paid', details: paymentDetails } },
      { returnDocument: 'after' },
    ).lean();
    if (!markedPaid) throw new BadRequestException('Invoice was already paid or closed');
    try {
      const transaction = await this.model.create({
        userId, kind: 'transactions', title: 'Payment for ' + invoice.title,
        status: 'paid', type: 'manual', currency: invoice.currency, amount: invoice.amount,
        contactId: invoice.contactId, projectId: invoice.projectId,
        details: { invoiceId: String(invoice._id), method, note, recordedAt: paidAt },
      });
      return { invoice: markedPaid, transaction: transaction.toObject() };
    } catch (error) {
      // Revert only if nobody changed this precise payment record afterwards.
      await this.model.updateOne(
        { _id: invoice._id, userId, kind: 'invoices', status: 'paid', 'details.paidAt': paidAt },
        { $set: { status: invoice.status, details: invoice.details } },
      ).catch(() => undefined);
      throw error;
    }
  }

  private async publicRecord(kind: 'forms' | 'invoices' | 'documents' | 'payment-links', token: string) {
    if (!/^[a-f0-9]{64}$/i.test(token)) throw new NotFoundException('Link not found');
    const record = await this.model.findOne({ kind, token }).lean();
    if (!record || ['cancelled', 'archived'].includes(record.status)) throw new NotFoundException('Link not found');
    return record;
  }

  async publicForm(token: string,allowDraft=false) {
    const form = await this.publicRecord('forms', token);
    if (form.status !== 'published'&&!(allowDraft&&form.status==='draft'))
      throw new NotFoundException('Form is not published');
    return { title: form.title, description: form.description,
      fields: Array.isArray(form.details?.fields) ? form.details.fields.slice(0, 30) : [],
      buttonLabel: clean(form.details?.buttonLabel, 70) || 'Submit',
      successMessage: clean(form.details?.successMessage, 300) || 'Thank you! Your message has been sent.',
      showMessage: form.details?.showMessage !== false,
      accentColor: /^#[a-f0-9]{6}$/i.test(String(form.details?.accentColor || ''))
        ? form.details?.accentColor : '#6337d8',
      backgroundColor: /^#[a-f0-9]{6}$/i.test(String(form.details?.backgroundColor || ''))
        ? form.details?.backgroundColor : '#ffffff',
    };
  }

  async submitForm(token: string, payload: Payload) {
    const form = await this.publicRecord('forms', token);
    if (form.status !== 'published') throw new NotFoundException('Form is not published');
    if (payload.website) return { submitted: true };
    const senderEmail = email(payload.email);
    const senderName = clean(payload.name, 150);
    if (!senderEmail || !senderName) throw new BadRequestException('Name and email are required');
    const responses = details(payload.responses);
    const fields = Array.isArray(form.details?.fields) ? form.details.fields : [];
    const allowed = new Set(fields.map((f) => clean((f as Payload)?.name, 80)));
    for (const key of Object.keys(responses)) {
      if (!allowed.has(key)) throw new BadRequestException('Unknown form question');
      responses[key] = clean(responses[key], 2000);
    }
    for (const field of fields) {
      const key = clean((field as Payload)?.name, 80);
      if ((field as Payload)?.required && !clean(responses[key]))
        throw new BadRequestException('Answer required: ' + clean((field as Payload)?.label, 120));
    }
    let contact = await this.model.findOne({ userId: form.userId, kind: 'contacts', email: senderEmail });
    if (!contact) contact = await this.model.create({
      userId: form.userId, kind: 'contacts', title: senderName, status: clean(form.details?.contactType, 15) || 'lead',
      email: senderEmail, type: 'form', details: { sourceFormId: String(form._id) },
    });
    await this.model.create({
      userId: form.userId, kind: 'messages', title: 'Form: ' + form.title, status: 'unread',
      email: senderEmail, contactId: String(contact._id),
      description: clean(payload.message, 8000),
      details: { name: senderName, formId: String(form._id), responses },
    });
    return { submitted: true };
  }

  async publicInvoice(token: string,allowDraft=false) {
    const record = await this.publicRecord('invoices', token);
    if(record.status==='draft'&&!allowDraft)throw new NotFoundException('Invoice is not yet sent');
    const client = record.contactId
      ? await this.model.findOne({ userId: record.userId, kind: 'contacts', _id: record.contactId }).select('title email').lean()
      : null;
    return { title: record.title, status: record.status, number: record.details?.number || '',
      clientName: client?.title || '', clientEmail: record.email || client?.email || '', amount: record.amount, currency: record.currency,
      dueDate: record.dueDate, description: record.description,
      lines: record.details?.lines || [], subtotal: record.details?.subtotal || 0,
      discount: record.details?.discount || 0, tax: record.details?.tax || 0, notes: record.details?.notes || '',
      businessName: clean(record.details?.businessName, 180) || 'Gallerista Studio',
      brandColor: /^#[a-f0-9]{6}$/i.test(String(record.details?.brandColor || ''))
        ? record.details?.brandColor : '#6337d8',
      footerText: clean(record.details?.footerText, 500) };
  }

  async publicPaymentLink(token: string) {
    const record = await this.publicRecord('payment-links', token);
    if (record.status !== 'active') throw new NotFoundException('This payment request is not active');
    if (record.dueDate && new Date(record.dueDate).getTime() < Date.now())
      throw new GoneException('This payment request has expired');
    return {
      title: record.title, amount: record.amount, currency: record.currency,
      description: record.description, instructions: record.details?.notes || '',
      expiresAt: record.dueDate,
      onlinePaymentEnabled: false,
    };
  }

  async publicContract(token: string,allowDraft=false) {
    const record = await this.publicRecord('documents', token);
    if (record.type !== 'contract') throw new NotFoundException('Contract not found');
    if (!['in-progress', 'completed',...(allowDraft?['draft']:[])].includes(record.status))
      throw new NotFoundException('Contract is not available to clients yet');
    return { title: record.title, description: record.description, status: record.status,
      content: clean(record.details?.content, 20000),
      contentDoc: record.details?.contentDoc ? contractDocument(record.details.contentDoc) : null,
      variables: contractVariables(record.details?.variables),
      photographerName: clean(record.details?.photographerName, 180),
      accentColor: /^#[a-f0-9]{6}$/i.test(String(record.details?.accentColor || ''))
        ? record.details.accentColor : '#6337d8',
      signedAt: record.details?.signedAt || '',
      signerName: record.details?.signerName || '',
      clientSignature:record.status==='completed'&&record.details?.clientSignature?
        validateStudioSignature(record.details.clientSignature):null,
      studioSignature:record.details?.studioSignature?
        validateStudioSignature(record.details.studioSignature):null,
      studioSignatureDraft:allowDraft&&record.details?.studioSignatureDraft?
        validateStudioSignature(record.details.studioSignatureDraft):null,
      studioSignerName:clean(record.details?.studioSignerName,180),
      studioSignedAt:record.details?.studioSignedAt||'' };
  }

  async publicOtherDocument(token: string, type: 'questionnaire' | 'quote',allowDraft=false) {
    const record = await this.publicRecord('documents', token);
    if (record.type !== type) throw new NotFoundException('Document link not found');
    if (!['in-progress', 'completed',...(allowDraft?['draft']:[])].includes(record.status))
      throw new NotFoundException('Document is not available to clients yet');
    if(record.status==='in-progress'&&record.dueDate&&new Date(record.dueDate).getTime()<Date.now())
      throw new GoneException('This document has expired');
    return {
      title: record.title, type, status: record.status,
      description: record.description, content: clean(record.details?.content, 20000),
      fields: Array.isArray(record.details?.fields) ? record.details.fields.slice(0, 30) : [],
      responses: record.status === 'completed' ? (record.details?.responses || {}) : {},
      signerName: record.details?.signerName || '',
      acceptedAt: record.details?.acceptedAt || '',
      submittedAt: record.details?.submittedAt || '',
      amount: record.amount, currency: record.currency,
      quoteItems: type==='quote'&&Array.isArray(record.details?.quoteItems)?record.details.quoteItems:[],
      discountPercent: type==='quote'?Number(record.details?.discountPercent||0):0,
      taxPercent: type==='quote'?Number(record.details?.taxPercent||0):0,
      notes: type==='quote'?clean(record.details?.notes,2000):'',
      acceptedSelections: type==='quote'&&record.status==='completed'?(record.details?.acceptedSelections||{}):{},
      acceptedTotal: type==='quote'&&record.status==='completed'?Number(record.details?.acceptedTotal??record.amount):null,
      accentColor:/^#[a-f0-9]{6}$/i.test(String(record.details?.accentColor||''))?
        String(record.details?.accentColor):'#19bca5',
    };
  }

  async submitQuestionnaire(token: string, body: Payload) {
    if (!/^[a-f0-9]{64}$/i.test(token)) throw new NotFoundException('Questionnaire not found');
    const record = await this.model.findOne({ kind: 'documents', token, type: 'questionnaire', status: 'in-progress' });
    if (!record) throw new GoneException('Questionnaire is no longer available');
    if(record.dueDate&&new Date(record.dueDate).getTime()<Date.now())
      throw new GoneException('This questionnaire has expired');
    const fields=validateQuestionnaireFields(record.details?.fields||[]);
    const responses=validateQuestionnaireAnswers(fields,details(body.responses));
    const submittedAt = new Date().toISOString();
    const updated = await this.model.findOneAndUpdate(
      { _id: record._id, status: 'in-progress' },
      { $set: { status: 'completed', details: { ...record.details, responses, submittedAt } } },
      { returnDocument: 'after' },
    ).lean();
    if (!updated) throw new GoneException('Questionnaire already completed');
    await this.model.create({
      userId: record.userId, kind: 'messages', title: 'Questionnaire: ' + record.title,
      status: 'unread', projectId: record.projectId, contactId: record.contactId,
      description: 'Client submitted a questionnaire',
      details: { documentId: String(record._id), responses },
    });
    return { submitted: true, submittedAt };
  }

  async acceptQuote(token: string, body: Payload) {
    if (!/^[a-f0-9]{64}$/i.test(token)) throw new NotFoundException('Quote not found');
    const signerName = clean(body.signerName, 150);
    if (!signerName || body.accept !== true)
      throw new BadRequestException('A name and acceptance are required');
    const record = await this.model.findOne({ kind: 'documents', token, type: 'quote', status: 'in-progress' });
    if (!record) throw new GoneException('Quote is no longer available');
    if(record.dueDate&&new Date(record.dueDate).getTime()<Date.now())
      throw new GoneException('This quote has expired');
    const items=record.details?.quoteItems!==undefined?
      validateQuoteItems(record.details.quoteItems):[];
    const selections=details(body.selections||{});
    const computed=items.length?
      quotePrice(items,selections,Number(record.details?.discountPercent||0),Number(record.details?.taxPercent||0)):null;
    const total=computed?.total??record.amount;
    const acceptedAt = new Date().toISOString();
    const updated = await this.model.findOneAndUpdate(
      { _id: record._id, status: 'in-progress' },
      { $set: { status: 'completed',amount:total,
        details: { ...record.details, signerName, acceptedAt, accepted: true,
          acceptedSelections:selections,acceptedTotal:total,
          ...(computed?{acceptedPricing:computed}:{}) } } },
      { returnDocument: 'after' },
    ).lean();
    if (!updated) throw new GoneException('Quote was already accepted');
    let invoiceId='';
    if(record.details?.autoCreateInvoice===true){
      const sourceQuoteId=String(record._id);
      let invoice=await this.model.findOne({
        userId:record.userId,kind:'invoices','details.sourceQuoteId':sourceQuoteId,
      }).lean();
      if(!invoice){
        const lines=computed?.lines||[{name:record.title,description:record.description||'',quantity:1,unitPrice:total}];
        try{
          invoice=await this.model.create({
            userId:record.userId,kind:'invoices',type:'invoice',status:'draft',
            title:'Invoice - '+record.title,description:record.description||'',
            contactId:record.contactId,projectId:record.projectId,email:record.email,
            amount:total,currency:record.currency,token:randomBytes(32).toString('hex'),
            details:{sourceQuoteId,lines,discountPercent:Number(record.details?.discountPercent||0),
              taxPercent:Number(record.details?.taxPercent||0),
              notes:clean(record.details?.notes,2000),
              number:'INV-Q-'+sourceQuoteId.slice(-8).toUpperCase()},
          });
        }catch(error){
          invoice=await this.model.findOne({
            userId:record.userId,kind:'invoices','details.sourceQuoteId':sourceQuoteId,
          }).lean();
          if(!invoice)throw error;
        }
      }
      invoiceId=String(invoice._id);
    }
    return { accepted: true, acceptedAt, amount:total,invoiceId };
  }

  async signContract(token: string, body: Payload) {
    const signerName = clean(body.signerName, 150);
    if (!signerName || body.accept !== true) throw new BadRequestException('Name and consent are required');
    // Accept older typed-only acknowledgements from links issued before the
    // signature pad existed; new public UI always requires a signature.
    const clientSignature=validateStudioSignature(body.signature??{kind:'typed',name:signerName});
    if (!/^[a-f0-9]{64}$/i.test(token)) throw new NotFoundException('Contract not found');
    const record = await this.model.findOne({ kind: 'documents', token, type: 'contract', status: 'in-progress' });
    if (!record) throw new GoneException('Contract is not available for signing');
    const signedAt = new Date().toISOString();
    const updated = await this.model.findOneAndUpdate(
      { _id: record._id, status: 'in-progress' },
      { $set: { status: 'completed', details: {
        ...record.details, signerName, signedAt, accepted: true, clientSignature,
      } } },
      { returnDocument: 'after' },
    ).lean();
    if (!updated) throw new GoneException('Contract has already been signed');
    return { signed: true, signedAt };
  }
}
