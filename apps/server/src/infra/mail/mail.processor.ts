import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Inject, Logger } from '@nestjs/common'
import type { Job } from 'bullmq'
import { QUEUES } from '../queue/queue.module.js'
import type { MailJob } from './mail.service.js'

export const MAIL_TRANSPORT = Symbol('MAIL_TRANSPORT')

/** Minimal surface of a nodemailer transporter; tests replace it with an in-memory fake. */
export interface MailTransport {
  sendMail(message: MailJob & { from?: string }): Promise<unknown>
}

@Processor(QUEUES.mail)
export class MailProcessor extends WorkerHost {
  private readonly logger = new Logger(MailProcessor.name)

  constructor(
    @Inject(MAIL_TRANSPORT) private readonly transport: MailTransport,
  ) {
    super()
  }

  async process(job: Job<MailJob>): Promise<void> {
    await this.transport.sendMail(job.data)
    this.logger.log(`Sent mail job ${job.id} ("${job.data.subject}")`)
  }
}
