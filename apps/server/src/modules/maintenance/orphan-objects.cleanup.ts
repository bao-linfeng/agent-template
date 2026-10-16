import { Injectable } from '@nestjs/common'
import { inArray } from 'drizzle-orm'
import type { Database } from '../../database/database.js'
import { InjectDb } from '../../database/database.module.js'
import { accountExports, documents } from '../../database/schema/index.js'
import { StorageService } from '../../infra/storage/storage.service.js'
import { REALMS, REALM_TABLES } from '../auth/realms.js'

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
/** `avatars/<accountId>/<uuid>.<ext>` (see `avatarKey`), for accounts of either realm. */
const AVATAR_KEY = new RegExp(`^avatars/(${UUID})/${UUID}\\.[a-z0-9]+$`)
/** `rag/<kbId>/<documentId>/source.<ext>` (see `DocumentsService.store`). */
const RAG_SOURCE_KEY = new RegExp(`^rag/${UUID}/(${UUID})/source\\.[a-z0-9]+$`)
/** `exports/<userId>/<exportId>.json` (see `accountExportKey`). */
const EXPORT_KEY = new RegExp(`^exports/${UUID}/(${UUID})\\.json$`)

/** Prefixes the sweep walks; keys under them that do not match a known shape are left alone. */
export const SWEPT_PREFIXES = ['avatars/', 'rag/', 'exports/'] as const

export type ObjectOwner =
  | { kind: 'avatar'; accountId: string }
  | { kind: 'rag-source'; documentId: string }
  | { kind: 'account-export'; exportId: string }

/** The row that would reference `key`, or `undefined` for keys this server never generates. */
export function parseObjectKey(key: string): ObjectOwner | undefined {
  const avatar = AVATAR_KEY.exec(key)
  if (avatar) {
    return { kind: 'avatar', accountId: avatar[1]! }
  }
  const source = RAG_SOURCE_KEY.exec(key)
  if (source) {
    return { kind: 'rag-source', documentId: source[1]! }
  }
  const accountExport = EXPORT_KEY.exec(key)
  if (accountExport) {
    return { kind: 'account-export', exportId: accountExport[1]! }
  }
  return undefined
}

/**
 * Deletes avatar, RAG source and data export objects that no row references anymore: avatars replaced
 * or removed while storage was unreachable, files of deleted documents/knowledge bases/exports/accounts
 * whose cleanup failed, and uploads whose row was never written. Uploads write the object before the row, so only objects last
 * modified before `before` are considered.
 */
@Injectable()
export class OrphanObjectsCleanup {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly storage: StorageService,
  ) {}

  async run(before: Date): Promise<number> {
    let deleted = 0
    for (const prefix of SWEPT_PREFIXES) {
      for await (const page of this.storage.listObjects(prefix)) {
        const candidates = page
          .filter((item) => item.lastModified && item.lastModified < before)
          .map((item) => item.key)
        const orphans = await this.findOrphans(candidates)
        if (orphans.length > 0) {
          deleted += await this.storage.deleteObjects(orphans)
        }
      }
    }
    return deleted
  }

  /** Keys of a known shape whose owning row is gone or points at another object. */
  private async findOrphans(keys: string[]): Promise<string[]> {
    const owners = keys.flatMap((key) => {
      const owner = parseObjectKey(key)
      return owner ? [{ key, owner }] : []
    })
    if (owners.length === 0) {
      return []
    }
    const accountIds = owners.flatMap(({ owner }) =>
      owner.kind === 'avatar' ? [owner.accountId] : [],
    )
    const documentIds = owners.flatMap(({ owner }) =>
      owner.kind === 'rag-source' ? [owner.documentId] : [],
    )
    const exportIds = owners.flatMap(({ owner }) =>
      owner.kind === 'account-export' ? [owner.exportId] : [],
    )
    const referenced = new Set<string | null>()
    if (accountIds.length > 0) {
      for (const realm of REALMS) {
        const { accounts } = REALM_TABLES[realm]
        const rows = await this.db
          .select({ key: accounts.avatarKey })
          .from(accounts)
          .where(inArray(accounts.id, accountIds))
        for (const row of rows) referenced.add(row.key)
      }
    }
    if (documentIds.length > 0) {
      const rows = await this.db
        .select({ key: documents.storageKey })
        .from(documents)
        .where(inArray(documents.id, documentIds))
      for (const row of rows) referenced.add(row.key)
    }
    if (exportIds.length > 0) {
      const rows = await this.db
        .select({ key: accountExports.storageKey })
        .from(accountExports)
        .where(inArray(accountExports.id, exportIds))
      for (const row of rows) referenced.add(row.key)
    }
    return owners.flatMap(({ key }) => (referenced.has(key) ? [] : [key]))
  }
}
