import { Component, OnInit, ViewChild, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent, IonIcon, IonSpinner, ToastController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  menuOutline,
  personCircleOutline,
  cameraOutline,
  sparklesOutline,
  pricetagOutline,
  chevronDownOutline,
  chevronUpOutline,
  compassOutline,
  searchOutline,
  albumsOutline,
  timeOutline,
  optionsOutline,
  starOutline,
  arrowForwardOutline,
  locationOutline,
  imagesOutline,
  moonOutline,
  bookOutline,
  homeOutline,
  home,
  add,
  gridOutline,
  personOutline,
  closeOutline,
} from 'ionicons/icons';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import {
  HmApiService,
  DiaryEntry,
  SharedCapture,
  MoodEntry,
} from '../services/hm-api.service';
import { ApiConfigService } from '../services/api-config.service';
import { ApiCacheService } from '../services/api-cache.service';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // mismo límite que captures.php

export type ComposerMode = 'diario' | 'foto' | 'animo';

@Component({
  selector: 'app-hm',
  templateUrl: './hm.page.html',
  styleUrls: ['./hm.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent, IonIcon, IonSpinner],
})
export class HmPage implements OnInit {
  private readonly api = inject(HmApiService);
  private readonly apiConfig = inject(ApiConfigService);
  private readonly apiCache = inject(ApiCacheService);
  private readonly toastController = inject(ToastController);
  private readonly router = inject(Router);

  @ViewChild(IonContent) content?: IonContent;

  usuario = signal<any | null>(null);
  entries = signal<DiaryEntry[]>([]);
  captures = signal<SharedCapture[]>([]);
  moods = signal<MoodEntry[]>([]);

  quickNavExpanded = signal(true);
  publishing = signal(false);

  // Tipo de publicación activo: cada uno llena una tabla distinta
  mode = signal<ComposerMode>('diario');

  // diary_entries (title, excerpt, read_time)
  diaryForm = { title: '', excerpt: '', readTime: '' };

  // shared_captures (image_url <- archivo, caption, location)
  captureForm = { caption: '', location: '' };
  pendingPhoto = signal<File | null>(null);
  pendingPhotoPreview = signal<string | null>(null);

  // mood_entries (name, vibe, energy, music)
  moodForm = { name: '', vibe: '', energy: 50, music: '' };
  readonly vibeOptions = ['Calma', 'Nocturna', 'Intensa', 'Nostálgica', 'Creativa', 'Enérgica'];

  editingItem = signal<{ type: ComposerMode; id: number } | null>(null);
  selectedMenu = signal<{ type: ComposerMode; id: number } | null>(null);
  previewItem = signal<
    | {
        type: ComposerMode;
        id: number;
        title?: string;
        excerpt?: string;
        date?: string;
        readTime?: string;
        caption?: string;
        location?: string;
        imageUrl?: string;
        name?: string;
        vibe?: string;
        energy?: number;
        music?: string;
      }
    | null
  >(null);

  orderedEntries = computed(() =>
    [...this.entries()].sort((a, b) => this.sortByDateDesc(a.date, b.date) || Number(b.id) - Number(a.id))
  );
  orderedCaptures = computed(() =>
    [...this.captures()].sort((a, b) => this.sortByDateDesc(a.date, b.date) || Number(b.id) - Number(a.id))
  );
  orderedMoods = computed(() =>
    [...this.moods()].sort((a, b) => this.sortByDateDesc(a.date, b.date) || Number(b.id) - Number(a.id))
  );

  latestEntry = computed(() => this.orderedEntries()[0] ?? null);
  latestCapture = computed(() => this.orderedCaptures()[0] ?? null);
  latestMood = computed(() => this.orderedMoods()[0] ?? null);
  daysRegistered = computed(() => this.entries().length);
  photosCount = computed(() => this.captures().length);
  profilePhoto = computed(() => this.usuario()?.foto_perfil || this.usuario()?.foto || null);
  displayName = computed(() => this.usuario()?.nombre || 'Mi perfil');

  constructor() {
    addIcons({
      'menu-outline': menuOutline,
      'person-circle-outline': personCircleOutline,
      'camera-outline': cameraOutline,
      'sparkles-outline': sparklesOutline,
      'pricetag-outline': pricetagOutline,
      'chevron-down-outline': chevronDownOutline,
      'chevron-up-outline': chevronUpOutline,
      'compass-outline': compassOutline,
      'search-outline': searchOutline,
      'albums-outline': albumsOutline,
      'time-outline': timeOutline,
      'options-outline': optionsOutline,
      'star-outline': starOutline,
      'arrow-forward-outline': arrowForwardOutline,
      'location-outline': locationOutline,
      'images-outline': imagesOutline,
      'moon-outline': moonOutline,
      'book-outline': bookOutline,
      'home-outline': homeOutline,
      home,
      add,
      'grid-outline': gridOutline,
      'person-outline': personOutline,
      'close-outline': closeOutline,
    });
  }

  async ngOnInit() {
    const rawUser = localStorage.getItem('user');
    const user = rawUser ? JSON.parse(rawUser) : null;
    if (user) {
      const profilePhoto = this.apiConfig.resolveAssetUrl(user.foto_perfil || user.foto);
      this.usuario.set({ ...user, foto_perfil: profilePhoto, foto: profilePhoto });
    } else {
      this.usuario.set(null);
    }
    await this.cargarTodo();
  }

  /** Vuelve a cargar diario, capturas y ánimos desde la base de datos. */
  private async cargarTodo(): Promise<void> {
    const userId = this.userId();
    if (!userId) return;

    this.apiCache.clearFallback();
    try {
      const [entries, captures, moods] = await Promise.all([
        this.api.getDiary(userId),
        this.api.getCaptures(userId),
        this.api.getMoods(userId),
      ]);
      this.entries.set(entries);
      this.captures.set(captures);
      this.moods.set(moods);
      const fallbackMessage = this.apiCache.fallbackMessage();
      if (fallbackMessage) {
        await this.toast(fallbackMessage, 'warning');
      }
    } catch (error) {
      console.error('Error cargando datos', error);
      await this.toast('No se pudieron cargar tus datos. ¿Está encendido XAMPP?', 'danger');
    }
  }

  private userId(): number | null {
    const id = Number(this.usuario()?.id);
    return id > 0 ? id : null;
  }

  toggleQuickNav(): void {
    this.quickNavExpanded.update((expanded) => !expanded);
  }

  toggleCardMenu(type: ComposerMode, id: number): void {
    const current = this.selectedMenu();
    this.selectedMenu.set(current?.type === type && current.id === id ? null : { type, id });
  }

  closeCardMenu(): void {
    this.selectedMenu.set(null);
  }

  openPreview(type: ComposerMode, item: DiaryEntry | SharedCapture | MoodEntry): void {
    let payload: any = { type, id: Number((item as any).id) };

    switch (type) {
      case 'diario':
        payload = {
          ...payload,
          title: (item as DiaryEntry).title,
          excerpt: (item as DiaryEntry).excerpt,
          date: (item as DiaryEntry).date,
          readTime: (item as DiaryEntry).readTime,
        };
        break;
      case 'foto':
        payload = {
          ...payload,
          caption: (item as SharedCapture).caption,
          location: (item as SharedCapture).location,
          imageUrl: (item as SharedCapture).imageUrl,
          date: (item as SharedCapture).date,
        };
        break;
      default:
        payload = {
          ...payload,
          name: (item as MoodEntry).name,
          vibe: (item as MoodEntry).vibe,
          energy: (item as MoodEntry).energy,
          music: (item as MoodEntry).music,
          date: (item as MoodEntry).date,
        };
    }

    this.previewItem.set(payload);
    this.closeCardMenu();
  }

  closePreview(): void {
    this.previewItem.set(null);
  }

  startEdit(type: ComposerMode, item: DiaryEntry | SharedCapture | MoodEntry): void {
    this.closeCardMenu();
    this.setMode(type);
    this.editingItem.set({ type, id: Number((item as any).id) });

    switch (type) {
      case 'diario':
        this.diaryForm = {
          title: (item as DiaryEntry).title ?? '',
          excerpt: (item as DiaryEntry).excerpt ?? '',
          readTime: (item as DiaryEntry).readTime ?? '',
        };
        break;
      case 'foto':
        this.captureForm = {
          caption: (item as SharedCapture).caption ?? '',
          location: (item as SharedCapture).location ?? '',
        };
        if ((item as SharedCapture).imageUrl) {
          this.pendingPhotoPreview.set((item as SharedCapture).imageUrl);
        }
        break;
      default:
        this.moodForm = {
          name: (item as MoodEntry).name ?? '',
          vibe: (item as MoodEntry).vibe ?? '',
          energy: Number((item as MoodEntry).energy ?? 50),
          music: (item as MoodEntry).music ?? '',
        };
        break;
    }

    void this.content?.scrollToTop(300);
  }

  private clearEditingState(): void {
    this.editingItem.set(null);
    this.pendingPhoto.set(null);
    this.pendingPhotoPreview.set(null);
  }

  async deleteItem(type: ComposerMode, itemId: number): Promise<void> {
    const userId = this.userId();
    if (!userId) {
      await this.toast('Inicia sesión para eliminar.', 'warning');
      return;
    }

    try {
      switch (type) {
        case 'diario':
          try {
            await this.api.deleteDiary(userId, itemId);
          } catch {
            this.entries.set(this.entries().filter((entry) => entry.id !== itemId));
          }
          this.entries.set(this.entries().filter((entry) => entry.id !== itemId));
          break;
        case 'foto':
          try {
            await this.api.deleteCapture(userId, itemId);
          } catch {
            this.captures.set(this.captures().filter((capture) => capture.id !== itemId));
          }
          this.captures.set(this.captures().filter((capture) => capture.id !== itemId));
          break;
        default:
          try {
            await this.api.deleteMood(userId, itemId);
          } catch {
            this.moods.set(this.moods().filter((mood) => mood.id !== itemId));
          }
          this.moods.set(this.moods().filter((mood) => mood.id !== itemId));
          break;
      }

      this.closeCardMenu();
      await this.toast('Se eliminó correctamente.', 'success');
    } catch (error) {
      console.error('Error eliminando item', error);
      await this.toast('No se pudo eliminar este contenido.', 'danger');
    }
  }

  private sortByDateDesc(a: string | null | undefined, b: string | null | undefined): number {
    const timeA = a ? new Date(a).getTime() : 0;
    const timeB = b ? new Date(b).getTime() : 0;
    return timeB - timeA;
  }

  // ===================== FOTO =====================
  async addPhoto(fileInput?: HTMLInputElement): Promise<void> {
    // En navegador usamos el selector de archivos; en el móvil, cámara/galería nativa.
    if (!Capacitor.isNativePlatform()) {
      fileInput?.click();
      return;
    }

    try {
      const photo = await Camera.getPhoto({
        resultType: CameraResultType.Uri,
        source: CameraSource.Prompt, // pregunta: cámara o galería
        quality: 80,
      });
      if (!photo.webPath) return;

      const blob = await (await fetch(photo.webPath)).blob();
      const ext = photo.format || 'jpeg';
      this.setPendingPhoto(new File([blob], `foto.${ext}`, { type: blob.type || `image/${ext}` }));
    } catch {
      
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.setPendingPhoto(file);
    input.value = ''; 
  }

  private setPendingPhoto(file: File): void {
    if (!file.type.startsWith('image/')) {
      void this.toast('El archivo debe ser una imagen.', 'warning');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      void this.toast('La imagen supera los 5 MB permitidos.', 'warning');
      return;
    }
    this.clearPendingPhoto();
    this.pendingPhoto.set(file);
    this.pendingPhotoPreview.set(URL.createObjectURL(file));
  }

  clearPendingPhoto(): void {
    const preview = this.pendingPhotoPreview();
    if (preview) URL.revokeObjectURL(preview);
    this.pendingPhoto.set(null);
    this.pendingPhotoPreview.set(null);
  }

  // ===================== FORMULARIO =====================
  setMode(mode: ComposerMode): void {
    this.mode.set(mode);
  }

  /** Cambia de pestaña y sube hasta el formulario (lo usan los botones de la barra y las tarjetas vacías). */
  goToForm(mode: ComposerMode): void {
    this.setMode(mode);
    void this.content?.scrollToTop(300);
  }

  autoReadTime(): string {
    const words = this.diaryForm.excerpt.split(/\s+/).filter(Boolean).length;
    return `${Math.max(1, Math.ceil(words / 180))} min`;
  }

  canPublish(): boolean {
    switch (this.mode()) {
      case 'diario':
        return !!this.diaryForm.title.trim() && !!this.diaryForm.excerpt.trim();
      case 'foto':
        return !!this.pendingPhoto() || !!this.editingItem()?.id;
      default:
        return !!this.moodForm.name.trim();
    }
  }

  publishLabel(): string {
    if (this.editingItem()) {
      return 'Guardar cambios';
    }

    switch (this.mode()) {
      case 'diario':
        return 'Publicar historia';
      case 'foto':
        return 'Compartir foto';
      default:
        return 'Guardar ánimo';
    }
  }

  /**
   * diario -> POST diary.php    (user_id, title, excerpt, read_time)
   * foto   -> POST captures.php (user_id, image -> /uploads, link en image_url, caption, location)
   * animo  -> POST moods.php    (user_id, name, vibe, energy, music)
   */
  async publish(): Promise<void> {
    const userId = this.userId();
    if (!userId) {
      await this.toast('Inicia sesión para publicar.', 'warning');
      return;
    }
    if (!this.canPublish()) {
      const faltante: Record<ComposerMode, string> = {
        diario: 'Escribe un título y tu historia.',
        foto: 'Elige una imagen para compartir.',
        animo: 'Dinos cómo te sientes.',
      };
      await this.toast(faltante[this.mode() as ComposerMode], 'warning');
      return;
    }
    if (this.publishing()) return;

    const editing = this.editingItem();
    const publishingStartedAt = Date.now();
    this.publishing.set(true);
    try {
      switch (this.mode()) {
        case 'diario': {
          if (editing?.type === 'diario') {
            await this.api.updateDiary({
              id: editing.id,
              user_id: userId,
              title: this.diaryForm.title.trim(),
              excerpt: this.diaryForm.excerpt.trim(),
              readTime: this.diaryForm.readTime.trim() || this.autoReadTime(),
            });
            this.entries.set(await this.api.getDiary(userId));
            await this.toast('Tu historia se actualizó.', 'success');
          } else {
            await this.api.addDiary({
              user_id: userId,
              title: this.diaryForm.title.trim(),
              excerpt: this.diaryForm.excerpt.trim(),
              readTime: this.diaryForm.readTime.trim() || this.autoReadTime(),
            });
            this.entries.set(await this.api.getDiary(userId));
            await this.toast('Tu historia se ha guardado en el diario.', 'success');
          }
          this.diaryForm = { title: '', excerpt: '', readTime: '' };
          this.clearEditingState();
          break;
        }
        case 'foto': {
          if (editing?.type === 'foto') {
            await this.api.updateCapture({
              id: editing.id,
              user_id: userId,
              image: this.pendingPhoto() ?? undefined,
              caption: this.captureForm.caption.trim(),
              location: this.captureForm.location.trim(),
            });
            this.captures.set(await this.api.getCaptures(userId));
            await this.toast('Tu foto se actualizó.', 'success');
          } else {
            await this.api.addCapture({
              user_id: userId,
              image: this.pendingPhoto()!,
              caption: this.captureForm.caption.trim(),
              location: this.captureForm.location.trim(),
            });
            this.captures.set(await this.api.getCaptures(userId));
            await this.toast('Tu foto se ha compartido.', 'success');
          }
          this.clearPendingPhoto();
          this.captureForm = { caption: '', location: '' };
          this.clearEditingState();
          break;
        }
        case 'animo': {
          if (editing?.type === 'animo') {
            await this.api.updateMood({
              id: editing.id,
              user_id: userId,
              name: this.moodForm.name.trim(),
              vibe: this.moodForm.vibe.trim(),
              energy: Number(this.moodForm.energy),
              music: this.moodForm.music.trim(),
            });
            this.moods.set(await this.api.getMoods(userId));
            await this.toast('Estado de ánimo actualizado.', 'success');
          } else {
            await this.api.addMood({
              user_id: userId,
              name: this.moodForm.name.trim(),
              vibe: this.moodForm.vibe.trim(),
              energy: Number(this.moodForm.energy),
              music: this.moodForm.music.trim(),
            });
            this.moods.set(await this.api.getMoods(userId));
            await this.toast('Estado de ánimo guardado.', 'success');
          }
          this.moodForm = { name: '', vibe: '', energy: 50, music: '' };
          this.clearEditingState();
          break;
        }
      }
    } catch (error: any) {
      console.error('Error al publicar', error);
      await this.toast(error?.response?.data?.message || 'No se pudo guardar. Intenta de nuevo.', 'danger');
    } finally {
      const elapsed = Date.now() - publishingStartedAt;
      if (elapsed < 3000) {
        await new Promise((resolve) => setTimeout(resolve, 3000 - elapsed));
      }
      this.publishing.set(false);
    }
  }

  // ===================== VARIOS =====================
  openProfile(): void {
    this.router.navigate(['/tabs', 'tab1']);
  }

  async comingSoon(feature: string): Promise<void> {
    await this.toast(`${feature}: disponible muy pronto ✨`, 'dark');
  }

  private async toast(message: string, color: string): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      position: 'bottom',
      color,
    });
    await toast.present();
  }
}