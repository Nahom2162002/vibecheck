import type { RuleModule } from '../engine/types';
import { corsRule } from './cors';
import { secretsHistoryRule } from './secrets-history';
import { rateLimitingRule } from './rate-limiting';
import { clientSideValidationRule } from './client-side-validation';
import { idorRule } from './idor';

export const ruleRegistry: RuleModule[] = [
  corsRule,
  secretsHistoryRule,
  rateLimitingRule,
  clientSideValidationRule,
  idorRule,
];
