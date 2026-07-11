import { HttpException, HttpStatus, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import { Model } from 'mongoose';
import { CollectionImage, CollectionImageDocument } from 'src/collections/entities/collection-image.entity';
import { MobileGalleryImage, MobileGalleryImageDocument } from 'src/mobile-gallery/entities/mobile-gallery-image.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginDto } from './dto/update-user.dto';
import { User, UserDocument, UserType } from './entities/user.entity';
import { FreePlanSettingService } from 'src/admin/free-plan-setting.service';
import { HomepageService } from 'src/homepage/homepage.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UserService implements OnModuleInit {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(CollectionImage.name) private readonly collectionImageModel: Model<CollectionImageDocument>,
    @InjectModel(MobileGalleryImage.name) private readonly mobileGalleryImageModel: Model<MobileGalleryImageDocument>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly freePlanSettings: FreePlanSettingService,
    private readonly homepageService: HomepageService,
  ) {}

  async onModuleInit() {
    const adminEmail = this.configService.get<string>('ADMIN_EMAIL') ?? 'test@gmail.com';
    const adminPassword = this.configService.get<string>('ADMIN_PASSWORD') ?? '11111111';

    const existing = await this.userModel.findOne({
      $or: [{ email: adminEmail }, { phoneNumber: adminEmail }],
    });

    if (existing) {
      existing.name = existing.name || 'admin';
      existing.email = adminEmail;
      existing.phoneNumber = adminEmail;
      existing.password = await bcrypt.hash(adminPassword, 10);
      existing.role = UserType.ADMIN;
      existing.isOtpVerified = true;
      await existing.save();
      return;
    }

    await this.userModel.create({
      name: 'admin',
      email: adminEmail,
      phoneNumber: adminEmail,
      password: await bcrypt.hash(adminPassword, 10),
      role: UserType.ADMIN,
      isOtpVerified: true,
    });
  }

  async create(dto: CreateUserDto) {
    const exists = await this.userModel.findOne({
      $or: [
        { phoneNumber: dto.phoneNumber },
        ...(dto.email ? [{ email: dto.email.trim().toLowerCase() }] : []),
      ],
    }).lean();
    if (exists) {
      throw new HttpException('User already exists', HttpStatus.BAD_REQUEST);
    }

    const freePlan = await this.freePlanSettings.get();
    const username = await this.generateUsername(dto.name);
    const user = await this.userModel.create({
      ...dto,
      username,
      businessName: dto.name,
      email: dto.email?.trim().toLowerCase(),
      role: dto.role ?? UserType.USER,
      password: await bcrypt.hash(dto.password, 10),
      isOtpVerified: true,
      otpNumber: '000000',
      storageLimitGb: freePlan.storageGb,
      videoUploadLimitMinutes: 0,
      videoUploadQuality: 'hd',
      monthlyEmailLimit: freePlan.monthlyEmails,
      planFeatures: { marketingEmails: freePlan.monthlyEmails > 0 },
    });

    await this.homepageService.provisionForUser(user._id.toString());

    const { password, ...safeUser } = user.toObject();
    const access_token = await this.signToken(safeUser);

    return { message: 'User created successfully', data: safeUser, user: safeUser, access_token };
  }

  async loginUser(dto: LoginDto) {
    const login = dto.phoneNumber.trim().toLowerCase();
    const user = await this.userModel.findOne({
      $or: [{ phoneNumber: login }, { email: login }],
    }).lean();
    if (!user) {
      throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
    }

    const match = await bcrypt.compare(dto.password, user.password);
    if (!match) {
      throw new HttpException('Invalid credentials', HttpStatus.BAD_REQUEST);
    }

    const { password, ...safeUser } = user;
    const access_token = await this.signToken(safeUser);

    return { message: 'User logged in successfully', access_token, user: safeUser };
  }

  async loginWithGoogle(tokenId: string) {
    const googleClientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    if (!googleClientId) {
      throw new HttpException('Google login is not configured', HttpStatus.BAD_REQUEST);
    }

    const client = new OAuth2Client(googleClientId);
    let payload: { sub?: string; email?: string; name?: string; picture?: string; email_verified?: boolean } | undefined;

    try {
      const ticket = await client.verifyIdToken({ idToken: tokenId, audience: googleClientId });
      payload = ticket.getPayload();
    } catch {
      throw new HttpException('Invalid Google token', HttpStatus.BAD_REQUEST);
    }

    const email = payload?.email?.trim().toLowerCase();
    if (!email || !payload?.email_verified) {
      throw new HttpException('Google email is not verified', HttpStatus.BAD_REQUEST);
    }

    const googleId = payload.sub ?? '';
    const existing = await this.userModel.findOne({
      $or: [{ email }, { phoneNumber: email }, ...(googleId ? [{ googleId }] : [])],
    });

    const freePlan = await this.freePlanSettings.get();
    const user =
      existing ??
      (await this.userModel.create({
        name: payload.name || email.split('@')[0],
        username: await this.generateUsername(payload.name || email.split('@')[0]),
        businessName: payload.name || email.split('@')[0],
        email,
        phoneNumber: email,
        password: await bcrypt.hash(`${googleId || email}:${Date.now()}`, 10),
        googleId,
        avatar: payload.picture,
        role: UserType.USER,
        isOtpVerified: true,
        otpNumber: '000000',
        storageLimitGb: freePlan.storageGb,
        videoUploadLimitMinutes: 0,
        videoUploadQuality: 'hd',
        monthlyEmailLimit: freePlan.monthlyEmails,
        planFeatures: { marketingEmails: freePlan.monthlyEmails > 0 },
      }));

    if (!existing) await this.homepageService.provisionForUser(user._id.toString());

    if (existing) {
      existing.email = existing.email || email;
      existing.googleId = existing.googleId || googleId;
      existing.avatar = payload.picture || existing.avatar;
      existing.isOtpVerified = true;
      await existing.save();
    }

    const { password, ...safeUser } = user.toObject();
    const access_token = await this.signToken(safeUser);

    return { message: 'User logged in successfully', access_token, user: safeUser };
  }

  async verifyOtp(otp: string) {
    const user = await this.userModel
      .findOneAndUpdate({ otpNumber: otp }, { isOtpVerified: true, otpNumber: null }, { returnDocument: 'after' })
      .lean();

    if (!user) {
      throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
    }

    const { password, ...safeUser } = user;
    const access_token = await this.signToken(safeUser);
    return { message: 'User verified successfully', data: safeUser, access_token };
  }

  async findProfile(id: string) {
    const monthKey = new Date().toISOString().slice(0, 7);
    const userRecord = await this.userModel.findById(id).select('-password');
    if (userRecord?.planExpiresAt && userRecord.planExpiresAt <= new Date()) {
      const freePlan = await this.freePlanSettings.get();
      userRecord.planId = undefined;
      userRecord.planName = 'Free';
      userRecord.storageLimitGb = freePlan.storageGb;
      userRecord.videoUploadLimitMinutes = 0;
      userRecord.videoUploadQuality = 'hd';
      userRecord.monthlyEmailLimit = freePlan.monthlyEmails;
      userRecord.planFeatures = { marketingEmails: freePlan.monthlyEmails > 0 };
      userRecord.monthlyEmailsUsed = 0;
      userRecord.monthlyUsageKey = monthKey;
      userRecord.planActivatedAt = undefined;
      userRecord.planBillingInterval = undefined;
      userRecord.planExpiresAt = undefined;
      await userRecord.save();
    }
    if (userRecord && userRecord.monthlyUsageKey !== monthKey) {
      userRecord.monthlyUsageKey = monthKey;
      userRecord.monthlyEmailsUsed = 0;
      await userRecord.save();
    }
    if (userRecord && !userRecord.username) {
      userRecord.username = await this.generateUsername(userRecord.name);
      await userRecord.save();
      await this.homepageService.setUsername(id, userRecord.username);
    }
    const user = userRecord?.toObject();
    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }
    // Auto-recalculate storage from actual images to fix any drift
    const recalculated = await this.recalculateStorage(id);
    user.storageUsedBytes = recalculated;

    return { data: user };
  }

  async usernameAvailability(raw: string, currentUserId: string) {
    const username = this.normalizeUsername(raw);
    if (username.length < 3) return { data: { username, available: false, reason: 'Use at least 3 characters' } };
    const exists = await this.userModel.exists({ username, _id: { $ne: currentUserId } });
    return { data: { username, available: !exists, reason: exists ? 'Username is not available' : '' } };
  }

  async updateProfile(id: string, dto: UpdateProfileDto) {
    const user = await this.userModel.findById(id);
    if (!user) throw new HttpException('User not found', HttpStatus.NOT_FOUND);

    if (dto.username !== undefined) {
      const username = this.normalizeUsername(dto.username);
      const status = await this.usernameAvailability(username, id);
      if (!status.data.available) throw new HttpException(status.data.reason, HttpStatus.CONFLICT);
      await this.homepageService.setUsername(id, username);
      user.username = username;
    }
    if (dto.email !== undefined) user.email = dto.email.trim().toLowerCase();
    const fields = ['businessName', 'firstName', 'lastName', 'phoneNumber', 'avatar', 'website', 'businessAddress', 'biography'] as const;
    for (const field of fields) if (dto[field] !== undefined) (user as any)[field] = dto[field]?.trim();
    if (dto.password) user.password = await bcrypt.hash(dto.password, 10);
    user.name = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.businessName || user.name;

    try {
      await user.save();
    } catch (error: any) {
      if (error?.code === 11000) throw new HttpException('Email, phone, or username already used', HttpStatus.CONFLICT);
      throw error;
    }
    const { password: _password, ...safe } = user.toObject();
    return { message: 'Account updated', data: safe };
  }

  private normalizeUsername(value: string) {
    return String(value || '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);
  }

  private async generateUsername(name: string) {
    const base = this.normalizeUsername(name).slice(0, 22) || 'user';
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const candidate = `${base}${Math.floor(1000 + Math.random() * 9000)}`;
      if (!(await this.userModel.exists({ username: candidate }))) return candidate;
    }
    return `${base}${Date.now().toString().slice(-8)}`;
  }

  async recalculateStorage(userId: string): Promise<number> {
    const [collectionResult, mobileResult] = await Promise.all([
      this.collectionImageModel.aggregate([
        { $match: { userId } },
        { $group: { _id: null, total: { $sum: '$sizeBytes' } } },
      ]),
      this.mobileGalleryImageModel.aggregate([
        { $match: { userId } },
        { $group: { _id: null, total: { $sum: '$sizeBytes' } } },
      ]),
    ]);
    const totalBytes = Math.max(0, Number(collectionResult[0]?.total ?? 0) + Number(mobileResult[0]?.total ?? 0));
    await this.userModel.updateOne({ _id: userId }, { $set: { storageUsedBytes: totalBytes } });
    return totalBytes;
  }

  private signToken(user: any) {
    return this.jwtService.signAsync(
      {
        email: user.email ?? '',
        id: user._id?.toString(),
        role: user.role,
        mobileNumber: user.phoneNumber,
      },
      { secret: this.configService.get<string>('ACCESS_TOKEN') ?? 'dev-secret', expiresIn: '10d' },
    );
  }
}
