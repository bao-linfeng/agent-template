import { Injectable } from '@nestjs/common';
import type { PublicUser, User } from './user.entity.js';

@Injectable()
export class UserService {
  private readonly users: User[] = [];

  async create(email: string, password: string, nickname: string): Promise<PublicUser> {
    const user: User = {
      id: this.users.length + 1,
      email,
      password,
      nickname,
    };
    this.users.push(user);
    return this.toPublicUser(user);
  }

  async findByEmail(email: string): Promise<User | undefined> {
    return this.users.find((user) => user.email === email);
  }

  async findById(id: number): Promise<PublicUser | undefined> {
    const user = this.users.find((candidate) => candidate.id === id);
    return user ? this.toPublicUser(user) : undefined;
  }

  private toPublicUser(user: User): PublicUser {
    const { password: _password, ...publicUser } = user;
    return publicUser;
  }
}
