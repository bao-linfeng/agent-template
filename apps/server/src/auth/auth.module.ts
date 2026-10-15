import { Module } from '@nestjs/common';
import { UserModule } from '../user/user.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { SecurityModule } from './security.module.js';

@Module({
  imports: [
    UserModule,
    SecurityModule,
  ],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
