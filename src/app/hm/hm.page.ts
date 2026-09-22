import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonContent,
  IonIcon,
  IonTextarea,
  ToastController,
} from '@ionic/angular';
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
} from 'ionicons/icons';
import { PhotoService } from '../services/photo.service';

export interface DiaryEntry {
  id: string;
  title: string;
  excerpt: string;
  date: string;
  readTime: string;
}

export interface SharedCapture {
  id: string;
  imageUrl: string;
  caption: string;
  location: string;
  date: string;
}

export interface MoodEntry {
  id: string;
  name: string;
  vibe: string;
  energy: number;
  music: string;
  date: string;
}

@Component({
  selector: 'app-hm',
  templateUrl: './hm.page.html',
  styleUrls: ['./hm.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonContent,
    IonIcon,
    IonTextarea,
  ],
})
export class HmPage implements OnInit {
  public photoService = inject(PhotoService);
  private readonly toastController = inject(ToastController);
  private readonly router = inject(Router);

  usuario = signal<any | null>(null);
  entries = signal<DiaryEntry[]>([]);
  captures = signal<SharedCapture[]>([]);
  moods = signal<MoodEntry[]>([]);
  daysRegistered = signal<number>(0);

  quickNavExpanded = signal(true);
  newEntryTextModel = '';

  latestEntry = computed(() => this.entries()[0] ?? null);
  latestCapture = computed(() => this.captures()[0] ?? null);
  latestMood = computed(() => this.moods()[0] ?? null);
  photosCount = computed(() => this.photoService.photos().length);
  profilePhoto = computed(() => this.usuario()?.foto_perfil || this.usuario()?.foto || null);
  displayName = computed(() => this.usuario()?.nombre || 'Mi perfil');
  handle = computed(() => {
    const alias = this.usuario()?.username || this.usuario()?.nombre || 'miPerfil';
    return `@${String(alias).toLowerCase().replace(/\s+/g, '')}`;
  });

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
    });
  }

  async ngOnInit() {
    this.cargarUsuarioYEntradas();
    await this.photoService.loadSaved();
  }

  private cargarUsuarioYEntradas(): void {
    const rawUser = localStorage.getItem('user');
    const parsedUser = rawUser ? JSON.parse(rawUser) : null;
    this.usuario.set(parsedUser);

    const storedEntries = localStorage.getItem('hmEntries');
    const entries = storedEntries ? JSON.parse(storedEntries) : [];
    this.entries.set(Array.isArray(entries) ? entries : []);
    this.daysRegistered.set(this.entries().length);
  }

  toggleQuickNav(): void {
    this.quickNavExpanded.update((expanded) => !expanded);
  }

  async addPhoto(): Promise<void> {
    await this.photoService.addNewToGallery();
  }

  async publishEntry(): Promise<void> {
    const content = this.newEntryTextModel.trim();
    if (!content) {
      const toast = await this.toastController.create({
        message: 'Escribe algo antes de publicar.',
        duration: 1800,
        position: 'bottom',
        color: 'warning',
      });
      await toast.present();
      return;
    }

    const entry: DiaryEntry = {
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`,
      title: this.usuario()?.nombre ? `Historia de ${this.usuario().nombre}` : 'Mi historia',
      excerpt: content.length > 180 ? `${content.slice(0, 177)}...` : content,
      date: new Date().toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
      readTime: `${Math.max(1, Math.ceil(content.split(/\s+/).filter(Boolean).length / 180))} min`,
    };

    const nextEntries = [entry, ...this.entries()];
    this.entries.set(nextEntries);
    this.daysRegistered.set(nextEntries.length);
    localStorage.setItem('hmEntries', JSON.stringify(nextEntries));
    this.newEntryTextModel = '';

    const toast = await this.toastController.create({
      message: 'Tu historia se ha guardado en tu perfil.',
      duration: 1800,
      position: 'bottom',
      color: 'success',
    });
    await toast.present();
  }

  openProfile(): void {
    this.router.navigate(['/tabs', 'tab1']);
  }

  async comingSoon(feature: string): Promise<void> {
    const toast = await this.toastController.create({
      message: `${feature}: disponible muy pronto ✨`,
      duration: 1800,
      position: 'bottom',
      color: 'dark',
    });
    await toast.present();
  }
}