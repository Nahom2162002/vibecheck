import type { RuleModule } from '../engine/types';
import { missingAuthRule } from './missing-auth';

export const ruleRegistry: RuleModule[] = [missingAuthRule];
