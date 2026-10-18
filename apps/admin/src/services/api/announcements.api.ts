import type { MaybeRefOrGetter } from 'vue'

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, toValue } from 'vue'

import { apiFetch } from '@/lib/api-client'

import type { IPaginated } from '../types/response.type'
import type { AnnouncementLevel } from './notifications.api'

import { compactQuery } from './admin-users.api'
import { NOTIFICATIONS_KEY } from './notifications.api'

/** `user` = client app users, `admin` = admin console accounts. */
export type AnnouncementAudience = 'all' | 'user' | 'admin'
/** `scheduled`: `publishedAt` is still in the future, hidden from the audience until then. */
export type AnnouncementStatus = 'draft' | 'scheduled' | 'published' | 'expired'

/** An announcement as administered (`/v1/admin/announcements`). Dates are ISO strings. */
export interface IAnnouncement {
  id: string
  title: string
  /** Plain text: render as text, never as HTML. */
  body: string
  level: AnnouncementLevel
  audience: AnnouncementAudience
  status: AnnouncementStatus
  publishedAt: string | null
  expiresAt: string | null
  createdBy: string | null
  updatedBy: string | null
  /** Accounts of the audience that have read it. */
  readCount: number
  createdAt: string
  updatedAt: string
}

export interface IListAnnouncementsQuery {
  page?: number
  pageSize?: number
  /** Matches the title. */
  keyword?: string
  status?: AnnouncementStatus
  audience?: AnnouncementAudience
}

export interface IAnnouncementBody {
  title: string
  body: string
  level: AnnouncementLevel
  audience: AnnouncementAudience
  /** ISO 8601 in the future; `null` (updates only) removes it. */
  expiresAt?: string | null
}

export interface ICreateAnnouncementBody extends IAnnouncementBody {
  /** Publish right away instead of saving a draft. */
  publish?: boolean
  /** Publish at this time instead (ISO 8601, in the future and before `expiresAt`); not with `publish`. */
  publishAt?: string
}

const ANNOUNCEMENTS_KEY = ['announcements'] as const

// Transport layer (permissions: `announcement:read|manage`)
export function fetchAnnouncements(query: IListAnnouncementsQuery = {}) {
  return apiFetch<IPaginated<IAnnouncement>>('/announcements', { method: 'get', query: compactQuery(query) })
}

/** 400 `ANNOUNCEMENT_EXPIRY_INVALID` for an expiry in the past, `ANNOUNCEMENT_SCHEDULE_INVALID` for a bad `publishAt`. */
export function createAnnouncement(body: ICreateAnnouncementBody) {
  return apiFetch<IAnnouncement>('/announcements', { method: 'post', body })
}

export function updateAnnouncement(id: string, body: Partial<IAnnouncementBody>) {
  return apiFetch<IAnnouncement>(`/announcements/${id}`, { method: 'patch', body })
}

/**
 * Now (no-op when already published) or, with `publishAt`, (re)scheduled. 400 `ANNOUNCEMENT_EXPIRY_INVALID`
 * once it has expired, `ANNOUNCEMENT_SCHEDULE_INVALID` for a time in the past or not before the expiry.
 */
export function publishAnnouncement({ id, publishAt }: { id: string, publishAt?: string }) {
  return apiFetch<IAnnouncement>(`/announcements/${id}/publish`, publishAt ? { method: 'post', body: { publishAt } } : { method: 'post' })
}

/** Back to a draft, hidden from the audience (also a scheduled one). */
export function withdrawAnnouncement(id: string) {
  return apiFetch<IAnnouncement>(`/announcements/${id}/withdraw`, { method: 'post' })
}

export function deleteAnnouncement(id: string) {
  return apiFetch<void>(`/announcements/${id}`, { method: 'delete' })
}

// Query/mutation hooks
export function useAnnouncementsQuery(query: MaybeRefOrGetter<IListAnnouncementsQuery>) {
  const params = computed(() => compactQuery(toValue(query)))
  return useQuery({
    queryKey: [...ANNOUNCEMENTS_KEY, params],
    queryFn: () => fetchAnnouncements(params.value),
    placeholderData: keepPreviousData,
    staleTime: 0,
  })
}

/** Changes refresh the list and this admin's own inbox (admin-audience announcements show up there too). */
function useAnnouncementMutation<TVariables, TData>(key: string, mutationFn: (variables: TVariables) => Promise<TData>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationKey: [key],
    mutationFn,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ANNOUNCEMENTS_KEY })
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY })
    },
  })
}

export function useCreateAnnouncementMutation() {
  return useAnnouncementMutation('createAnnouncement', createAnnouncement)
}

export function useUpdateAnnouncementMutation() {
  return useAnnouncementMutation('updateAnnouncement', ({ id, ...body }: Partial<IAnnouncementBody> & { id: string }) =>
    updateAnnouncement(id, body))
}

export function usePublishAnnouncementMutation() {
  return useAnnouncementMutation('publishAnnouncement', publishAnnouncement)
}

export function useWithdrawAnnouncementMutation() {
  return useAnnouncementMutation('withdrawAnnouncement', withdrawAnnouncement)
}

export function useDeleteAnnouncementMutation() {
  return useAnnouncementMutation('deleteAnnouncement', deleteAnnouncement)
}
