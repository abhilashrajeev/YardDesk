import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthUser } from './decorators';

interface JwtPayload {
  sub: string;
  role: AuthUser['role'];
  name: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') as string,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    return { userId: payload.sub, role: payload.role, name: payload.name };
  }
}
