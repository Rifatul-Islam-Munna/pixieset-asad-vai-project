import { JwtService } from '@nestjs/jwt';
import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { SupportService } from './support.service';

const idleMs = Math.max(60_000, Number(process.env.SUPPORT_SOCKET_IDLE_MINUTES ?? 5) * 60_000);

@WebSocketGateway({
  namespace: '/support',
  cors: { origin: true, credentials: true },
  transports: ['websocket'],
  perMessageDeflate: false,
  maxHttpBufferSize: 16_384,
  pingInterval: 25_000,
  pingTimeout: 20_000,
})
export class SupportGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private adminSockets = new Set<string>();
  private idleTimers = new Map<string, NodeJS.Timeout>();

  constructor(private readonly jwt: JwtService, private readonly support: SupportService) {}
  private touch(client: Socket) {
    const previous = this.idleTimers.get(client.id);
    if (previous) clearTimeout(previous);
    const timer = setTimeout(() => {
      this.idleTimers.delete(client.id);
      if (client.connected) client.disconnect(true);
    }, idleMs);
    timer.unref?.();
    this.idleTimers.set(client.id, timer);
  }

  private clearIdle(clientId: string) {
    const timer = this.idleTimers.get(clientId);
    if (timer) clearTimeout(timer);
    this.idleTimers.delete(clientId);
  }

  async handleConnection(client: Socket) {
    try {
      const token = String(client.handshake.auth?.token ?? '');
      const payload = await this.jwt.verifyAsync<any>(token, { secret: process.env.ACCESS_TOKEN ?? 'dev-secret' });
      client.data.user = payload;
      this.touch(client);
      if (payload.role === 'admin') {
        this.adminSockets.add(client.id);
        client.join('support:admins');
        this.server.to('support:vip-users').emit('support:admin-status', { online: true });
      } else {
        await this.support.assertVip(payload.id);
        client.join('support:vip-users');
        client.join(`support:user:${payload.id}`);
        client.emit('support:admin-status', { online: this.adminSockets.size > 0 });
      }
    } catch {
      this.clearIdle(client.id);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.clearIdle(client.id);
    if (this.adminSockets.delete(client.id) && this.adminSockets.size === 0) {
      this.server.to('support:vip-users').emit('support:admin-status', { online: false });
    }
  }

  @SubscribeMessage('support:active')
  active(@ConnectedSocket() client: Socket) {
    this.touch(client);
    return { ok: true };
  }
  notifyUserBlocked(userId: string, blocked: boolean) {
    this.server.to(`support:user:${userId}`).emit('support:blocked', { blocked });
    this.server.to('support:admins').emit('support:blocked', { userId, blocked });
  }

  notifyConversationCleared(userId: string) {
    this.server.to(`support:user:${userId}`).emit('support:conversation-cleared');
    this.server.to('support:admins').emit('support:conversation-cleared', { userId });
  }

  @SubscribeMessage('support:send')
  async send(@ConnectedSocket() client: Socket, @MessageBody() body: { message: string; userId?: string }) {
    this.touch(client);
    const auth = client.data.user;
    const isAdmin = auth?.role === 'admin';
    const userId = isAdmin ? String(body.userId ?? '') : String(auth?.id ?? '');
    if (!userId) return { ok: false, error: 'User is required' };
    try {
      const saved = await this.support.createMessage(userId, isAdmin ? 'admin' : 'user', body.message);
      this.server.to(`support:user:${userId}`).emit('support:message', saved);
      this.server.to('support:admins').emit('support:message', saved);
      return { ok: true, data: saved };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Message failed' };
    }
  }
}
