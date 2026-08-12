import type { RuleModule } from '../engine/types';
import { secretsRule } from './secrets';
import { sqlInjectionRule } from './sql-injection';
import { missingAuthRule } from './missing-auth';

export const ruleRegistry: RuleModule[] = [secretsRule, sqlInjectionRule, missingAuthRule];
