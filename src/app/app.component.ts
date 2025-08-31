import { Component, OnInit, signal } from '@angular/core';
import { ImageEditorComponent } from './components/image-editor/image-editor.component';
import { DeviceService } from './services/device.service';
import { LoadingComponent } from './components/loading/loading.component';
import { CommonModule } from '@angular/common';
@Component({
  selector: 'app-root',
  imports: [ImageEditorComponent, LoadingComponent, CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  title = 'angular-fabric-js';
  mobileDisplay = false;
  damage = null;
  imageURL = '/car.jpg';
  isUploading = false;

  // Custom tags for the image editor using signals
  editorTags = signal<string[]>([
    'Chip',
    'Damage',
    'Crack',
    'Scratch',
    'Rust',
    'Salt Stain',
    'Dirt',
    'Weathering',
    'Dented',
  ]);

  // Custom colors for the image editor using signals
  editorColors = signal({
    white: '#ffffff',
    black: '#000000',
    blue: '#002dd1',
    yellow: '#fdd615',
    cyan: '#01FFD7',
    pink: '#FE04FF',
    gray: '#D9D9D9',
  });
  constructor(private deviceService: DeviceService) {
    const damage = localStorage.getItem('damage');
    this.damage = damage ? JSON.parse(damage) : null;
  }

  ngOnInit() {
    this.detectDevice();
  }
  detectDevice() {
    this.mobileDisplay =
      this.deviceService.getDeviceType() === 'mobile' ||
      this.deviceService.getDeviceType() === 'tablet';
  }
}
