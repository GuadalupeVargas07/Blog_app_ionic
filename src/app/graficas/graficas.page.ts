import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';
import { ApiCacheService } from '../services/api-cache.service';
import { DiaryEntry, HmApiService, MoodEntry, SharedCapture } from '../services/hm-api.service';

interface DailyActivity {
  date: Date;
  label: string;
  diary: number;
  moods: number;
  captures: number;
}

interface ChartTick {
  x: number;
  label: string;
}

interface MoodSlice {
  name: string;
  count: number;
  percent: number;
  color: string;
  dashArray: string;
  dashOffset: number;
}

interface MusicItem {
  name: string;
  count: number;
  percent: number;
}

const CHART_WIDTH = 720;
const CHART_HEIGHT = 250;
const CHART_MARGIN = { top: 16, right: 16, bottom: 36, left: 48 };
const PLOT_WIDTH = CHART_WIDTH - CHART_MARGIN.left - CHART_MARGIN.right;
const PLOT_HEIGHT = CHART_HEIGHT - CHART_MARGIN.top - CHART_MARGIN.bottom;
const MOOD_COLORS = ['#8068d8', '#f1a76e', '#57a99a', '#db7293', '#6c91d1', '#c6a247'];

@Component({
  selector: 'app-graficas',
  templateUrl: './graficas.page.html',
  styleUrls: ['./graficas.page.scss'],
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, CommonModule],
})
export class GraficasPage implements OnInit {
  private readonly api = inject(HmApiService);
  private readonly apiCache = inject(ApiCacheService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly diaryEntries = signal<DiaryEntry[]>([]);
  readonly moodEntries = signal<MoodEntry[]>([]);
  readonly captures = signal<SharedCapture[]>([]);
  readonly usingCachedData = computed(() => this.apiCache.fallbackMessage());

  readonly dailyActivity = computed(() => this.buildDailyActivity());
  readonly areaPaths = computed(() => this.buildAreaPaths());
  readonly activityBars = computed(() => this.buildActivityBars());
  readonly chartTicks = computed(() => this.buildChartTicks());
  readonly yTicks = computed(() => this.buildYTicks());
  readonly totalRecords = computed(
    () => this.diaryEntries().length + this.moodEntries().length + this.captures().length,
  );
  readonly activeDays = computed(() => this.dailyActivity().filter((day) => this.dayTotal(day) > 0).length);
  readonly moodSlices = computed(() => this.buildMoodSlices());
  readonly musicItems = computed(() => this.buildMusicItems());

  async ngOnInit(): Promise<void> {
    await this.loadData();
  }

  async loadData(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    this.apiCache.clearFallback();

    let userId: number;
    try {
      const savedUser = localStorage.getItem('user');
      const user = savedUser ? JSON.parse(savedUser) as { id?: unknown } : null;
      userId = Number(user?.id);
      if (!Number.isInteger(userId) || userId <= 0) {
        this.error.set('Inicia sesión para consultar las gráficas de tu actividad.');
        this.loading.set(false);
        return;
      }
    } catch (error) {
      console.error('No se pudo leer el usuario guardado', error);
      this.error.set('No se pudo identificar la sesión. Vuelve a iniciar sesión.');
      this.loading.set(false);
      return;
    }

    try {
      const [diary, moods, captures] = await Promise.all([
        this.api.getDiary(userId),
        this.api.getMoods(userId),
        this.api.getCaptures(userId),
      ]);
      this.diaryEntries.set(diary);
      this.moodEntries.set(moods);
      this.captures.set(captures);
    } catch (error) {
      console.error('Error cargando datos para las gráficas', error);
      this.error.set('No se pudieron cargar las gráficas. Verifica la conexión con el servidor e inténtalo de nuevo.');
    } finally {
      this.loading.set(false);
    }
  }

  yPosition(value: number): number {
    const max = this.chartMax();
    return CHART_MARGIN.top + PLOT_HEIGHT - (value / max) * PLOT_HEIGHT;
  }

  barHeight(value: number): number {
    return CHART_MARGIN.top + PLOT_HEIGHT - this.yPosition(value);
  }

  dayTotal(day: DailyActivity): number {
    return day.diary + day.moods + day.captures;
  }

  private buildDailyActivity(): DailyActivity[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = Array.from({ length: 30 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (29 - index));
      return {
        date,
        label: date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }),
        diary: 0,
        moods: 0,
        captures: 0,
      };
    });
    const dayIndexes = new Map(days.map((day, index) => [this.dateKey(day.date), index]));

    this.diaryEntries().forEach((entry) => this.addToDay(days, dayIndexes, entry.date, 'diary'));
    this.moodEntries().forEach((entry) => this.addToDay(days, dayIndexes, entry.date, 'moods'));
    this.captures().forEach((entry) => this.addToDay(days, dayIndexes, entry.date, 'captures'));
    return days;
  }

  private addToDay(
    days: DailyActivity[],
    indexes: Map<string, number>,
    rawDate: string,
    kind: 'diary' | 'moods' | 'captures',
  ): void {
    const date = this.parseDate(rawDate);
    if (!date) return;
    const index = indexes.get(this.dateKey(date));
    if (index !== undefined) days[index][kind]++;
  }

  private buildAreaPaths(): Array<{ name: string; color: string; path: string }> {
    const series = [
      { name: 'Diario', color: '#8068d8', key: 'diary' as const },
      { name: 'Ánimos', color: '#f1a76e', key: 'moods' as const },
      { name: 'Capturas', color: '#57a99a', key: 'captures' as const },
    ];
    const days = this.dailyActivity();
    const paths: Array<{ name: string; color: string; path: string }> = [];
    const lower = days.map(() => 0);

    for (const item of series) {
      const upper = days.map((day, index) => lower[index] + day[item.key]);
      const points = upper.map((value, index) => `${this.xPosition(index)},${this.yPosition(value)}`);
      for (let index = days.length - 1; index >= 0; index--) {
        points.push(`${this.xPosition(index)},${this.yPosition(lower[index])}`);
      }
      paths.push({
        name: item.name,
        color: item.color,
        path: `M${points.join('L')}Z`,
      });
      for (let index = 0; index < days.length; index++) lower[index] = upper[index];
    }
    return paths;
  }

  private buildActivityBars(): Array<{ x: number; y: number; height: number; total: number }> {
    const days = this.dailyActivity();
    const slotWidth = PLOT_WIDTH / days.length;
    return days.map((day, index) => {
      const total = this.dayTotal(day);
      return {
        x: CHART_MARGIN.left + index * slotWidth + slotWidth * 0.2,
        y: this.yPosition(total),
        height: this.barHeight(total),
        total,
      };
    });
  }

  private buildChartTicks(): ChartTick[] {
    const days = this.dailyActivity();
    const slotWidth = PLOT_WIDTH / days.length;
    return days
      .filter((_, index) => index % 5 === 0 || index === days.length - 1)
      .map((day) => ({
        x: CHART_MARGIN.left + days.indexOf(day) * slotWidth + slotWidth / 2,
        label: day.date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }),
      }));
  }

  private buildYTicks(): number[] {
    const max = this.chartMax();
    return [0, Math.ceil(max / 2), max].filter((value, index, values) => values.indexOf(value) === index);
  }

  private buildMoodSlices(): MoodSlice[] {
    const counts = new Map<string, number>();
    for (const mood of this.moodEntries()) {
      const name = mood.name?.trim() || 'Sin estado';
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }

    const values = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const total = values.reduce((sum, [, count]) => sum + count, 0);
    const circumference = 2 * Math.PI * 42;
    let offset = 0;
    return values.map(([name, count], index) => {
      const length = total ? (count / total) * circumference : 0;
      const slice = {
        name,
        count,
        percent: total ? (count / total) * 100 : 0,
        color: MOOD_COLORS[index % MOOD_COLORS.length],
        dashArray: `${length} ${circumference - length}`,
        dashOffset: -offset,
      };
      offset += length;
      return slice;
    });
  }

  private buildMusicItems(): MusicItem[] {
    const counts = new Map<string, number>();
    for (const mood of this.moodEntries()) {
      const music = mood.music?.trim();
      if (music) counts.set(music, (counts.get(music) ?? 0) + 1);
    }
    const values = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const max = values[0]?.[1] ?? 1;
    return values.map(([name, count]) => ({ name, count, percent: (count / max) * 100 }));
  }

  private chartMax(): number {
    return Math.max(1, ...this.dailyActivity().map((day) => this.dayTotal(day)));
  }

  private xPosition(index: number): number {
    return CHART_MARGIN.left + (index / 29) * PLOT_WIDTH;
  }

  private parseDate(value: string | null | undefined): Date | null {
    if (!value) return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    const date = match
      ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
      : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private dateKey(date: Date): string {
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  }
}
