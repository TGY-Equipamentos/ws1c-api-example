import { Component, OnDestroy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Subscription, timer, of } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnDestroy {
  title = 'api-example';
  valueDisplay = '-';
  isPositive = false;
  private pollingSubscription?: Subscription;

  constructor(private http: HttpClient) {
    const endpoint = 'http://192.168.15.130/api/post-serial-data';
    const headers = new HttpHeaders({ Authorization: '12345678' });
    const body = { port: 1100, time: 500, command: '\u0005' };

    this.pollingSubscription = timer(0, 3000)
      .pipe(
        switchMap(() =>
          this.http.post(endpoint, body, {
            headers,
            responseType: 'text' as const,
          })
        ),
        catchError(() => {
          this.valueDisplay = '-';
          return of<string | null>(null);
        })
      )
      .subscribe((response: string | null) => {
        if (typeof response !== 'string') {
          this.valueDisplay = '-';
          this.isPositive = false;
          return;
        }
        const weightNumber = this.parseWeightNumber(response);
        if (weightNumber == null) {
          this.valueDisplay = '-';
          this.isPositive = false;
          return;
        }
        this.valueDisplay =
          weightNumber.toLocaleString('pt-BR', {
            minimumFractionDigits: 3,
            maximumFractionDigits: 3,
          }) + ' KG';
        this.isPositive = weightNumber > 0;
      });
  }

  ngOnDestroy(): void {
    this.pollingSubscription?.unsubscribe();
  }

  private parseWeightNumber(message: string): number | null {
    if (!message) {
      return null;
    }

    let raw = message;
    const trimmed = message.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const obj = JSON.parse(trimmed);
        const candidate =
          obj?.response ??
          obj?.value ??
          obj?.weight ??
          obj?.data ??
          obj?.peso ??
          obj?.valor;
        if (candidate != null) {
          raw = String(candidate);
        }
      } catch {
        // ignore JSON parse errors and fall back to raw string
      }
    }

    const withoutControlChars = raw.replace(/[\x00-\x1F\x7F]/g, ' ');
    const compacted = withoutControlChars.replace(/\s+/g, ' ').trim();
    const match = compacted.match(/(-?\d+)/);
    if (!match) {
      return null;
    }
    const grams = Number.parseInt(match[1], 10);
    if (Number.isNaN(grams)) {
      return null;
    }
    return grams / 1000;
  }
}
