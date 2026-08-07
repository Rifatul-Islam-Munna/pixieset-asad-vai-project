import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument, UserType } from 'src/user/entities/user.entity';
import { SupportMessage, SupportMessageDocument } from './entities/support-message.entity';

@Injectable()
export class SupportService {
  private readonly userCooldown = Number(process.env.SUPPORT_USER_COOLDOWN_SECONDS ?? 20);
  private readonly ttlDays = Number(process.env.SUPPORT_MESSAGE_TTL_DAYS ?? 10);

  constructor(
    @InjectModel(SupportMessage.name) private readonly messageModel: Model<SupportMessageDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async assertVip(userId: string) {
    const user = await this.userModel.findById(userId).select('name email phoneNumber role planFeatures supportBlocked').lean();
    if (!user) throw new NotFoundException('User not found');
    if (user.role !== UserType.ADMIN && !user.planFeatures?.vipSupport) {
      throw new ForbiddenException('VIP Support is not included in your plan');
    }
    return user;
  }

  async history(userId: string) {
    await this.assertVip(userId);
    return this.messageModel.find({ userId }).sort({ createdAt: 1 }).limit(500).lean();
  }

  async adminHistory(userId: string) {
    const user = await this.userModel.findById(userId).select('name email phoneNumber planName planFeatures supportBlocked').lean();
    if (!user) throw new NotFoundException('User not found');
    const messages = await this.messageModel.find({ userId }).sort({ createdAt: 1 }).limit(500).lean();
    return { user, messages };
  }

  async deleteConversation(userId: string) {
    const result = await this.messageModel.deleteMany({ userId });
    return { deleted: result.deletedCount ?? 0 };
  }

  async setBlocked(userId: string, blocked: boolean) {
    const user = await this.userModel.findByIdAndUpdate(userId, { $set: { supportBlocked: blocked } }, { new: true })
      .select('name email supportBlocked')
      .lean();
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async conversations() {
    const latest = await this.messageModel.aggregate([
      { $sort: { createdAt: -1 } },
      { $group: { _id: '$userId', lastMessage: { $first: '$message' }, lastAt: { $first: '$createdAt' } } },
      { $sort: { lastAt: -1 } },
      { $limit: 200 },
    ]);
    const ids = latest.map((item) => item._id);
    const users = await this.userModel.find({ _id: { $in: ids } }).select('name email phoneNumber planName supportBlocked').lean();
    const userMap = new Map(users.map((user: any) => [user._id.toString(), user]));
    return latest.map((item) => ({ userId: item._id, user: userMap.get(item._id), lastMessage: item.lastMessage, lastAt: item.lastAt }));
  }

  async createMessage(userId: string, senderType: 'user' | 'admin', raw: string) {
    const message = String(raw ?? '').trim();
    if (!message) throw new BadRequestException('Message is required');
    if (message.length > 4000) throw new BadRequestException('Message is too long');
    if (senderType === 'user') {
      const user = await this.assertVip(userId);
      if (user.supportBlocked) throw new ForbiddenException('You are blocked from sending support messages');
      const last = await this.messageModel.findOne({ userId, senderType: 'user' }).sort({ createdAt: -1 }).lean();
      if (last?.createdAt) {
        const waitMs = this.userCooldown * 1000 - (Date.now() - new Date(last.createdAt).getTime());
        if (waitMs > 0) throw new BadRequestException(`Please wait ${Math.ceil(waitMs / 1000)} seconds before sending another message`);
      }
    }
    const expiresAt = new Date(Date.now() + this.ttlDays * 24 * 60 * 60 * 1000);
    return (await this.messageModel.create({ userId, senderType, message, expiresAt })).toObject();
  }

  get cooldownSeconds() {
    return this.userCooldown;
  }
}
