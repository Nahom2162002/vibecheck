export type Severity = 'critical' | 'high' | 'medium' | 'low';

export interface Finding {
  ruleId: string;
  severity: Severity;
  file: string;
  line: number;
  description: string;
  fix: string;
}

export interface RuleModule {
  id: string;
  description: string;
  check(repoPath: string, files: string[]): Finding[] | Promise<Finding[]>;
}
