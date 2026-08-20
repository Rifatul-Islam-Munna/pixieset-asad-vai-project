import { HttpException, HttpStatus, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import { Model } from 'mongoose';
import { createHash, randomBytes } from 'node:crypto';
import { CollectionImage, CollectionImageDocument } from 'src/collections/entities/collection-image.entity';
import { MobileGalleryImage, MobileGalleryImageDocument } from 'src/mobile-gallery/entities/mobile-gallery-image.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginDto } from './dto/update-user.dto';
import { User, UserDocument, UserType } from './entities/user.entity';
import { FreePlanSettingService } from 'src/admin/free-plan-setting.service';
import { HomepageService } from 'src/homepage/homepage.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { MailService } from 'src/mail/mail.service';

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
    private readonly mailService: MailService,
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

  async requestPasswordlessAccess(emailValue: string) {
    const email = emailValue.trim().toLowerCase();
    const genericResponse = { message: 'If an account exists for that email, a login link and PIN have been sent.' };
    const user = await this.userModel.findOne({ email });
    if (!user || !user.email) return genericResponse;
    const pin = String(Math.floor(100000 + Math.random() * 900000));
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    user.loginPinHash = await bcrypt.hash(pin, 10);
    user.loginTokenHash = createHash('sha256').update(token).digest('hex');
    user.loginExpiresAt = expiresAt;
    user.loginAttempts = 0;
    await user.save();
    const appUrl = (this.configService.get<string>('FRONTEND_URL') || this.configService.get<string>('APP_URL') || 'http://localhost:3000').replace(/\/$/, '');
    const link = `${appUrl}/login?magic=${encodeURIComponent(token)}`;
    const expiryText = expiresAt.toLocaleString();
    const text = `Hello ${user.name || 'there'},\n\nYou requested access to your account.\n\nYour 6-digit login PIN is: ${pin}\n\nOr use this direct login link:\n${link}\n\nThis access is valid for 30 days, until ${expiryText}, and can only be used once.\n\nIf you did not request this email, you can ignore it.`;
    const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    const safeLink = escapeHtml(link);
    const safeName = escapeHtml(user.name || 'there');
    const html = `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;padding:32px;line-height:1.65;color:#1f1f1f"><h2 style="margin:0 0 18px">Your secure login access</h2><p>Hello ${safeName},</p><p>You requested access to your account.</p><p>Your 6-digit login PIN is:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:8px 0 22px">${pin}</p><p><a href="${safeLink}" style="display:inline-block;background:#6337d8;color:#fff;text-decoration:none;padding:12px 18px;border-radius:7px;font-weight:600">Log in directly</a></p><p style="margin-top:24px">This access is valid for 30 days, until ${escapeHtml(expiryText)}, and can only be used once.</p><p>If you did not request this email, you can ignore it.</p></div>`;
    await this.mailService.send({ to: user.email, subject: 'Your secure login access', text, html });
    return genericResponse;
  }

  async loginWithPin(loginValue: string, pin: string) {
    const login = loginValue.trim().toLowerCase();
    const user = await this.userModel.findOne({ $or: [{ phoneNumber: login }, { email: login }] });
    if (!user || !user.loginPinHash || !user.loginExpiresAt || user.loginExpiresAt.getTime() < Date.now())
      throw new HttpException('PIN is invalid or expired', HttpStatus.BAD_REQUEST);
    if ((user.loginAttempts ?? 0) >= 5) throw new HttpException('PIN is locked. Ask for a new login email.', HttpStatus.TOO_MANY_REQUESTS);
    const valid = await bcrypt.compare(pin, user.loginPinHash);
    if (!valid) { user.loginAttempts = (user.loginAttempts ?? 0) + 1; await user.save(); throw new HttpException('PIN is invalid or expired', HttpStatus.BAD_REQUEST); }
    return this.finishPasswordlessLogin(user);
  }

  async loginWithMagicLink(token: string) {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const user = await this.userModel.findOne({ loginTokenHash: tokenHash });
    if (!user || !user.loginExpiresAt || user.loginExpiresAt.getTime() < Date.now())
      throw new HttpException('Login link is invalid or expired', HttpStatus.BAD_REQUEST);
    return this.finishPasswordlessLogin(user);
  }

  private async finishPasswordlessLogin(user: UserDocument) {
    user.loginPinHash = undefined; user.loginTokenHash = undefined; user.loginExpiresAt = undefined; user.loginAttempts = 0;
    await user.save();
    const raw = user.toObject(); const { password, loginPinHash, loginTokenHash, ...safeUser } = raw as any;
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
