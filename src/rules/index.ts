import type { RuleModule } from '../engine/types';
import { secretsHistoryRule } from './secrets-history';

export const ruleRegistry: RuleModule[] = [secretsHistoryRule];
