import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'node:crypto';
import { Model, Types } from 'mongoose';
import { BookingEvent, BookingEventDocument } from '../bookings/entities/booking-event.entity';
import { Collection, CollectionDocument } from '../collections/entities/collection.entity';
import { StudioRecord, StudioRecordDocument } from './studio-record.entity';

type PrivateNote = { id: string; text: string; createdAt: string };
function objectId(value: string): string {
  if (!Types.ObjectId.isValid(value)) throw new NotFoundException('Project not found');
  return value;
}

@Injectable()
export class StudioProjectService {
  constructor(
    @InjectModel(StudioRecord.name) private readonly records: Model<StudioRecordDocument>,
    @InjectModel(BookingEvent.name) private readonly bookings: Model<BookingEventDocument>,
    @InjectModel(Collection.name) private readonly galleries: Model<CollectionDocument>,
  ) {}

  private async project(userId: string, id: string) {
    const project = await this.records.findOne({ userId, kind: 'projects', _id: objectId(id) }).lean();
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async overview(userId: string, projectId: string) {
    const project = await this.project(userId, projectId);
    const additionalClientIds = Array.isArray(project.details?.additionalClientIds)
      ? [...new Set((project.details.additionalClientIds as unknown[])
        .map(String).filter(value => Types.ObjectId.isValid(value)))].slice(0, 20) : [];
    const collectionIds = Array.isArray(project.details?.collectionIds)
      ? [...new Set((project.details.collectionIds as unknown[])
        .map(String).filter(value => Types.ObjectId.isValid(value)))].slice(0, 50) : [];
    const now = new Date();
    const [primaryClient, additionalClients, documents, sessions, messages, galleries, availableGalleries, payments] = await Promise.all([
      project.contactId
        ? this.records.findOne({ userId, kind: 'contacts', _id: project.contactId }).lean()
        : Promise.resolve(null),
      additionalClientIds.length
        ? this.records.find({ userId, kind: 'contacts', _id: { $in: additionalClientIds } })
          .select('_id title email').lean()
        : Promise.resolve([]),
      this.records.find({ userId, kind: { $in: ['invoices', 'documents'] }, projectId })
        .sort({ createdAt: -1 }).limit(150).lean(),
      this.bookings.find({ userId, projectId }).sort({ startAt: -1 }).limit(150).lean(),
      this.records.find({ userId, kind: 'messages', projectId })
        .sort({ createdAt: -1 }).limit(100).lean(),
      collectionIds.length
        ? this.galleries.find({ userId, _id: { $in: collectionIds } })
          .select('_id name status imageCount coverImage eventDate').lean()
        : Promise.resolve([]),
      this.galleries.find({ userId }).select('_id name status imageCount coverImage eventDate')
        .sort({ createdAt: -1 }).limit(100).lean(),
      this.records.aggregate([
        { $match: { userId, projectId, $or: [
          { kind: 'invoices' },
          { kind: 'transactions', status: 'paid', 'details.paymentLinkId': { $exists: true } },
        ] } },
        { $group: {
          _id: '$currency',
          paid: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$amount', 0] } },
          upcoming: { $sum: { $cond: [{ $and: [
            { $eq: ['$status', 'sent'] },
            { $or: [{ $gte: ['$dueDate', now] }, { $eq: ['$dueDate', null] }] },
          ] }, '$amount', 0] } },
          overdue: { $sum: { $cond: [{ $and: [
            { $eq: ['$status', 'sent'] },
            { $ne: ['$dueDate', null] }, { $lt: ['$dueDate', now] },
          ] }, '$amount', 0] } },
        } },
      ]),
    ]);
    const privateNotes: PrivateNote[] = Array.isArray(project.details?.privateNotes)
      ? (project.details.privateNotes as PrivateNote[]).filter(n => n && typeof n.text === 'string').slice(-100)
      : [];
    return {
      project,
      primaryClient, additionalClients,
      documents, sessions, messages,
      galleries, availableGalleries,
      payments: payments.map(row => ({
        currency: String(row._id || 'EUR'),
        paid: Number(row.paid || 0),
        upcoming: Number(row.upcoming || 0),
        overdue: Number(row.overdue || 0),
      })),
      notes: privateNotes,
    };
  }

  async addNote(userId: string, projectId: string, text: unknown) {
    const content = String(text ?? '').trim();
    if (!content || content.length > 2000)
      throw new BadRequestException('Note must be between 1 and 2000 characters');
    const note: PrivateNote = { id: randomUUID(), text: content, createdAt: new Date().toISOString() };
    const updated = await this.records.updateOne(
      { userId, kind: 'projects', _id: objectId(projectId) },
      { $push: { 'details.privateNotes': { $each: [note], $slice: -100 } } },
    );
    if (!updated.matchedCount) throw new NotFoundException('Project not found');
    return note;
  }

  async deleteNote(userId: string, projectId: string, noteId: string) {
    if (!/^[0-9a-f-]{36}$/i.test(noteId)) throw new BadRequestException('Invalid note id');
    const updated = await this.records.updateOne(
      { userId, kind: 'projects', _id: objectId(projectId) },
      { $pull: { 'details.privateNotes': { id: noteId } } },
    );
    if (!updated.matchedCount) throw new NotFoundException('Project not found');
    return { deleted: Boolean(updated.modifiedCount) };
  }

  async linkGallery(userId: string, projectId: string, galleryId: string) {
    await this.project(userId, projectId);
    if (!Types.ObjectId.isValid(galleryId)) throw new BadRequestException('Invalid collection id');
    const gallery = await this.galleries.findOne({ userId, _id: galleryId })
      .select('_id name status imageCount coverImage eventDate').lean();
    if (!gallery) throw new NotFoundException('Gallery collection not found');
    await this.records.updateOne(
      { userId, kind: 'projects', _id: projectId },
      { $addToSet: { 'details.collectionIds': galleryId } },
    );
    return gallery;
  }

  async unlinkGallery(userId: string, projectId: string, galleryId: string) {
    const updated = await this.records.updateOne(
      { userId, kind: 'projects', _id: objectId(projectId) },
      { $pull: { 'details.collectionIds': galleryId } },
    );
    if (!updated.matchedCount) throw new NotFoundException('Project not found');
    return { unlinked: Boolean(updated.modifiedCount) };
  }
}
