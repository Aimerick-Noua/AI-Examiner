import { Injectable, signal, computed } from '@angular/core';
import { Question, ExamConfig, ExamResult, UserAnswer, DomainResult, Domain, AnswerLabel, DOMAIN_NAMES } from '../models/question.model';

const RESULTS_KEY = 'aws_examiner_results';

export interface ExamSession {
  questions: Question[];
  config: ExamConfig;
}

@Injectable({ providedIn: 'root' })
export class ExamService {
  // ── Session state ──────────────────────────────────────────────
  session = signal<ExamSession | null>(null);
  currentIndex = signal(0);
  answers = signal<Record<string, AnswerLabel | null>>({});
  flagged = signal<Set<string>>(new Set());
  startTime = signal<Date | null>(null);

  // ── Last result (for results page) ────────────────────────────
  lastResult = signal<ExamResult | null>(null);

  // ── History ───────────────────────────────────────────────────
  results = signal<ExamResult[]>(this.loadResults());

  // ── Computed ──────────────────────────────────────────────────
  currentQuestion = computed(() => {
    const s = this.session();
    return s ? s.questions[this.currentIndex()] : null;
  });

  answeredCount = computed(() =>
    Object.values(this.answers()).filter(v => v !== null).length
  );

  progress = computed(() => {
    const s = this.session();
    if (!s || s.questions.length === 0) return 0;
    return Math.round((this.answeredCount() / s.questions.length) * 100);
  });

  // ── Actions ───────────────────────────────────────────────────
  startExam(questions: Question[], config: ExamConfig): void {
    const initialAnswers: Record<string, AnswerLabel | null> = {};
    questions.forEach(q => (initialAnswers[q.id] = null));
    this.session.set({ questions, config });
    this.currentIndex.set(0);
    this.answers.set(initialAnswers);
    this.flagged.set(new Set());
    this.startTime.set(new Date());
    this.lastResult.set(null);
  }

  setAnswer(questionId: string, answer: AnswerLabel): void {
    this.answers.update(a => ({ ...a, [questionId]: answer }));
  }

  toggleFlag(questionId: string): void {
    this.flagged.update(f => {
      const next = new Set(f);
      next.has(questionId) ? next.delete(questionId) : next.add(questionId);
      return next;
    });
  }

  next(): void {
    const s = this.session();
    if (!s) return;
    this.currentIndex.update(i => Math.min(i + 1, s.questions.length - 1));
  }

  prev(): void {
    this.currentIndex.update(i => Math.max(i - 1, 0));
  }

  goTo(index: number): void {
    const s = this.session();
    if (!s) return;
    this.currentIndex.set(Math.max(0, Math.min(index, s.questions.length - 1)));
  }

  submitExam(): ExamResult {
    const session = this.session()!;
    const answers = this.answers();
    const flaggedSet = this.flagged();
    const start = this.startTime()!;
    const timeTakenSeconds = Math.floor((Date.now() - start.getTime()) / 1000);

    const userAnswers: UserAnswer[] = session.questions.map(q => ({
      questionId: q.id,
      selected: answers[q.id] ?? null,
      flagged: flaggedSet.has(q.id),
    }));

    const correctCount = userAnswers.filter(ua => {
      const q = session.questions.find(q => q.id === ua.questionId)!;
      return ua.selected === q.correctAnswer;
    }).length;

    const score = Math.round((correctCount / session.questions.length) * 100);
    const passed = score >= 72;

    const domainResults: DomainResult[] = ([1, 2, 3, 4] as Domain[]).map(domain => {
      const dqs = session.questions.filter(q => q.domain === domain);
      if (dqs.length === 0) return { domain, total: 0, correct: 0, percentage: 0, weakTopics: [] };
      const dc = dqs.filter(q => userAnswers.find(ua => ua.questionId === q.id)?.selected === q.correctAnswer).length;
      return {
        domain,
        total: dqs.length,
        correct: dc,
        percentage: Math.round((dc / dqs.length) * 100),
        weakTopics: this.findWeakTopics(dqs, userAnswers),
      };
    });

    const result: ExamResult = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      config: session.config,
      questions: session.questions,
      answers: userAnswers,
      score,
      passed,
      timeTakenSeconds,
      domainResults,
      patterns: this.detectPatterns(session.questions, userAnswers),
    };

    this.lastResult.set(result);
    this.results.update(r => [result, ...r].slice(0, 20));
    this.persist();
    return result;
  }

  clearHistory(): void {
    this.results.set([]);
    localStorage.removeItem(RESULTS_KEY);
  }

  // ── Private helpers ───────────────────────────────────────────
  private findWeakTopics(questions: Question[], userAnswers: UserAnswer[]): string[] {
    const tagStats: Record<string, { wrong: number; total: number }> = {};
    questions.forEach(q => {
      const ua = userAnswers.find(ua => ua.questionId === q.id);
      const isWrong = ua?.selected !== q.correctAnswer;
      q.tags.forEach(tag => {
        if (!tagStats[tag]) tagStats[tag] = { wrong: 0, total: 0 };
        tagStats[tag].total++;
        if (isWrong) tagStats[tag].wrong++;
      });
    });
    return Object.entries(tagStats)
      .filter(([, { wrong, total }]) => total >= 1 && wrong / total >= 0.5)
      .sort((a, b) => b[1].wrong - a[1].wrong)
      .slice(0, 4)
      .map(([tag]) => tag);
  }

  private detectPatterns(questions: Question[], userAnswers: UserAnswer[]): string[] {
    const patterns: string[] = [];
    const byService: Record<string, { wrong: number; total: number }> = {};

    questions.forEach(q => {
      if (!byService[q.service]) byService[q.service] = { wrong: 0, total: 0 };
      byService[q.service].total++;
      const ua = userAnswers.find(ua => ua.questionId === q.id);
      if (ua?.selected !== q.correctAnswer) byService[q.service].wrong++;
    });

    Object.entries(byService)
      .filter(([, { wrong, total }]) => total >= 2 && wrong / total >= 0.6)
      .sort((a, b) => b[1].wrong - a[1].wrong)
      .forEach(([service, { wrong, total }]) => {
        patterns.push(`You missed ${wrong}/${total} ${service} questions — this service needs dedicated review before your exam.`);
      });

    const unanswered = userAnswers.filter(ua => ua.selected === null).length;
    if (unanswered > 0) patterns.push(`${unanswered} question(s) left unanswered — with 24 days left, focus on time management during practice.`);

    const weakDomains = ([1, 2, 3, 4] as Domain[])
      .map(d => {
        const dqs = questions.filter(q => q.domain === d);
        if (dqs.length === 0) return null;
        const dc = dqs.filter(q => userAnswers.find(ua => ua.questionId === q.id)?.selected === q.correctAnswer).length;
        return { domain: d, pct: Math.round((dc / dqs.length) * 100) };
      })
      .filter(x => x !== null && x!.pct < 60);

    weakDomains.forEach(x => {
      patterns.push(`Domain ${x!.domain} (${DOMAIN_NAMES[x!.domain]}) is below 60% — weight: ${[32, 26, 24, 18][x!.domain - 1]}% of the real exam. High priority!`);
    });

    return patterns;
  }

  private persist(): void {
    try {
      // Store without full question text to save space — keep last 20
      localStorage.setItem(RESULTS_KEY, JSON.stringify(this.results().slice(0, 20)));
    } catch { /* quota exceeded — ignore */ }
  }

  private loadResults(): ExamResult[] {
    try {
      const raw = localStorage.getItem(RESULTS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }
}
