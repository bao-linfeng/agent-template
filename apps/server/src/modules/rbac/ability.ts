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

/** Subject types, or rows tagged with `asSubject()` when a rule needs conditions. */
export type AppSubject =
  SubjectName | ForcedSubject<Exclude<SubjectName, 'all'>>;
export type AppAbility = MongoAbility<[Action, AppSubject]>;

export interface AbilityAdmin {
  id: string;
  permissions: readonly string[];
}

/**
 * Builds the CASL ability of an admin account from its role permissions. Record-level rules (e.g.
 * "only records the admin created") can be added here with conditions and checked with
 * `assertCan(ability, action, asSubject(type, row))`.
 */
export function defineAbilityFor(admin: AbilityAdmin): AppAbility {
  const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);
  for (const permission of admin.permissions) {
    if (isPermission(permission)) {
      const { action, subject: subjectType } = parsePermission(permission);
      can(action, subjectType);
    }
  }
  return build();
}

/**
 * True when the admin holds the permission for *every* record of the subject type (a rule without
 * conditions). Plain `ability.can(action, type)` is also true for conditional rules, which is not
 * what type-level route guards want.
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
