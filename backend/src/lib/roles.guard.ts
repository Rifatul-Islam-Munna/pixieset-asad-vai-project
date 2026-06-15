
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { ExpressRequest } from './auth.guard';
import { ROLES_KEY } from './roles.decorator';

import { Reflector } from '@nestjs/core';
import { UserType } from 'src/user/entities/user.entity';


@Injectable()
export class RolesGuard implements CanActivate {
    constructor(
        
        private readonly reflector: Reflector, 
      ) {}

      canActivate(context: ExecutionContext): boolean {
        const request:ExpressRequest = context.switchToHttp().getRequest();
      
        const user = request.user;
        if (!user) {
            throw new UnauthorizedException('You need to be authenticated to access this resource.');
          }
          const requiredRoles = this.reflector.getAllAndOverride<UserType[]>(ROLES_KEY, [
            context.getHandler(),
            context.getClass(),
          ]);
          if (!requiredRoles) {
            return true; 
          }
          const hasRole = requiredRoles.some((role) => user.role?.includes(role));
          if (!hasRole) {
            throw new ForbiddenException('You do not have the necessary permissions.');
          }
        return true;
      }

}
