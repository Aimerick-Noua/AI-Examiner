import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Question, ExamConfig, Domain, DOMAIN_NAMES } from '../models/question.model';
import { DvaContentService } from './dva-content.service';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const GROQ_URL    = 'https://api.groq.com/openai/v1/chat/completions';

const GEMINI_MODELS = [
  `${GEMINI_BASE}/gemini-2.5-flash:generateContent`,
  `${GEMINI_BASE}/gemini-2.0-flash:generateContent`,
  `${GEMINI_BASE}/gemini-2.0-flash-lite:generateContent`,
] as const;

const GROQ_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
] as const;

const GEMINI_KEY_STORAGE = 'aws_examiner_gemini_key';
const GROQ_KEY_STORAGE   = 'aws_examiner_groq_key';

// Groq's HTTP gateway rejects bodies > ~32KB. DVA.txt is ~28K chars so we
// trim the study material to leave room for the prompt template overhead.
const GROQ_MAX_DVA_CHARS = 12_000;

@Injectable({ providedIn: 'root' })
export class GeminiService {
  private http = inject(HttpClient);
  private dvaContent = inject(DvaContentService);

  loading      = signal(false);
  loadingStatus = signal('');
  error        = signal<string | null>(null);
  lastProvider = signal<string | null>(null);

  // ── Key management ────────────────────────────────────────────
  getApiKey(): string    { return localStorage.getItem(GEMINI_KEY_STORAGE) ?? ''; }
  saveApiKey(k: string)  { localStorage.setItem(GEMINI_KEY_STORAGE, k.trim()); }
  hasApiKey(): boolean   { return !!this.getApiKey(); }

  getGroqKey(): string   { return localStorage.getItem(GROQ_KEY_STORAGE) ?? ''; }
  saveGroqKey(k: string) { localStorage.setItem(GROQ_KEY_STORAGE, k.trim()); }
  hasGroqKey(): boolean  { return !!this.getGroqKey(); }

  hasAnyKey(): boolean   { return this.hasApiKey() || this.hasGroqKey(); }

  // ── Main entry point ─────────────────────────────────────────
  async generateQuestions(config: ExamConfig): Promise<Question[]> {
    if (!this.hasAnyKey()) {
      throw new Error('No API key configured. Add a Gemini or Groq key in Settings.');
    }
    this.loading.set(true);
    this.error.set(null);
    try {
      this.loadingStatus.set('Reading your DVA study material…');
      const dvaText  = await this.dvaContent.getContent();
      const fullPrompt = this.buildPrompt(config, dvaText);
      // Groq's gateway rejects large HTTP bodies — trim DVA content for Groq calls
      const groqPrompt = this.buildPrompt(config, dvaText.slice(0, GROQ_MAX_DVA_CHARS));
      const result = await this.tryGeminiWaterfall(fullPrompt) ?? await this.tryGroqWaterfall(groqPrompt);
      if (!result) throw new Error('All AI providers exhausted. Check your API keys and try again.');
      return result;
    } finally {
      this.loading.set(false);
      this.loadingStatus.set('');
    }
  }

  // ── Gemini waterfall ──────────────────────────────────────────
  private async tryGeminiWaterfall(prompt: string): Promise<Question[] | null> {
    if (!this.hasApiKey()) return null;
    for (const url of GEMINI_MODELS) {
      const name = url.match(/models\/([^:]+)/)?.[1] ?? url;
      this.loadingStatus.set(`Trying ${name}…`);
      const result = await this.attempt(() => this.callGemini(url, prompt), `[Gemini] ${name}`);
      if (result) { this.lastProvider.set(name); return result; }
    }
    console.warn('[Gemini] All models exhausted.');
    return null;
  }

  // ── Groq waterfall ────────────────────────────────────────────
  private async tryGroqWaterfall(groqPrompt: string): Promise<Question[] | null> {
    if (!this.hasGroqKey()) return null;
    for (const model of GROQ_MODELS) {
      this.loadingStatus.set(`Falling back to Groq (${model})…`);
      const result = await this.attempt(() => this.callGroq(model, groqPrompt), `[Groq] ${model}`);
      if (result) { this.lastProvider.set(`groq/${model}`); return result; }
    }
    return null;
  }

