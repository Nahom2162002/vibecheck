import type { RuleModule } from '../engine/types';
import { secretsRule } from './secrets';

export const ruleRegistry: RuleModule[] = [secretsRule];
