import { Component, signal, inject, computed, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ExamService } from '../../services/exam.service';
import { ExamResult, Question, UserAnswer, DOMAIN_NAMES, DOMAIN_COLORS, Domain, AnswerLabel } from '../../models/question.model';

@Component({
  selector: 'app-results',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './results.html',
})
export class ResultsComponent implements OnInit {
  private examService = inject(ExamService);
  private router = inject(Router);

  readonly DOMAIN_NAMES = DOMAIN_NAMES;
  readonly DOMAIN_COLORS = DOMAIN_COLORS;
  readonly domains: Domain[] = [1, 2, 3, 4];

  result = signal<ExamResult | null>(null);
  expandedQuestions = signal<Set<string>>(new Set());
  filterDomain = signal<Domain | 'all' | 'wrong'>('wrong');

  ngOnInit(): void {
    const r = this.examService.lastResult();
    if (!r) { this.router.navigate(['/']); return; }
    this.result.set(r);
  }

  // ── Derived display helpers ───────────────────────────────
  score = computed(() => this.result()?.score ?? 0);
  passed = computed(() => this.result()?.passed ?? false);
  totalQ = computed(() => this.result()?.questions.length ?? 0);
  correctQ = computed(() => {
    const r = this.result();
    if (!r) return 0;
    return r.answers.filter(ua => {
      const q = r.questions.find(q => q.id === ua.questionId)!;
      return ua.selected === q.correctAnswer;
    }).length;
  });

  // SVG score ring
  ringStroke = computed(() => {
    const score = this.score();
    const circumference = 2 * Math.PI * 54;
    return circumference - (score / 100) * circumference;
  });
  ringColor = computed(() => this.passed() ? 'var(--success)' : 'var(--danger)');

  // Domain results (only those with questions)
  activeDomainResults = computed(() =>
    this.result()?.domainResults.filter(dr => dr.total > 0) ?? []
  );

  // Filtered questions for review
  filteredQuestions = computed(() => {
    const r = this.result();
    if (!r) return [];
    const filter = this.filterDomain();

    return r.questions.filter(q => {
      if (filter === 'all') return true;
      if (filter === 'wrong') {
        const ua = r.answers.find(a => a.questionId === q.id);
        return ua?.selected !== q.correctAnswer;
      }
      return q.domain === filter;
    });
  });

  wrongCount = computed(() => {
    const r = this.result();
    if (!r) return 0;
    return r.answers.filter(ua => {
      const q = r.questions.find(q => q.id === ua.questionId)!;
      return ua?.selected !== q.correctAnswer;
    }).length;
  });

  getAnswer(questionId: string): UserAnswer | undefined {
    return this.result()?.answers.find(a => a.questionId === questionId);
  }

  isCorrect(q: Question): boolean {
    const ua = this.getAnswer(q.id);
    return ua?.selected === q.correctAnswer;
  }

  userSelected(q: Question): AnswerLabel | null {
    return this.getAnswer(q.id)?.selected ?? null;
  }

  optionClass(q: Question, label: AnswerLabel): string {
    const selected = this.userSelected(q);
    if (label === q.correctAnswer) return 'correct';
    if (label === selected && selected !== q.correctAnswer) return 'wrong';
    return 'disabled';
  }

  toggleQuestion(id: string): void {
    this.expandedQuestions.update(s => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  isExpanded(id: string): boolean {
    return this.expandedQuestions().has(id);
  }

  formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  }

  domainBarWidth(pct: number): number { return Math.max(2, pct); }

  difficultyLabel(diff: string): string {
    return { foundational: 'Foundational', associate: 'Associate', advanced: 'Advanced', all: 'Mixed' }[diff] ?? diff;
  }

  wrongAnswerExplanation(q: Question): string | undefined {
    const selected = this.userSelected(q);
    if (!selected || selected === q.correctAnswer) return undefined;
    return q.wrongAnswerExplanations[selected];
  }
}
