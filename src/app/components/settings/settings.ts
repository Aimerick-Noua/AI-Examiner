import { Component, signal, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { GeminiService } from '../../services/gemini.service';
import { ExamService } from '../../services/exam.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './settings.html',
})
export class SettingsComponent {
  private gemini = inject(GeminiService);
  private examService = inject(ExamService);

  geminiKey  = signal(this.gemini.getApiKey());
  groqKey    = signal(this.gemini.getGroqKey());
  savedWhich = signal<'gemini' | 'groq' | null>(null);
  confirmClear = signal(false);

  saveGemini(): void {
    this.gemini.saveApiKey(this.geminiKey());
    this.flash('gemini');
  }

  saveGroq(): void {
    this.gemini.saveGroqKey(this.groqKey());
    this.flash('groq');
  }

  private flash(which: 'gemini' | 'groq'): void {
    this.savedWhich.set(which);
    setTimeout(() => this.savedWhich.set(null), 2500);
  }

  clearHistory(): void {
    if (this.confirmClear()) {
      this.examService.clearHistory();
      this.confirmClear.set(false);
    } else {
      this.confirmClear.set(true);
      setTimeout(() => this.confirmClear.set(false), 4000);
    }
  }

  resultCount(): number { return this.examService.results().length; }

  hasGemini(): boolean { return this.gemini.hasApiKey(); }
  hasGroq(): boolean   { return this.gemini.hasGroqKey(); }
}
