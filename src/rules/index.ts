import type { RuleModule } from '../engine/types';
import { missingAuthRule } from './missing-auth';

export const ruleRegistry: RuleModule[] = [missingAuthRule];
import { sqlInjectionRule } from './sql-injection';

export const ruleRegistry: RuleModule[] = [sqlInjectionRule];
import { secretsRule } from './secrets';

export const ruleRegistry: RuleModule[] = [secretsRule];
