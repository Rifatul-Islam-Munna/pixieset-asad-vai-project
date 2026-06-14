import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';


export type jwts= {
    email:string,
    id:string,
    role:string,
    mobileNumber:string
}
export interface ExpressRequest extends Request {
    user:jwts
}
@Injectable()
export class AuthGuard implements CanActivate {

  private logger = new Logger(AuthGuard.name)
    constructor(private readonly jwtService: JwtService,private readonly configService: ConfigService) {}
    canActivate(context: ExecutionContext): boolean | Promise<boolean> {
     
        
  
      
        const request: ExpressRequest = context.switchToHttp().getRequest();

       
        const token = request.headers["access_token"] as string
        this.logger.log("access_token----->",token)
        if(!token){
            throw new UnauthorizedException('No token found');
        }
       

        return this.validateToken(request,token);
    }

   
    
      private async validateToken(request:ExpressRequest,token: string): Promise<boolean> {
        try {
              const secret = this.configService.get<string>('ACCESS_TOKEN');
  this.logger.log('🔑 Regular Login SECRET in Auh:', secret); // Debug
       
          const decoded = await this.jwtService.verifyAsync<jwts>(token,{secret:secret}); 

    
           
           if (!decoded) {
            throw new Error('Token verification returned no payload');
        }
        this.logger.log("decoded->",decoded)

        if (  !decoded.id || !decoded.role  ) {
            throw new Error('Incomplete JWT payload');
        }
          request.user = decoded;
         
          return true; 
        } catch (error) {
          this.logger.debug("token-error->",error)
          throw new UnauthorizedException('Invalid or expired token');
        }
      }

}