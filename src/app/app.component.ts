import { Component, HostListener, OnInit } from '@angular/core';
import { ImageEditorComponent } from './components/image-editor/image-editor.component';
import { DeviceService } from './services/device.service';
import { LoadingComponent } from './components/loading/loading.component';
@Component({
    selector: 'app-root',
    imports: [ImageEditorComponent, LoadingComponent],
    templateUrl: './app.component.html',
    styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  title = 'angular-fabric-js';
  mobileDisplay = false;
  damage = null;
  imageURL = 'https://angular-image-editor.netlify.app/car.jpg';
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
