import { Component, signal, inject, computed } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { GeminiService } from '../../services/gemini.service';
import { ExamService } from '../../services/exam.service';
import { ExamConfig, Domain, DOMAIN_NAMES, DOMAIN_COLORS, ExamResult } from '../../models/question.model';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './home.html',
})
export class HomeComponent {
  private gemini = inject(GeminiService);
  private examService = inject(ExamService);
  private router = inject(Router);

  // ── Config form ──────────────────────────────────────────────
  difficulty = signal<'all' | 'foundational' | 'associate' | 'advanced'>('associate');
  questionCount = signal(20);
  selectedDomains = signal<Domain[] | 'all'>('all');
  timeLimitMinutes = signal<number | null>(null);
  domainMode = signal<'all' | 'custom'>('all');

  // ── UI state ──────────────────────────────────────────────────
  loading = this.gemini.loading;
  loadingStatus = this.gemini.loadingStatus;
  errorMsg = signal<string | null>(null);
  hasKey = computed(() => this.gemini.hasApiKey());

  // ── History ───────────────────────────────────────────────────
  results = this.examService.results;

  readonly DOMAIN_NAMES = DOMAIN_NAMES;
  readonly DOMAIN_COLORS = DOMAIN_COLORS;
  readonly domains: Domain[] = [1, 2, 3, 4];

  readonly difficultyOptions = [
    { value: 'foundational', label: 'Foundational', desc: 'Basic service knowledge — great to warm up' },
    { value: 'associate', label: 'Associate', desc: 'Scenario-based like the real exam — standard practice' },
    { value: 'advanced', label: 'Advanced', desc: 'Multi-service edge cases — harder than the real exam' },
    { value: 'all', label: 'Mixed', desc: 'All difficulties in one session' },
  ];

  readonly countOptions = [10, 20, 30, 65];

  readonly timeOptions: { label: string; value: number | null }[] = [
    { label: 'No limit', value: null },
    { label: '20 min', value: 20 },
    { label: '60 min', value: 60 },
    { label: '130 min (real exam)', value: 130 },
  ];

  toggleDomain(d: Domain): void {
    this.selectedDomains.update(cur => {
      const arr = Array.isArray(cur) ? cur : [1, 2, 3, 4];
      const exists = arr.includes(d);
      const next = exists ? arr.filter(x => x !== d) : [...arr, d];
      return next.length === 4 ? 'all' : next.length === 0 ? [d] : (next as Domain[]);
    });
  }

  isDomainSelected(d: Domain): boolean {
    const cur = this.selectedDomains();
    return cur === 'all' || (cur as Domain[]).includes(d);
  }

  setDomainMode(mode: 'all' | 'custom'): void {
    this.domainMode.set(mode);
    if (mode === 'all') this.selectedDomains.set('all');
    else this.selectedDomains.set([1, 2, 3, 4]);
  }

  async startExam(): Promise<void> {
    if (!this.hasKey()) {
      this.errorMsg.set('Add your Gemini API key in Settings first.');
      return;
    }
    this.errorMsg.set(null);

    const config: ExamConfig = {
      difficulty: this.difficulty(),
      questionCount: this.questionCount(),
      domains: this.selectedDomains(),
      timeLimitMinutes: this.timeLimitMinutes(),
    };

    try {
      const questions = await this.gemini.generateQuestions(config);
      this.examService.startExam(questions, config);
      this.router.navigate(['/exam']);
    } catch (err: any) {
      this.errorMsg.set(err?.message ?? 'Failed to generate questions. Check your API key and try again.');
    }
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  }

  domainColor(d: Domain): string { return DOMAIN_COLORS[d]; }

  viewResult(result: ExamResult): void {
    this.examService.lastResult.set(result);
    this.router.navigate(['/results']);
  }

  maxVal(a: number, b: number): number { return Math.max(a, b); }
}
