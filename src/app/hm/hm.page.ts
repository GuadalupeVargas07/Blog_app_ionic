import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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

/**
 * Estas interfaces describen la forma que tendrán los datos reales
 * (entradas del diario, capturas compartidas y estados de ánimo)
 * una vez que el backend/API los provea. Por ahora, en una cuenta
 * nueva, los arreglos correspondientes están vacíos a propósito.
 */
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
  private toastController = inject(ToastController);

  // ---------------------------------------------------------------
  // Datos de la cuenta. Al ser una cuenta nueva, todo inicia vacío;
  // cuando el backend entregue datos reales, basta con hacer
  // this.entries.set([...]) / this.captures.set([...]) / this.moods.set([...])
  // y las vistas dejarán de mostrar el estado vacío automáticamente.
  // ---------------------------------------------------------------
  entries = signal<DiaryEntry[]>([]);
  captures = signal<SharedCapture[]>([]);
  moods = signal<MoodEntry[]>([]);
  daysRegistered = signal<number>(0);

  // Estado propio de la interfaz
  quickNavExpanded = signal(true);
  newEntryTextModel = '';

  // Datos derivados (lo último de cada lista, o null si no hay nada)
  latestEntry = computed(() => this.entries()[0] ?? null);
  latestCapture = computed(() => this.captures()[0] ?? null);
  latestMood = computed(() => this.moods()[0] ?? null);
  photosCount = computed(() => this.photoService.photos().length);

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
    // Carga las fotos ya guardadas en el dispositivo (si las hay).
    // En una cuenta nueva esto simplemente resuelve en un arreglo vacío.
    await this.photoService.loadSaved();
  }

  toggleQuickNav(): void {
    this.quickNavExpanded.update((expanded) => !expanded);
  }

  async addPhoto(): Promise<void> {
    await this.photoService.addNewToGallery();
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