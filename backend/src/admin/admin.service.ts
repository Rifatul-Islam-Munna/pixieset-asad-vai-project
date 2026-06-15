import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import bcrypt from 'bcrypt';
import { Model } from 'mongoose';
import { Collection, CollectionDocument } from 'src/collections/entities/collection.entity';
import { CollectionImage, CollectionImageDocument } from 'src/collections/entities/collection-image.entity';
import { User, UserDocument, UserType } from 'src/user/entities/user.entity';
import { AdminCreateUserDto, AdminUpdateUserDto } from './dto/admin-user.dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Collection.name) private readonly collectionModel: Model<CollectionDocument>,
    @InjectModel(CollectionImage.name) private readonly imageModel: Model<CollectionImageDocument>,
  ) {}

  async dashboard() {
    const [users, collections, images] = await Promise.all([
      this.userModel.countDocuments(),
      this.collectionModel.countDocuments(),
      this.imageModel.countDocuments(),
    ]);
    return { users, collections, images };
  }

  async findUsers() {
    const users = await this.userModel.find().select('-password').sort({ createdAt: -1 }).lean();
    const ids = users.map((user: any) => user._id.toString());
    const counts = await this.collectionModel.aggregate([
      { $match: { userId: { $in: ids } } },
      { $group: { _id: '$userId', count: { $sum: 1 } } },
    ]);
    const countMap = new Map(counts.map((item) => [item._id, item.count]));

    return users.map((user: any) => ({
      ...user,
      collectionCount: countMap.get(user._id.toString()) ?? 0,
    }));
  }

  async createUser(dto: AdminCreateUserDto) {
    await this.ensureUnique(dto.phoneNumber);
    const user = await this.userModel.create({
      ...dto,
      email: dto.email?.trim().toLowerCase(),
      role: dto.role ?? UserType.USER,
      password: await bcrypt.hash(dto.password, 10),
      isOtpVerified: true,
      otpNumber: '000000',
    });
    const { password, ...safeUser } = user.toObject();
    return safeUser;
  }

  async updateUser(id: string, dto: AdminUpdateUserDto) {
    const user = await this.userModel.findById(id);
    if (!user) throw new NotFoundException('User not found');
    if (dto.phoneNumber && dto.phoneNumber !== user.phoneNumber) await this.ensureUnique(dto.phoneNumber, id);

    if (dto.name !== undefined) user.name = dto.name;
    if (dto.phoneNumber !== undefined) user.phoneNumber = dto.phoneNumber;
    if (dto.email !== undefined) user.email = dto.email?.trim().toLowerCase();
    if (dto.gender !== undefined) user.gender = dto.gender;
    if (dto.role !== undefined) user.role = dto.role;
    if (dto.password) user.password = await bcrypt.hash(dto.password, 10);

    await user.save();
    const { password, ...safeUser } = user.toObject();
    return safeUser;
  }

  async deleteUser(id: string, currentAdminId: string) {
    if (id === currentAdminId) throw new BadRequestException('Admin cannot delete own account');
    const user = await this.userModel.findByIdAndDelete(id).select('-password').lean();
    if (!user) throw new NotFoundException('User not found');
    await Promise.all([
      this.collectionModel.deleteMany({ userId: id }),
      this.imageModel.deleteMany({ userId: id }),
    ]);
    return user;
  }

  async findCollections(userId?: string) {
    const filter = userId ? { userId } : {};
    const collections = await this.collectionModel.find(filter).sort({ createdAt: -1 }).lean();
    const userIds = [...new Set(collections.map((collection) => collection.userId))];
    const users = await this.userModel.find({ _id: { $in: userIds } }).select('name email phoneNumber').lean();
    const userMap = new Map(users.map((user: any) => [user._id.toString(), user]));

    return collections.map((collection: any) => ({
      ...collection,
      user: userMap.get(collection.userId) ?? null,
    }));
  }

  async deleteCollection(id: string) {
    const collection = await this.collectionModel.findByIdAndDelete(id).lean();
    if (!collection) throw new NotFoundException('Collection not found');
    await this.imageModel.deleteMany({ collectionId: id });
    return collection;
  }

  private async ensureUnique(phoneNumber: string, excludeId?: string) {
    const existing = await this.userModel.findOne({ phoneNumber }).lean();
    if (existing && existing._id.toString() !== excludeId) {
      throw new BadRequestException('User already exists');
    }
  }
}
