import { Module } from '@nestjs/common';
import { AdminUsersController } from './admin-users.controller.js';
import { AvatarsController, MeController } from './users.controller.js';
import { UsersService } from './users.service.js';

@Module({
  controllers: [MeController, AvatarsController, AdminUsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
