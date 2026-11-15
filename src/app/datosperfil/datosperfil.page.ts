import { CommonModule, Location } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular';
import { Camera, CameraDirection, CameraErrorCode } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { addIcons } from 'ionicons';
import {
  addOutline,
  arrowBackOutline,
  cameraOutline,
  chevronDownOutline,
  chevronUpOutline,
  closeOutline,
  informationCircleOutline,
} from 'ionicons/icons';
import { parse as parseExif } from 'exifr';
import axios from 'axios';
import { ApiConfigService } from '../services/api-config.service';

interface FotoMetadata {
  label: string;
  value: string;
}

interface PerfilUsuario {
  id?: string | number;
  nombre: string;
  username: string;
  email: string;
  bio: string;
  intereses: string[];
  foto_perfil: string | null;
  foto_portada: string | null;
  [key: string]: unknown;
}

@Component({
  selector: 'app-datosperfil',
  templateUrl: './datosperfil.page.html',
  styleUrls: ['./datosperfil.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonIcon,
    IonContent,
  ],
})
export class DatosperfilPage implements OnInit, OnDestroy {
  private readonly location = inject(Location);
  private readonly toastController = inject(ToastController);
  private readonly apiConfig = inject(ApiConfigService);

  usuario: PerfilUsuario = this.perfilVacio();
  nuevoInteres = '';
  fotoPerfilFile: File | null = null;
  fotoPortadaFile: File | null = null;
  fotoPerfilPreview: string | null = null;
  fotoPortadaPreview: string | null = null;
  metadataPerfil: FotoMetadata[] = [];
  metadataLeida = false;
  metadataExpandida = false;
  leyendoMetadata = false;
  errorMetadata: string | null = null;
  guardando = false;

  constructor() {
    addIcons({
      addOutline,
      arrowBackOutline,
      cameraOutline,
      chevronDownOutline,
      chevronUpOutline,
      closeOutline,
      informationCircleOutline,
    });
  }

  ngOnInit(): void {
    this.cargarPerfil();
  }

  ngOnDestroy(): void {
    this.liberarPreview(this.fotoPerfilPreview);
    this.liberarPreview(this.fotoPortadaPreview);
  }

  volver(): void {
    this.location.back();
  }

  async cambiarFotoPerfil(): Promise<void> {
    if (this.guardando) {
      return;
    }

    try {
      const capturedPhoto = await Camera.takePhoto({
        quality: 80,
        saveToGallery: Capacitor.isNativePlatform(),
        cameraDirection: CameraDirection.Front,
      });
      if (!capturedPhoto.webPath) {
        throw new Error('La cámara no devolvió una imagen.');
      }

      const response = await fetch(capturedPhoto.webPath);
      if (!response.ok) {
        throw new Error('No se pudo leer la foto tomada.');
      }

      const blob = await response.blob();
      const file = new File([blob], 'foto-perfil.jpg', {
        type: blob.type || 'image/jpeg',
      });
      if (this.validarArchivo(file)) {
        this.seleccionarFotoPerfil(file);
      }

      if (Capacitor.isNativePlatform() && !capturedPhoto.saved) {
        await this.mostrarAviso(
          'Foto de perfil lista',
          'La foto se puede usar en tu perfil, pero no se guardó en la galería. Revisa los permisos de fotos.',
        );
      }
    } catch (error) {
      if (this.esCancelacionDeCamara(error)) {
        return;
      }
      await this.mostrarAviso('No se pudo tomar la foto', this.mensajeErrorCamara(error));
    }
  }

  async onSeleccionarFotoPerfil(event: Event): Promise<void> {
    const file = this.obtenerArchivo(event);
    if (file) {
      this.seleccionarFotoPerfil(file);
    }
  }

