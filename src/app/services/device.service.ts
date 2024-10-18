import { Injectable } from '@angular/core';
import { UAParser } from 'ua-parser-js';
@Injectable({
  providedIn: 'root',
})
export class DeviceService {
  constructor() {}

  getUserAgent() {
    const agent = window.navigator.userAgent.toLowerCase();
    const parser = new UAParser(agent);
    const result = parser.getResult();
    return result;
  }

  getDeviceType(): string {
    const screenWidth = window.innerWidth;
    const userAgent = this.getUserAgent();
    let deviceType = '';

    switch (true) {
      case userAgent.device.type === 'wearable':
      case userAgent.device.type === 'mobile' || screenWidth <= 896:
        deviceType = 'mobile';
        break;
      case userAgent.device.type === 'console':
      case userAgent.device.type === 'tablet' || screenWidth <= 897:
        deviceType = 'tablet';
        break;
      case userAgent.device.type === 'smarttv':
      case userAgent.device.type === 'embedded':
      case userAgent.device.type === undefined:
      default:
        deviceType = 'desktop';
        break;
    }

    return screenWidth <= 897 ? deviceType : 'desktop';
  }

  getBrowserName() {
    const userAgent = this.getUserAgent();
    return userAgent.browser.name?.toLowerCase();
  }
}