  /** Run fn — return its result on success, null on transient error, rethrow on auth errors. */
  private async attempt(fn: () => Promise<Question[]>, label: string): Promise<Question[] | null> {
    try {
      return await fn();
    } catch (err: any) {
      const status: number | undefined = err?.status ?? err?.error?.status;
      const isTransient = !status || status === 404 || status === 413 || status === 429 || status >= 500;
      if (!isTransient) throw err;
      console.warn(`${label} failed (${status ?? 'network'}), trying next…`);
      return null;
    }
  }

  // ── Gemini call ───────────────────────────────────────────────
  private async callGemini(url: string, prompt: string): Promise<Question[]> {
    const response = await firstValueFrom(
      this.http.post<GeminiResponse>(
        `${url}?key=${this.getApiKey()}`,
        {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.8, maxOutputTokens: 8192 },
        }
      )
    );
    const raw = response.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    this.loadingStatus.set('Parsing questions…');
    const questions = this.parseQuestions(raw);
    if (questions.length === 0) throw new Error('Empty question list from Gemini.');
    return questions;
  }

  // ── Groq call ────────────────────────────────────────────────
  private async callGroq(model: string, prompt: string): Promise<Question[]> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.getGroqKey()}`,
      'Content-Type': 'application/json',
    });
    const response = await firstValueFrom(
      this.http.post<GroqResponse>(
        GROQ_URL,
        {
          model,
          messages: [
            { role: 'system', content: 'You are a strict AWS Developer Associate exam question generator. Return ONLY a raw JSON array — no markdown, no code fences.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.8,
          max_tokens: 8192,
        },
        { headers }
      )
    );
    const raw = response.choices?.[0]?.message?.content ?? '';
    this.loadingStatus.set('Parsing questions…');
    const questions = this.parseQuestions(raw);
    if (questions.length === 0) throw new Error(`Empty question list from Groq/${model}.`);
    return questions;
  }

  // ── Prompt ───────────────────────────────────────────────────
  private buildPrompt(config: ExamConfig, dvaText: string): string {
    const domains: Domain[] = config.domains === 'all' ? [1, 2, 3, 4] : config.domains;
    const domainList = domains.map(d => `Domain ${d}: ${DOMAIN_NAMES[d]}`).join('\n');
    const count = config.questionCount;
    const diff  = config.difficulty === 'all' ? 'mix of foundational, associate, and advanced' : config.difficulty;
    const svc   = config.selectedService;

    const serviceFocusBlock = svc ? `
⚠ SERVICE FOCUS MODE: Generate ALL ${count} questions EXCLUSIVELY about ${svc}.

UNIQUENESS IS MANDATORY — each question MUST test a completely different concept. Absolutely no repeated topics, scenarios, or question angles. Spread questions across ALL of these knowledge areas (use as many as needed to fill ${count} unique questions):
  1. Core concepts and architecture of ${svc}
  2. Configuration options, settings, and parameters
  3. Deployment and environment management
  4. Scaling, auto-scaling, and capacity behaviour
  5. Networking and VPC integration
  6. Security — IAM roles, resource policies, encryption
  7. Monitoring, logging, and observability (CloudWatch, X-Ray)
  8. Error handling, retry logic, and failure modes
  9. Integration with other AWS services (S3, RDS, SQS, etc.)
  10. CI/CD, deployment strategies (blue/green, canary, rolling)
  11. Limits, quotas, and service-specific constraints
  12. CLI/SDK usage patterns
  13. Cost and pricing model considerations
  14. Common exam traps and misconceptions specific to ${svc}
  15. Troubleshooting and debugging scenarios

- Use a DIFFERENT scenario company for EVERY question (e.g., Q1: FinTechCorp, Q2: HealthStartup, Q3: RetailGiant…)
- Vary the question verb: "MOST cost-effective", "MOST operationally efficient", "LEAST privilege", "FIRST step", etc.
- Do NOT generate two questions about the same sub-feature of ${svc}
- ${svc} must be the central subject of every question
` : '';

    const domainSection = svc ? '' : `
DOMAIN COVERAGE (proportional to real exam weights):
${domainList}

