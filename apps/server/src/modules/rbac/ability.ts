import {
  AbilityBuilder,
  createMongoAbility,
  subject,
  type ForcedSubject,
  type MongoAbility,
} from '@casl/ability';
import {
  isPermission,
  parsePermission,
  type Action,
  type SubjectName,
} from './permissions.js';

/** Instance shapes used in conditions; tag rows with `asSubject()` before checking them. */
interface UserSubject extends ForcedSubject<'User'> {
  id: string;
}
interface KnowledgeBaseSubject extends ForcedSubject<'KnowledgeBase'> {
  ownerId: string;
}

export type AppSubject =
  | SubjectName
  | UserSubject
  | KnowledgeBaseSubject
  | ForcedSubject<'Role'>
  | ForcedSubject<'EmbeddingModel'>;
export type AppAbility = MongoAbility<[Action, AppSubject]>;

export interface AbilityUser {
  id: string;
  permissions: readonly string[];
}

/** Builds the CASL ability for a user from role permissions plus built-in ownership rules. */
export function defineAbilityFor(user: AbilityUser): AppAbility {
  const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

  // Ownership rules: every signed-in user may view/edit their own profile and own knowledge bases.
  can(['read', 'update'], 'User', { id: user.id });
  can(['read', 'update', 'delete'], 'KnowledgeBase', { ownerId: user.id });

  for (const permission of user.permissions) {
    if (isPermission(permission)) {
      const { action, subject: subjectType } = parsePermission(permission);
      can(action, subjectType);
    }
  }
  return build();
}

/**
 * True when the user holds the permission for *every* record of the subject type (a rule without
 * conditions). Plain `ability.can('read', 'User')` is also true for conditional rules such as
 * "own profile", which is not what type-level route guards want.
 */
export function canAny(
  ability: AppAbility,
  action: Action,
  subjectType: SubjectName,
): boolean {
  const rule = ability
    .rulesFor(action, subjectType)
    .find((candidate) => !candidate.conditions);
  return Boolean(rule && !rule.inverted);
}

/** Tags a database row with its CASL subject type for instance-level checks. */
export function asSubject<
  S extends Exclude<SubjectName, 'all'>,
  T extends object,
>(type: S, row: T) {
  return subject(type, row);
}
