import type { RuleModule } from '../engine/types';
import { secretsRule } from './secrets';
import { sqlInjectionRule } from './sql-injection';
import { missingAuthRule } from './missing-auth';
import { corsRule } from './cors';
import { secretsHistoryRule } from './secrets-history';
import { rateLimitingRule } from './rate-limiting';
import { clientSideValidationRule } from './client-side-validation';
import { idorRule } from './idor';

export const ruleRegistry: RuleModule[] = [
  secretsRule,
  sqlInjectionRule,
  missingAuthRule,
  corsRule,
  secretsHistoryRule,
  rateLimitingRule,
  clientSideValidationRule,
  idorRule,
];