  async toggleMetadataPerfil(): Promise<void> {
    if (this.metadataExpandida) {
      this.metadataExpandida = false;
      return;
    }

    this.metadataExpandida = true;
    if (this.metadataLeida) {
      return;
    }

    this.errorMetadata = null;
    this.leyendoMetadata = true;
    try {
      const image = await this.obtenerImagenParaMetadata();
      const data: unknown = await parseExif(image);
      this.metadataPerfil = this.extraerMetadata(data);
      this.metadataLeida = true;
    } catch (error) {
      this.metadataLeida = false;
      this.errorMetadata = error instanceof Error
        ? `No se pudo leer la metadata EXIF: ${error.message}`
        : 'No se pudo leer la metadata EXIF de esta imagen.';
    } finally {
      this.leyendoMetadata = false;
    }
  }

  async onSeleccionarFotoPortada(event: Event): Promise<void> {
    const file = this.obtenerArchivo(event);
    if (file) {
      this.fotoPortadaFile = file;
      this.asignarPreview('portada', file);
    }
  }

  agregarInteres(): void {
    const valor = this.nuevoInteres.trim();
    if (!valor || this.usuario.intereses.some((interes) => interes.toLowerCase() === valor.toLowerCase())) {
      return;
    }

    this.usuario.intereses = [...this.usuario.intereses, valor];
    this.nuevoInteres = '';
  }

  eliminarInteres(index: number): void {
    this.usuario.intereses = this.usuario.intereses.filter((_, itemIndex) => itemIndex !== index);
  }

  async guardarCambios(): Promise<void> {
    this.usuario.nombre = this.usuario.nombre.trim();
    this.usuario.username = this.usuario.username.trim().replace(/^@/, '');
    this.usuario.email = this.usuario.email.trim();
    this.usuario.bio = this.usuario.bio.trim();

    if (!this.usuario.nombre) {
      await this.mostrarAviso('Revisa el nombre', 'El nombre no puede quedar vacío.');
      return;
    }

    if (this.usuario.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.usuario.email)) {
      await this.mostrarAviso('Correo inválido', 'Escribe un correo electrónico válido.');
      return;
    }

