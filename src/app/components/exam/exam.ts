import { Component, signal, computed, inject, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { ExamService } from '../../services/exam.service';
import { AnswerLabel, DOMAIN_NAMES, DOMAIN_COLORS, Domain } from '../../models/question.model';

@Component({
  selector: 'app-exam',
  standalone: true,
  imports: [],
  templateUrl: './exam.html',
})
export class ExamComponent implements OnInit, OnDestroy {
  protected exam = inject(ExamService);
  private router = inject(Router);

  readonly DOMAIN_NAMES = DOMAIN_NAMES;
  readonly DOMAIN_COLORS = DOMAIN_COLORS;

  // ── Timer ──────────────────────────────────────────────────
  elapsedSeconds = signal(0);
  private timerRef: ReturnType<typeof setInterval> | null = null;

  // ── UI state ───────────────────────────────────────────────
  showConfirm = signal(false);
  sidebarOpen = signal(false);
  selectedOption = computed(() => {
    const q = this.exam.currentQuestion();
    return q ? (this.exam.answers()[q.id] ?? null) : null;
  });

  // ── Derived ────────────────────────────────────────────────
  questions = computed(() => this.exam.session()?.questions ?? []);
  total = computed(() => this.questions().length);
  current = computed(() => this.exam.currentQuestion());
  index = computed(() => this.exam.currentIndex());
  answered = computed(() => this.exam.answeredCount());
  progress = computed(() => this.exam.progress());
  flagged = computed(() => this.exam.flagged());
  timeLimit = computed(() => this.exam.session()?.config.timeLimitMinutes ?? null);

  timerDisplay = computed(() => {
    const limit = this.timeLimit();
    if (limit !== null) {
      const remaining = limit * 60 - this.elapsedSeconds();
      if (remaining <= 0) return '00:00';
      const m = Math.floor(remaining / 60);
      const s = remaining % 60;
      return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    const e = this.elapsedSeconds();
    const m = Math.floor(e / 60);
    const s = e % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  });

  timerWarning = computed(() => {
    const limit = this.timeLimit();
    if (!limit) return false;
    return limit * 60 - this.elapsedSeconds() < 300; // <5 min
  });

  navButtonState(i: number): 'current' | 'answered' | 'flagged' | '' {
    const q = this.questions()[i];
    if (!q) return '';
    const isCurrent = i === this.index();
    const isAnswered = this.exam.answers()[q.id] !== null;
    const isFlagged = this.flagged().has(q.id);
    if (isCurrent) return 'current';
    if (isFlagged && isAnswered) return 'flagged';
    if (isFlagged) return 'flagged';
    if (isAnswered) return 'answered';
    return '';
  }

  ngOnInit(): void {
    if (!this.exam.session()) {
      this.router.navigate(['/']);
      return;
    }
    this.timerRef = setInterval(() => {
      this.elapsedSeconds.update(s => s + 1);
      const limit = this.timeLimit();
      if (limit !== null && this.elapsedSeconds() >= limit * 60) {
        this.submit();
      }
    }, 1000);
  }

  ngOnDestroy(): void {
    if (this.timerRef) clearInterval(this.timerRef);
  }

  select(label: AnswerLabel): void {
    const q = this.current();
    if (q) this.exam.setAnswer(q.id, label);
  }

  toggleFlag(): void {
    const q = this.current();
    if (q) this.exam.toggleFlag(q.id);
  }

  isFlagged(): boolean {
    const q = this.current();
    return q ? this.flagged().has(q.id) : false;
  }

  unansweredCount(): number {
    return this.total() - this.answered();
  }

  flaggedCount(): number {
    return this.flagged().size;
  }

  submit(): void {
    if (this.timerRef) clearInterval(this.timerRef);
    this.exam.submitExam();
    this.router.navigate(['/results']);
  }

  confirmSubmit(): void {
    this.showConfirm.set(true);
  }

  cancelSubmit(): void {
    this.showConfirm.set(false);
  }

  domainClass(domain: Domain): string {
    return 'bg-d' + domain;
  }
}
