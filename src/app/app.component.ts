import { Component, HostListener, OnInit } from '@angular/core';
import { ImageEditorComponent } from './components/image-editor/image-editor.component';
import { DeviceService } from './services/device.service';
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ImageEditorComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  title = 'angular-fabric-js';
  mobileDisplay = false;
  damage = null;
  imageURL = 'http://localhost:4200/car.jpg';
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
