import { Body, Controller, Delete, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { AuthGuard, type ExpressRequest } from 'src/lib/auth.guard';
import { Roles } from 'src/lib/roles.decorator';
import { RolesGuard } from 'src/lib/roles.guard';
import { UserType } from 'src/user/entities/user.entity';
import { Req } from '@nestjs/common';
import { SupportService } from './support.service';
import { SupportGateway } from './support.gateway';

@Controller('support')
@UseGuards(AuthGuard)
export class SupportController {
  constructor(
    private readonly supportService: SupportService,
    private readonly supportGateway: SupportGateway,
  ) {}

  @Get('me')
  async myHistory(@Req() req: ExpressRequest) {
    const user = await this.supportService.assertVip(req.user.id);
    const messages = await this.supportService.history(req.user.id);
    return { data: { messages, cooldownSeconds: this.supportService.cooldownSeconds, supportBlocked: Boolean(user.supportBlocked) } };
  }

  @Get('admin/conversations')
  @UseGuards(RolesGuard)
  @Roles(UserType.ADMIN)
  async conversations() {
    return { data: await this.supportService.conversations() };
  }

  @Get('admin/users/:id')
  @UseGuards(RolesGuard)
  @Roles(UserType.ADMIN)
  async adminHistory(@Param('id') id: string) {
    return { data: await this.supportService.adminHistory(id) };
  }

  @Delete('admin/users/:id/conversation')
  @UseGuards(RolesGuard)
  @Roles(UserType.ADMIN)
  async deleteConversation(@Param('id') id: string) {
    const data = await this.supportService.deleteConversation(id);
    this.supportGateway.notifyConversationCleared(id);
    return { data };
  }

  @Patch('admin/users/:id/block')
  @UseGuards(RolesGuard)
  @Roles(UserType.ADMIN)
  async setBlocked(@Param('id') id: string, @Body() body: { blocked?: boolean }) {
    const blocked = Boolean(body?.blocked);
    const data = await this.supportService.setBlocked(id, blocked);
    this.supportGateway.notifyUserBlocked(id, blocked);
    return { data };
  }
}
