import type { RuleModule } from '../engine/types';
import { corsRule } from './cors';

export const ruleRegistry: RuleModule[] = [corsRule];
import { secretsHistoryRule } from './secrets-history';

export const ruleRegistry: RuleModule[] = [secretsHistoryRule];
import { rateLimitingRule } from './rate-limiting';

export const ruleRegistry: RuleModule[] = [rateLimitingRule];
import { clientSideValidationRule } from './client-side-validation';

export const ruleRegistry: RuleModule[] = [clientSideValidationRule];
import { idorRule } from './idor';

export const ruleRegistry: RuleModule[] = [idorRule];
