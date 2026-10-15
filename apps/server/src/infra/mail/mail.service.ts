import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { QUEUES } from '../queue/queue.module.js';
import type { RenderedMail } from './mail.templates.js';

export interface MailJob extends RenderedMail {
  to: string;
}

/** Sends mail asynchronously through the `mail` queue; delivery is retried by BullMQ. */
@Injectable()
export class MailService {
  constructor(
    @InjectQueue(QUEUES.mail) private readonly queue: Queue<MailJob>,
  ) {}

  async send(to: string, mail: RenderedMail): Promise<void> {
    await this.queue.add('send', { to, ...mail }, { attempts: 5 });
  }
}
