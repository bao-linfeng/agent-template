import type { NotifyInput } from './notifications.service.js'
import {
  categoriesFor,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_TYPE_KEYS,
  notificationTypeDefinition,
  renderTemplate,
  typesOf,
} from './notifications.catalog.js'

describe('notification catalog', () => {
  it('declares consistent types', () => {
    for (const type of NOTIFICATION_TYPE_KEYS) {
      const definition = notificationTypeDefinition(type)
      expect(type.startsWith(`${definition.category}.`)).toBe(true)
      expect(definition.realms.length).toBeGreaterThan(0)
      expect(definition.channels.length).toBeGreaterThan(0)
      for (const channel of definition.channels) {
        expect(NOTIFICATION_CHANNELS).toContain(channel)
      }
      for (const [realm, link] of Object.entries(definition.link ?? {})) {
        expect(definition.realms).toContain(realm)
        expect(link).toMatch(/^\/(?!\/)/)
      }
      // Every placeholder of the English fallback is a declared parameter.
      const shape = (
        definition.params as unknown as { shape: Record<string, unknown> }
      ).shape
      for (const [, name] of `${definition.title} ${definition.body}`.matchAll(
        /\{(\w+)\}/g,
      )) {
        expect(Object.keys(shape)).toContain(name)
      }
    }
    for (const category of Object.keys(NOTIFICATION_CATEGORIES)) {
      expect(
        typesOf(category as keyof typeof NOTIFICATION_CATEGORIES),
      ).not.toEqual([])
    }
  })

  it('lists the categories and channels each realm uses', () => {
    expect(categoriesFor('user')).toEqual([
      expect.objectContaining({
        category: 'security',
        mandatory: true,
        channels: ['inApp', 'email'],
      }),
      expect.objectContaining({
        category: 'account',
        mandatory: false,
        channels: ['inApp', 'email'],
      }),
      expect.objectContaining({
        category: 'knowledgeBase',
        mandatory: false,
        channels: ['inApp'],
      }),
    ])
    expect(categoriesFor('admin').map((entry) => entry.category)).toEqual([
      'security',
    ])
  })

  it('validates parameters', () => {
    const exportReady = notificationTypeDefinition('account.exportReady')
    expect(
      exportReady.params.safeParse({
        exportId: '0f8fad5b-d9cb-469f-a165-70867728950e',
        expiresAt: '2026-10-21T03:00:00.000Z',
      }).success,
    ).toBe(true)
    expect(
      exportReady.params.safeParse({ exportId: 'x', expiresAt: 'tomorrow' })
        .success,
    ).toBe(false)
  })

  it('fills placeholders and keeps unknown ones', () => {
    expect(
      renderTemplate('"{title}" has {chunkCount} chunks ({missing})', {
        title: 'Guide',
        chunkCount: 3,
      }),
    ).toBe('"Guide" has 3 chunks ({missing})')
  })

  it('types notify input by notification type', () => {
    // Compile-time checks only (vitest does not typecheck, `pnpm check-types` does).
    const valid: NotifyInput<'knowledgeBase.documentFailed'> = {
      realm: 'user',
      recipientId: 'id',
      type: 'knowledgeBase.documentFailed',
      params: { knowledgeBaseId: 'kb', documentId: 'doc', title: 'Guide' },
    }
    // @ts-expect-error email types need the rendered mail
    const withoutMail: NotifyInput<'security.passwordChanged'> = {
      realm: 'user',
      recipientId: 'id',
      type: 'security.passwordChanged',
      params: {},
    }
    const wrongRealm: NotifyInput<'security.twoFactorChanged'> = {
      // @ts-expect-error two-factor notifications only go to admin accounts
      realm: 'user',
      recipientId: 'id',
      type: 'security.twoFactorChanged',
      params: { change: 'enabled' },
      mail: { to: 'a@b.c', subject: '', text: '', html: '' },
    }
    expect([valid, withoutMail, wrongRealm]).toHaveLength(3)
  })
})
