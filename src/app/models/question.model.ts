export type Domain = 1 | 2 | 3 | 4;
export type Difficulty = 'foundational' | 'associate' | 'advanced';
export type AnswerLabel = 'A' | 'B' | 'C' | 'D';

export const DOMAIN_NAMES: Record<Domain, string> = {
  1: 'Development with AWS Services',
  2: 'Security',
  3: 'Deployment',
  4: 'Troubleshooting & Optimization',
};

export const DOMAIN_WEIGHTS: Record<Domain, number> = {
  1: 32,
  2: 26,
  3: 24,
  4: 18,
};

export const DOMAIN_COLORS: Record<Domain, string> = {
  1: '#3B82F6',
  2: '#EF4444',
  3: '#8B5CF6',
  4: '#22C55E',
};

export interface Option {
  label: AnswerLabel;
  text: string;
}

export interface Question {
  id: string;
  domain: Domain;
  service: string;
  tags: string[];
  difficulty: Difficulty;
  scenario: string;
  question: string;
  options: Option[];
  correctAnswer: AnswerLabel;
  explanation: string;
  wrongAnswerExplanations: Partial<Record<AnswerLabel, string>>;
  awsTip?: string;
}

export interface ExamConfig {
  difficulty: 'all' | Difficulty;
  questionCount: number;
  domains: Domain[] | 'all';
  timeLimitMinutes: number | null;
}

export interface UserAnswer {
  questionId: string;
  selected: AnswerLabel | null;
  flagged: boolean;
}

export interface DomainResult {
  domain: Domain;
  total: number;
  correct: number;
  percentage: number;
  weakTopics: string[];
}

export interface ExamResult {
  id: string;
  date: string;
  config: ExamConfig;
  questions: Question[];
  answers: UserAnswer[];
  score: number;
  passed: boolean;
  timeTakenSeconds: number;
  domainResults: DomainResult[];
  patterns: string[];
}
