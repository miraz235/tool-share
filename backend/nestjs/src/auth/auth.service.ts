import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(payload: RegisterDto) {
    const existing = await this.usersService.findByEmail(payload.email);
    if (existing) {
      throw new UnauthorizedException('Email already registered');
    }

    const password_hash = await bcrypt.hash(payload.password, 10);
    const id = `user_${Math.random().toString(36).slice(2, 14)}`;
    const user = await this.usersService.create({
      id,
      email: payload.email,
      password_hash,
      name: payload.name,
      auth_provider: 'email',
      is_verified: false,
    });

    return {
      token: this.signToken(user.id),
      user,
    };
  }

  async login(payload: LoginDto) {
    const user = await this.usersService.findByEmail(payload.email);
    if (!user || !user.password_hash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(payload.password, user.password_hash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return {
      token: this.signToken(user.id),
      user,
    };
  }

  signToken(userId: string) {
    return this.jwtService.sign({ sub: userId });
  }
}
