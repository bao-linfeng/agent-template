import { Global, Module } from '@nestjs/common';
import { RbacService } from './rbac.service.js';
import { RolesController } from './roles.controller.js';
import { RolesService } from './roles.service.js';

@Global()
@Module({
  controllers: [RolesController],
  providers: [RbacService, RolesService],
  exports: [RbacService],
})
export class RbacModule {}