    this.guardando = true;
    try {
      if (this.fotoPerfilFile) {
        this.usuario.foto_perfil = await this.subirImagen(this.fotoPerfilFile, 'perfil');
        this.fotoPerfilFile = null;
      }
      if (this.fotoPortadaFile) {
        this.usuario.foto_portada = await this.subirImagen(this.fotoPortadaFile, 'portada');
        this.fotoPortadaFile = null;
      }

      const usuarioActualizado = {
        ...this.usuario,
        foto: this.usuario.foto_perfil,
        portada: this.usuario.foto_portada,
      };

      localStorage.setItem('user', JSON.stringify(usuarioActualizado));
      localStorage.setItem('coverPhoto', usuarioActualizado.foto_portada ?? '');
      this.usuario = usuarioActualizado;

      if (this.usuario.id) {
        try {
          const apiUrl = `${this.apiConfig.getApiBaseUrl()}/cuentas.php`;
          const response = await axios.post(
            `${apiUrl}?action=update_profile&id=${this.usuario.id}`,
            {
              id: this.usuario.id,
              nombre: this.usuario.nombre,
              username: this.usuario.username,
              email: this.usuario.email,
              bio: this.usuario.bio,
              intereses: this.usuario.intereses,
              foto_perfil: this.usuario.foto_perfil,
              foto_portada: this.usuario.foto_portada,
              foto: this.usuario.foto_perfil,
              portada: this.usuario.foto_portada,
            },
            { headers: { 'Content-Type': 'application/json' } },
          );

          if (response.data?.user) {
            this.usuario = {
              ...this.usuario,
              ...response.data.user,
              intereses: this.normalizarIntereses(response.data.user.intereses ?? this.usuario.intereses),
            };
            localStorage.setItem('user', JSON.stringify(this.usuario));
          }
        } catch (error) {
          const message = axios.isAxiosError(error)
            ? error.response?.data?.message ?? error.message
            : 'No fue posible sincronizar con el servidor.';
          await this.mostrarAviso('Guardado localmente', `No se pudo sincronizar el perfil: ${message}`);
          return;
        }
      }

      await this.mostrarAviso('Perfil actualizado', 'Los cambios se guardaron correctamente.');
      this.volver();
    } catch (error) {
      const message = axios.isAxiosError(error)
        ? error.response?.data?.message ?? error.message
        : error instanceof Error
          ? error.message
          : 'No fue posible guardar los cambios.';
      await this.mostrarAviso('No se pudo guardar', message);
    } finally {
      this.guardando = false;
    }
  }

  private cargarPerfil(): void {
    const guardado = localStorage.getItem('user');
    if (!guardado) {
      return;
    }

    try {
      const data: Record<string, unknown> = JSON.parse(guardado);
      this.usuario = {
        ...this.perfilVacio(),
        ...data,
        nombre: String(data['nombre'] ?? ''),
        username: String(data['username'] ?? ''),
        email: String(data['email'] ?? ''),
        bio: String(data['bio'] ?? ''),
        intereses: this.normalizarIntereses(data['intereses']),
        foto_perfil: this.apiConfig.resolveAssetUrl(
          this.valorComoTexto(data['foto_perfil']) || this.valorComoTexto(data['foto']),
        ),
        foto_portada: this.apiConfig.resolveAssetUrl(
          this.valorComoTexto(data['foto_portada']) || this.valorComoTexto(data['portada']),
        ),
      };
      this.fotoPerfilPreview = this.usuario.foto_perfil;
      this.fotoPortadaPreview = this.usuario.foto_portada;
    } catch {
      void this.mostrarAviso('Perfil no disponible', 'No se pudieron leer los datos guardados del perfil.');
    }
  }

  private normalizarIntereses(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value.map((item) => String(item).trim()).filter(Boolean);
    }
    if (typeof value !== 'string' || !value.trim()) {
      return [];
    }

    try {
      const parsed: unknown = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim()).filter(Boolean);
      }
    } catch {
      return value.split(',').map((item) => item.trim()).filter(Boolean);
    }
    return [];
  }

  private async subirImagen(file: File, tipo: 'perfil' | 'portada'): Promise<string> {
    if (!this.usuario.id) {
      throw new Error('Inicia sesión para poder cambiar tus fotos.');
    }

    const formData = new FormData();
    formData.append('imagen', file);
    formData.append('id', String(this.usuario.id));
    formData.append('tipo', tipo);

    const response = await axios.post(
      `${this.apiConfig.getApiBaseUrl()}/upload.php`,
      formData,
    );
    const url: unknown = response.data?.url;
    if (typeof url !== 'string' || !url.trim()) {
      throw new Error('El servidor no devolvió la dirección de la imagen.');
    }
    return url;
  }

  private obtenerArchivo(event: Event): File | null {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';

    return file && this.validarArchivo(file) ? file : null;
  }

  private validarArchivo(file: File): boolean {
    if (!file.type.startsWith('image/')) {
      void this.mostrarAviso('Archivo inválido', 'Selecciona un archivo de imagen.');
      return false;
    }
    if (file.size > 5 * 1024 * 1024) {
      void this.mostrarAviso('Imagen muy pesada', 'La imagen no debe superar los 5 MB.');
      return false;
    }
    return true;
  }

  private seleccionarFotoPerfil(file: File): void {
    this.fotoPerfilFile = file;
    this.metadataPerfil = [];
    this.metadataLeida = false;
    this.metadataExpandida = false;
    this.errorMetadata = null;
    this.asignarPreview('perfil', file);
  }

  private async obtenerImagenParaMetadata(): Promise<File | Blob> {
    if (this.fotoPerfilFile) {
      return this.fotoPerfilFile;
    }
    if (!this.fotoPerfilPreview) {
      throw new Error('Primero selecciona una foto de perfil.');
    }

    const response = await fetch(this.fotoPerfilPreview);
    if (!response.ok) {
      throw new Error('No se pudo descargar la foto de perfil.');
    }
    return response.blob();
  }

  private extraerMetadata(data: unknown): FotoMetadata[] {
    if (typeof data !== 'object' || data === null) {
      return [];
    }

    const exif = data as Record<string, unknown>;
    const fields: Array<[string, string]> = [
      ['Make', 'Fabricante'],
      ['Model', 'Modelo'],
      ['LensModel', 'Lente'],
      ['DateTimeOriginal', 'Fecha de captura'],
      ['CreateDate', 'Fecha de creación'],
      ['ExposureTime', 'Tiempo de exposición'],
      ['FNumber', 'Apertura'],
      ['ISO', 'ISO'],
      ['FocalLength', 'Distancia focal'],
      ['Flash', 'Flash'],
      ['WhiteBalance', 'Balance de blancos'],
      ['ImageWidth', 'Ancho'],
      ['ImageHeight', 'Alto'],
      ['latitude', 'Latitud'],
      ['longitude', 'Longitud'],
    ];

    return fields.flatMap(([key, label]) => {
      const value = exif[key];
      const formattedValue = this.formatearValorMetadata(value, key);
      return formattedValue ? [{ label, value: formattedValue }] : [];
    });
  }

  private formatearValorMetadata(value: unknown, key: string): string | null {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value.toLocaleString();
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      if (key === 'ExposureTime') {
        return value > 0 && value < 1
          ? `1/${Math.round(1 / value)} s`
          : `${value} s`;
      }
      if (key === 'FNumber') {
        return `f/${value}`;
      }
      if (key === 'FocalLength') {
        return `${value} mm`;
      }
      return String(value);
    }
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
    if (typeof value === 'boolean') {
      return value ? 'Sí' : 'No';
    }
    if (Array.isArray(value) && value.length) {
      return value.map((item) => String(item)).join(', ');
    }
    return null;
  }

  private esCancelacionDeCamara(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) {
      return false;
    }
    if ('code' in error && error.code === CameraErrorCode.TakePhotoCancelled) {
      return true;
    }
    return 'message' in error
      && typeof error.message === 'string'
      && /cancel(?:led|ed)/i.test(error.message);
  }

  private mensajeErrorCamara(error: unknown): string {
    if (typeof error === 'object' && error !== null && 'code' in error) {
      if (error.code === CameraErrorCode.CameraPermissionDenied) {
        return 'Permite el acceso a la cámara en los ajustes del navegador o de la app y vuelve a intentarlo.';
      }
      if (error.code === CameraErrorCode.NoCameraAvailable) {
        return 'No se encontró una cámara disponible en este dispositivo.';
      }
    }

    if (error instanceof DOMException && error.name === 'NotAllowedError') {
      return 'El navegador bloqueó el acceso a la cámara. Permite la cámara y abre la página con HTTPS o desde localhost.';
    }
    if (error instanceof DOMException && error.name === 'NotFoundError') {
      return 'No se encontró una cámara disponible en este dispositivo.';
    }

    return error instanceof Error ? error.message : 'No fue posible abrir la cámara.';
  }

  private asignarPreview(tipo: 'perfil' | 'portada', file: File): void {
    const preview = URL.createObjectURL(file);
    if (tipo === 'perfil') {
      this.liberarPreview(this.fotoPerfilPreview);
      this.fotoPerfilPreview = preview;
    } else {
      this.liberarPreview(this.fotoPortadaPreview);
      this.fotoPortadaPreview = preview;
    }
  }

  private liberarPreview(preview: string | null): void {
    if (preview?.startsWith('blob:')) {
      URL.revokeObjectURL(preview);
    }
  }

  private valorComoTexto(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value : null;
  }

  private perfilVacio(): PerfilUsuario {
    return {
      nombre: '',
      username: '',
      email: '',
      bio: '',
      intereses: [],
      foto_perfil: null,
      foto_portada: null,
    };
  }

  private async mostrarAviso(header: string, message: string): Promise<void> {
    const toast = await this.toastController.create({
      header,
      message,
      duration: 3500,
      position: 'bottom',
    });
    await toast.present();
  }
}
