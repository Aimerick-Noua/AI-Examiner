import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class DvaContentService {
  private http = inject(HttpClient);
  private cached: string | null = null;

  async getContent(): Promise<string> {
    if (this.cached) return this.cached;
    // DVA.txt lives in public/aws prep/DVA/DVA.txt — served as static asset
    this.cached = await firstValueFrom(
      this.http.get('/aws%20prep/DVA/DVA.txt', { responseType: 'text' })
    );
    return this.cached!;
  }
}
