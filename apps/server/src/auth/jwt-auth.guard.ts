import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AuthenticatedUser } from './current-user.decorator.js';

interface JwtPayload {
  sub: number;
  email: string;
}

interface AuthRequest {
  headers: { cookie?: string };
  user?: AuthenticatedUser;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const token = this.getCookie(request.headers.cookie, 'access_token');
    if (!token) {
      throw new UnauthorizedException('Authentication required');
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      if (!Number.isInteger(payload.sub) || typeof payload.email !== 'string') {
        throw new UnauthorizedException('Invalid authentication token');
      }
      request.user = { userId: payload.sub, email: payload.email };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired authentication token');
    }
  }

  private getCookie(cookieHeader: string | undefined, name: string): string | undefined {
    const prefix = `${name}=`;
    const cookie = cookieHeader?.split(';').map((part) => part.trim()).find((part) => part.startsWith(prefix));
    if (!cookie) {
      return undefined;
    }
    try {
      return decodeURIComponent(cookie.slice(prefix.length));
    } catch {
      return undefined;
    }
  }
}
