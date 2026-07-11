import { Body, Controller, Get, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, type ExpressRequest } from 'src/lib/auth.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { FindOneTokenDto, LoginDto, OtpstringDto } from './dto/update-user.dto';
import { UserService } from './user.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.userService.create(dto);
  }

  @Post('login-user')
  login(@Body() dto: LoginDto) {
    return this.userService.loginUser(dto);
  }

  @Post('verify-otp')
  verifyOtp(@Body() dto: OtpstringDto) {
    return this.userService.verifyOtp(dto.otp);
  }

  @Post('login-user-with-google')
  loginWithGoogle(@Body() dto: FindOneTokenDto) {
    return this.userService.loginWithGoogle(dto.id);
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
}