DOMAIN DEFINITIONS:
- Domain 1 – Development with AWS Services (32%): Lambda, DynamoDB, API Gateway, SQS, SNS, Kinesis, ElastiCache, S3, Step Functions, ECS, Cognito, SAM
- Domain 2 – Security (26%): IAM, KMS, SSM Parameter Store, Cognito auth, VPC, Security Groups, S3 encryption, STS, Secrets Manager
- Domain 3 – Deployment (24%): CodeCommit, CodeBuild, CodeDeploy, CodePipeline, Elastic Beanstalk, CloudFormation, SAM, CI/CD
- Domain 4 – Troubleshooting & Optimization (18%): CloudWatch, X-Ray, CloudTrail, error handling, exponential backoff, performance tuning
`;

    return `You are a strict AWS Developer Associate (DVA-C02) exam question generator. Your questions must be EXAM-QUALITY: tricky, scenario-based, with plausible distractors that test real understanding.
${serviceFocusBlock}
TASK: Generate exactly ${count} questions at difficulty: ${diff}.
${domainSection}
STRICT RULES:
1. Each question MUST use a real company scenario (e.g., "FinTechCorp, a startup processing 2M transactions/day…")
2. ALL ${count} questions must be UNIQUE — no repeated topics, angles, or scenarios
3. Make distractors PLAUSIBLE and TRICKY — wrong answers must look correct to someone who studied but not deeply enough. Exploit common misconceptions, confusable service behaviours, and subtle AWS gotchas
4. Test exam-trapping knowledge: default behaviours that surprise people, limits that matter, options that exist but don't solve the problem, and configurations that look right but break under the scenario's constraints
5. wrongAnswerExplanations must explain exactly WHY that option fails in this specific scenario (not just generic statements)
6. awsTip must be a sharp, memorable exam trick — something that lets a candidate distinguish the right answer under time pressure

DIFFICULTY GUIDE (${diff}):
- foundational: Direct service knowledge ("What does X do?")
- associate: Scenario where you must pick the RIGHT approach
- advanced: Complex trade-offs, multi-service solutions, subtle limits/quotas

OUTPUT: Return ONLY a raw JSON array. No markdown. No code fences. Start with [ and end with ].

JSON SCHEMA:
[{
  "id": "Q001",
  "domain": 1,
  "service": "${svc ?? 'Lambda'}",
  "tags": ["concurrency", "cold-start"],
  "difficulty": "associate",
  "scenario": "TechRetail, an e-commerce platform processing 100K orders/day...",
  "question": "What is the MOST effective solution to...",
  "options": [
    {"label":"A","text":"..."},
    {"label":"B","text":"..."},
    {"label":"C","text":"..."},
    {"label":"D","text":"..."}
  ],
  "correctAnswer": "B",
  "explanation": "Option B is correct because...",
  "wrongAnswerExplanations": {
    "A": "Incorrect because...",
    "C": "Incorrect because...",
    "D": "Incorrect because..."
  },
  "awsTip": "Key exam distinction: ..."
}]

--- AWS DVA-C02 STUDY MATERIAL ---
${dvaText}
--- END OF STUDY MATERIAL ---`;
  }

  // ── Parser (shared) ───────────────────────────────────────────
  private parseQuestions(raw: string): Question[] {
    const cleaned = raw.trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    const start = cleaned.indexOf('[');
    const end   = cleaned.lastIndexOf(']');
    if (start === -1 || end === -1) throw new Error('No JSON array found in AI response.');

    const parsed: any[] = JSON.parse(cleaned.slice(start, end + 1));

    return parsed
      .filter(q => q.id && q.question && Array.isArray(q.options) && q.correctAnswer)
      .map((q, i) => ({
        id: String(q.id ?? `Q${String(i + 1).padStart(3, '0')}`),
        domain: ([1, 2, 3, 4].includes(Number(q.domain)) ? Number(q.domain) : 1) as Domain,
        service: String(q.service ?? 'AWS'),
        tags: Array.isArray(q.tags) ? q.tags.map(String) : [],
        difficulty: (['foundational', 'associate', 'advanced'].includes(q.difficulty) ? q.difficulty : 'associate') as any,
        scenario: String(q.scenario ?? ''),
        question: String(q.question),
        options: q.options.slice(0, 4).map((o: any) => ({
          label: o.label,
          text: String(o.text),
        })),
        correctAnswer: String(q.correctAnswer).toUpperCase() as any,
        explanation: String(q.explanation ?? ''),
        wrongAnswerExplanations: q.wrongAnswerExplanations ?? {},
        awsTip: q.awsTip ? String(q.awsTip) : undefined,
      }));
  }
}

interface GeminiResponse {
  candidates: Array<{ content: { parts: Array<{ text: string }> } }>;
}
interface GroqResponse {
  choices: Array<{ message: { content: string } }>;
}
