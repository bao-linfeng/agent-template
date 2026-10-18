import { Processor, WorkerHost } from '@nestjs/bullmq'
import type { Job } from 'bullmq'
import { QUEUES } from '../../infra/queue/queue.module.js'
import {
  AnnouncementsService,
  type AnnouncementSignalJob,
} from './announcements.service.js'

/**
 * Delayed jobs queued when an announcement is scheduled or gets an expiry: at that time, open
 * notification streams of its audience learn that it appeared or disappeared.
 */
@Processor(QUEUES.notifications)
export class AnnouncementSignalsProcessor extends WorkerHost {
  constructor(private readonly announcements: AnnouncementsService) {
    super()
  }

  async process(job: Job<AnnouncementSignalJob>): Promise<void> {
    await this.announcements.signalScheduled(job.data)
  }
}
