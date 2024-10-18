import { Injectable, signal } from "@angular/core";

@Injectable({
  providedIn: "root"
})
export class LoadingService {
  loading = signal(false);

  constructor() {}
  show() {
    this.loading.set(true);
  }
  clear() {
    this.loading.set(false);
  }
}
