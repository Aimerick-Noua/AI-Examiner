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
  selectedService?: string;
}

export interface AwsService {
  name: string;
  short: string;
  category: string;
  domain: Domain;
}

export const DVA_SERVICES: AwsService[] = [
  // Analytics
  { name: 'Amazon Athena',            short: 'Athena',          category: 'Analytics',        domain: 4 },
  { name: 'Amazon Kinesis',           short: 'Kinesis',         category: 'Analytics',        domain: 1 },
  { name: 'Amazon OpenSearch Service',short: 'OpenSearch',      category: 'Analytics',        domain: 4 },
  // Application Integration
  { name: 'AWS AppSync',              short: 'AppSync',         category: 'App Integration',  domain: 1 },
  { name: 'Amazon EventBridge',       short: 'EventBridge',     category: 'App Integration',  domain: 1 },
  { name: 'Amazon SNS',               short: 'SNS',             category: 'App Integration',  domain: 1 },
  { name: 'Amazon SQS',               short: 'SQS',             category: 'App Integration',  domain: 1 },
  { name: 'AWS Step Functions',       short: 'Step Functions',  category: 'App Integration',  domain: 1 },
  // Compute
  { name: 'Amazon EC2',               short: 'EC2',             category: 'Compute',          domain: 1 },
  { name: 'AWS Elastic Beanstalk',    short: 'Elastic Beanstalk', category: 'Compute',        domain: 3 },
  { name: 'AWS Lambda',               short: 'Lambda',          category: 'Compute',          domain: 1 },
  { name: 'AWS SAM',                  short: 'SAM',             category: 'Compute',          domain: 3 },
  // Containers
  { name: 'AWS Copilot',              short: 'Copilot',         category: 'Containers',       domain: 3 },
  { name: 'Amazon ECR',               short: 'ECR',             category: 'Containers',       domain: 3 },
  { name: 'Amazon ECS',               short: 'ECS',             category: 'Containers',       domain: 1 },
  { name: 'Amazon EKS',               short: 'EKS',             category: 'Containers',       domain: 1 },
  // Database
  { name: 'Amazon Aurora',            short: 'Aurora',          category: 'Database',         domain: 1 },
  { name: 'Amazon DynamoDB',          short: 'DynamoDB',        category: 'Database',         domain: 1 },
  { name: 'Amazon ElastiCache',       short: 'ElastiCache',     category: 'Database',         domain: 1 },
  { name: 'Amazon MemoryDB for Redis',short: 'MemoryDB',        category: 'Database',         domain: 1 },
  { name: 'Amazon RDS',               short: 'RDS',             category: 'Database',         domain: 1 },
  // Developer Tools
  { name: 'AWS Amplify',              short: 'Amplify',         category: 'Dev Tools',        domain: 3 },
  { name: 'AWS Cloud9',               short: 'Cloud9',          category: 'Dev Tools',        domain: 3 },
  { name: 'AWS CodeArtifact',         short: 'CodeArtifact',    category: 'Dev Tools',        domain: 3 },
  { name: 'AWS CodeBuild',            short: 'CodeBuild',       category: 'Dev Tools',        domain: 3 },
  { name: 'AWS CodeCommit',           short: 'CodeCommit',      category: 'Dev Tools',        domain: 3 },
  { name: 'AWS CodeDeploy',           short: 'CodeDeploy',      category: 'Dev Tools',        domain: 3 },
  { name: 'Amazon CodeGuru',          short: 'CodeGuru',        category: 'Dev Tools',        domain: 4 },
  { name: 'AWS CodePipeline',         short: 'CodePipeline',    category: 'Dev Tools',        domain: 3 },
  { name: 'AWS CodeStar',             short: 'CodeStar',        category: 'Dev Tools',        domain: 3 },
  { name: 'AWS X-Ray',                short: 'X-Ray',           category: 'Dev Tools',        domain: 4 },
  // Management & Governance
  { name: 'AWS AppConfig',            short: 'AppConfig',       category: 'Management',       domain: 3 },
  { name: 'AWS CDK',                  short: 'CDK',             category: 'Management',       domain: 3 },
  { name: 'AWS CloudFormation',       short: 'CloudFormation',  category: 'Management',       domain: 3 },
  { name: 'AWS CloudTrail',           short: 'CloudTrail',      category: 'Management',       domain: 4 },
  { name: 'Amazon CloudWatch',        short: 'CloudWatch',      category: 'Management',       domain: 4 },
  { name: 'Amazon CloudWatch Logs',   short: 'CW Logs',         category: 'Management',       domain: 4 },
  { name: 'AWS Systems Manager',      short: 'Systems Manager', category: 'Management',       domain: 2 },
  // Networking
  { name: 'Amazon API Gateway',       short: 'API Gateway',     category: 'Networking',       domain: 1 },
  { name: 'Amazon CloudFront',        short: 'CloudFront',      category: 'Networking',       domain: 4 },
  { name: 'Elastic Load Balancing',   short: 'ELB',             category: 'Networking',       domain: 4 },
  { name: 'Amazon Route 53',          short: 'Route 53',        category: 'Networking',       domain: 4 },
  { name: 'Amazon VPC',               short: 'VPC',             category: 'Networking',       domain: 2 },
  // Security
  { name: 'AWS Certificate Manager',  short: 'ACM',             category: 'Security',         domain: 2 },
  { name: 'Amazon Cognito',           short: 'Cognito',         category: 'Security',         domain: 2 },
  { name: 'AWS IAM',                  short: 'IAM',             category: 'Security',         domain: 2 },
  { name: 'AWS KMS',                  short: 'KMS',             category: 'Security',         domain: 2 },
  { name: 'AWS Secrets Manager',      short: 'Secrets Manager', category: 'Security',         domain: 2 },
  { name: 'AWS STS',                  short: 'STS',             category: 'Security',         domain: 2 },
  { name: 'AWS WAF',                  short: 'WAF',             category: 'Security',         domain: 2 },
  // Storage
  { name: 'Amazon S3',                short: 'S3',              category: 'Storage',          domain: 1 },
];

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
