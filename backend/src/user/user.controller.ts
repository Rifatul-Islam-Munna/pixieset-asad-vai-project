import { Body, Controller, Get, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard, type ExpressRequest } from 'src/lib/auth.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { FindOneTokenDto, LoginDto, OtpstringDto } from './dto/update-user.dto';
import { UserService } from './user.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ForgotPasswordDto, MagicLoginDto, PinLoginDto } from './dto/passwordless-login.dto';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.userService.create(dto);
  }

  @Post('login-user')
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.userService.loginUser(dto, this.loginContext(req));
  }

  @Post('verify-otp')
  verifyOtp(@Body() dto: OtpstringDto) {
    return this.userService.verifyOtp(dto.otp);
  }

  @Post('login-with-pin')
  loginWithPin(@Body() dto: PinLoginDto, @Req() req: Request) {
    return this.userService.loginWithPin(dto.login, dto.pin, this.loginContext(req));
  }

  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.userService.requestPasswordlessAccess(dto.email);
  }

  @Post('login-with-link')
  loginWithLink(@Body() dto: MagicLoginDto, @Req() req: Request) {
    return this.userService.loginWithMagicLink(dto.token, this.loginContext(req));
  }

  @Post('login-user-with-google')
  loginWithGoogle(@Body() dto: FindOneTokenDto, @Req() req: Request) {
    return this.userService.loginWithGoogle(dto.id, this.loginContext(req));
  }

  @Get('get-my-profile')
  @UseGuards(AuthGuard)
  getMyProfile(@Req() req: ExpressRequest) {
    return this.userService.findProfile(req.user.id);
  }

  @Get('username-availability')
  @UseGuards(AuthGuard)
  usernameAvailability(@Req() req: ExpressRequest, @Query('username') username: string) {
    return this.userService.usernameAvailability(username, req.user.id);
  }

  @Patch('profile')
  @UseGuards(AuthGuard)
  updateProfile(@Req() req: ExpressRequest, @Body() dto: UpdateProfileDto) {
    return this.userService.updateProfile(req.user.id, dto);
  }

  private loginContext(req: Request) {
    const cfIp = req.header('cf-connecting-ip');
    const realIp = req.header('x-real-ip');
    const forwarded = req.header('x-forwarded-for')?.split(',')[0]?.trim();
    const country = req.header('cf-ipcountry')?.trim();
    const region = req.header('cf-region')?.trim();
    const city = req.header('cf-city')?.trim();
    return {
      ipAddress: cfIp || realIp || forwarded || req.ip,
      userAgent: req.header('user-agent')?.slice(0, 500),
      location: [city, region, country].filter(Boolean).join(', ') || undefined,
    };
  }
}
