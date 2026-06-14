import { HttpException, HttpStatus, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import bcrypt from 'bcrypt';
import { Model } from 'mongoose';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginDto } from './dto/update-user.dto';
import { User, UserDocument, UserType } from './entities/user.entity';

@Injectable()
export class UserService implements OnModuleInit {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    const adminPhone = this.configService.get<string>('ADMIN_USER');
    const adminPassword = this.configService.get<string>('ADMIN_PASSWORD');
    if (!adminPhone || !adminPassword) return;

    const existing = await this.userModel.findOne({ phoneNumber: adminPhone }).lean();
    if (existing) return;

    await this.userModel.create({
      name: 'admin',
      phoneNumber: adminPhone,
      password: await bcrypt.hash(adminPassword, 10),
      role: UserType.ADMIN,
      isOtpVerified: true,
    });
  }

  async create(dto: CreateUserDto) {
    const exists = await this.userModel.findOne({ phoneNumber: dto.phoneNumber }).lean();
    if (exists) {
      throw new HttpException('User already exists', HttpStatus.BAD_REQUEST);
    }

    const user = await this.userModel.create({
      ...dto,
      role: dto.role ?? UserType.USER,
      password: await bcrypt.hash(dto.password, 10),
      isOtpVerified: true,
      otpNumber: '000000',
    });

    const { password, ...safeUser } = user.toObject();
    const access_token = await this.signToken(safeUser);

    return { message: 'User created successfully', data: safeUser, user: safeUser, access_token };
  }

  async loginUser(dto: LoginDto) {
    const user = await this.userModel.findOne({ phoneNumber: dto.phoneNumber }).lean();
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
    const user = await this.userModel.findById(id).select('-password').lean();
    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }
    return { data: user };
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
