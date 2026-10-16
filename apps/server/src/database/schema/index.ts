import { relations } from 'drizzle-orm'
import { embeddingModels } from './ai.js'
import { adminSessions, authSessions } from './auth.js'
import { chunks, documents, knowledgeBases } from './rag.js'
import { adminUserRoles, roles } from './rbac.js'
import { adminUsers, users } from './users.js'

export * from './ai.js'
export * from './audit.js'
export * from './auth.js'
export * from './rag.js'
export * from './rbac.js'
export * from './users.js'

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(authSessions),
}))

export const adminUsersRelations = relations(adminUsers, ({ many }) => ({
  adminUserRoles: many(adminUserRoles),
  sessions: many(adminSessions),
}))

export const rolesRelations = relations(roles, ({ many }) => ({
  adminUserRoles: many(adminUserRoles),
}))

export const adminUserRolesRelations = relations(adminUserRoles, ({ one }) => ({
  adminUser: one(adminUsers, {
    fields: [adminUserRoles.adminUserId],
    references: [adminUsers.id],
  }),
  role: one(roles, { fields: [adminUserRoles.roleId], references: [roles.id] }),
}))

export const authSessionsRelations = relations(authSessions, ({ one }) => ({
  user: one(users, { fields: [authSessions.userId], references: [users.id] }),
}))

export const adminSessionsRelations = relations(adminSessions, ({ one }) => ({
  adminUser: one(adminUsers, {
    fields: [adminSessions.userId],
    references: [adminUsers.id],
  }),
}))

export const knowledgeBasesRelations = relations(
  knowledgeBases,
  ({ one, many }) => ({
    owner: one(users, {
      fields: [knowledgeBases.ownerId],
      references: [users.id],
    }),
    embeddingModel: one(embeddingModels, {
      fields: [knowledgeBases.embeddingModelId],
      references: [embeddingModels.id],
    }),
    documents: many(documents),
  }),
)

export const documentsRelations = relations(documents, ({ one, many }) => ({
  knowledgeBase: one(knowledgeBases, {
    fields: [documents.knowledgeBaseId],
    references: [knowledgeBases.id],
  }),
  chunks: many(chunks),
}))

export const chunksRelations = relations(chunks, ({ one }) => ({
  document: one(documents, {
    fields: [chunks.documentId],
    references: [documents.id],
  }),
}))
