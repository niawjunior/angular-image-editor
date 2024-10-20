/**
 * @author: Niaw
 * @description: image editor
 * @version: Fabric.js v.6.4.0
 **
 */

import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  OnDestroy,
  OnInit,
  Output,
  computed,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {
  Canvas,
  Control,
  FabricObject,
  FabricText,
  Group,
  util,
  controlsUtils,
  Transform,
  IText,
  loadSVGFromURL,
  FabricImage,
  Point,
  TMat2D,
  TPointerEvent,
  InteractiveFabricObject,
} from 'fabric';
import Hammer from 'hammerjs';
import { v4 as uuidv4 } from 'uuid';
import { LoadingService } from '../../services/loading.service';

declare module 'fabric' {
  // to have the properties recognized on the instance and in the constructor
  interface FabricObject {
    id?: string;
    name?: string;
  }
  // to have the properties typed in the exported object
  interface SerializedObjectProps {
    id?: string;
    name?: string;
  }
}

@Component({
  selector: 'app-image-editor',
  templateUrl: './image-editor.component.html',
  styleUrls: ['./image-editor.component.scss'],
  standalone: true,
  imports: [CommonModule],
})
export class ImageEditorComponent implements OnInit, AfterViewInit, OnDestroy {
  isDesktop = input<boolean>(false);
  damage = input<any>(null);
  isEditing = input<boolean>(false);
  imageURL = input<string>('');

  // zoom
  zoomOutput = output<number>();
  zoomValue = signal(1);
  zoomOperator = {
    zoomIn: '+',
    zoomOut: '-',
  } as const;
  private _percentageValue = 100; // Initial percentage value
  private _zoomLevel = 1; // Initial zoom level for the image

  // editing event
  onEditingChange = output<boolean>();
  @Output() onFabricLoaded = new EventEmitter();
  onDataChanged = output<boolean>();
  onCancel = output<boolean>();
  fabricCanvas = viewChild<ElementRef<HTMLCanvasElement>>('fabricCanvas');
  private imageEditorElement: HTMLElement | null = null;
  private editorContainer: HTMLElement | null = null;
  imageSize = {
    width: 0,
    height: 0,
  };
  imgFabric!: FabricObject;
  canvasFabric!: Canvas;
  isLoading: boolean = false;
  isSaveLoading: boolean = false;
  zoomFactor: number = 3;
  colors = {
    white: '#ffffff',
    black: '#000000',
    blue: '#002dd1',
    yellow: '#fdd615',
    cyan: '#01FFD7',
    pink: '#FE04FF',
    gray: '#D9D9D9',
  };
  subToolType = {
    draw: 'draw',
    tag: 'tag',
    text: 'text',
  };

  screenResolution = {
    desktopDefault: 113,
    mobile: 303,
  } as const;

  selectedColor: string = this.colors.white;
  selectedTool: string = this.subToolType.draw;
  isPortrait: boolean = true;
  isGroupEditing: boolean = false;
  tags: string[] = [
    'ลักยิ้ม',
    'บุบ',
    'ครูด',
    'แตก',
    'ร้าว',
    'กระเทาะ',
    'บิ่น',
    'ดุ้ง',
    'ขูดขีด',
  ];

  hideControls = {
    tl: true,
    tr: true,
    bl: true,
    br: true,
    ml: false,
    mt: false,
    mr: false,
    mb: false,
    mtr: true,
  };

  originalCanvasViewport: number[] = [];
  currentCanvasViewport: number[] = [];
  zoomPoint: Point = new Point(0, 0);

  // global config
  groupConfig: any = {
    centeredScaling: true,
    cornerSize: window.innerWidth < 900 ? 80 : 30,
    cornerStrokeColor: this.colors.cyan,
    cornerColor: this.colors.white,
    padding: 60,
    hasControls: true,
    borderDashArray: [5],
    borderScaleFactor: 3,
    hasBorders: true,
    cornerStyle: 'circle',
    borderColor: this.colors.cyan,
    transparentCorners: false,
    centeredRotation: true,
    lockScalingFlip: true,
    strokeUniform: true,
    // minScaleLimit: 0.5,
  };

  jsonData: any;
  isInitialized: boolean = false;
  currentImageIndex: number = 0;

  /**
   * @HostListener Decorator
   * Listens to the window resize event and adjusts canvas dimensions accordingly.
   * @param $event - The event object containing resize information.
   */
  @HostListener('window:resize', ['$event'])
  resizeCanvas() {
    // Check if both canvas and image fabric objects are available

    if (this.canvasFabric && this.imgFabric) {
      // Find the container element for the canvas

      const container = document.querySelector(
        '.custom-container'
      ) as HTMLElement;
      // If container element is not found, exit the function

      if (!container) {
        return;
      }
      // Determine the width of the viewport

      const width = window.innerWidth > 0 ? window.innerWidth : screen.width;
      // Initialize variable for screen resolution

      let screenResolution;
      // Determine appropriate screen resolution based on device type and editing mode

      if (this.isDesktop()) {
        screenResolution = this.screenResolution.desktopDefault;
      } else {
        screenResolution = this.screenResolution.mobile;
      }
      // Calculate the actual width for the image canvas

      const actualWidth = width - screenResolution;
      // Calculate aspect ratio of the image

      const aspect = this.imgFabric.width! / this.imgFabric.height!;
      // Calculate image dimensions based on actual width and aspect ratio

      const imageWidth = actualWidth;
      const imageHeight = actualWidth / aspect;
      // Apply CSS styles to the container element for the canvas
      container.style.width = imageWidth + 'px';
      container.style.height = imageHeight + 'px';
      // Set dimensions of the canvas fabric

      this.canvasFabric.setDimensions(
        {
          width: imageWidth,
          height: imageHeight,
        },
        { cssOnly: true }
      );
      // Reset zoom level of the canvas

      this.resetZoom();
      // Render changes on the canvas

      this.canvasFabric.renderAll();
    }
  }

  /**
   * @HostListener Decorator
   * Listens to the document's keydown event to handle keyboard interactions.
   * @param $event - The event object containing keyboard event details.
   */
  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent) {
    // Check if the key combination for saving is pressed (Ctrl + S or Cmd + S)

    if ((event.ctrlKey || event.metaKey) && event.key === 's') {
      // Prevent the default action of the keypress (typically saving the webpage)

      event.preventDefault();
      // If in editing mode, trigger the saveCanvas method

      if (this.isEditing()) {
        this.saveCanvas();
      }
    }
    // Check if the Delete or Backspace key is pressed

    if (event.code === 'Delete' || event.code === 'Backspace') {
      // Get the currently active object on the canvas

      const activeObject = this.canvasFabric.getActiveObject();
      // If there's an active object and not in group editing mode, remove the object from the canvas

      if (activeObject && !this.isGroupEditing) {
        this.canvasFabric.remove(activeObject);
        this.canvasFabric.renderAll();
      }
    }
  }

  constructor(private loadingService: LoadingService) {
    effect(() => {
      // If 'isEditing' has changed and it's on desktop, resize canvas
      console.log;
      if (this.isEditing() && this.isDesktop()) {
        this.resizeCanvas();
      }
      // window.location.reload();
    });
  }

  handleZoom(value: number) {
    if (value === 1) {
      this.resetZoom();
    } else {
      if (value >= this.getZoomValue()) {
        this.onZoomChange(this.zoomOperator.zoomIn, value);
      }
      // If new zoom value is less than current zoom value, zoom out

      if (value < this.getZoomValue()) {
        this.onZoomChange(this.zoomOperator.zoomOut, value);
      }
    }
  }
  /**
   * Lifecycle hook called after Angular has initialized all data-bound properties of the component.
   * Initializes component properties and subscribes to necessary observables.
   */
  ngOnInit() {
    // Set page title if editing or not on desktop

    // Check device orientation (portrait or landscape)

    const portrait = window.matchMedia('(orientation: portrait)');
    this.isPortrait = portrait?.matches;
    // Combine observables to get route parameters and parent parameters
    this.loadingService.show();
    this.initializeListData();
    // Listen for changes in device orientation

    // Subscribe to handleCancel event to handle cancellation actions

    portrait.addEventListener('change', async (event: MediaQueryListEvent) => {
      if (event.matches) {
        // If in portrait mode, set flag and reset initialization status

        this.isPortrait = true;
        this.isInitialized = false;
        setTimeout(() => {
          window.location.reload();
        }, 100);
      } else {
        // If not in portrait mode, reload the page to adjust layout

        this.isPortrait = false;
        setTimeout(() => {
          window.location.reload();
        }, 100);
      }
    });
  }

  /**
   * Lifecycle hook called after Angular has fully initialized the component's view.
   * Performs additional initialization logic for the view.
   */
  ngAfterViewInit() {
    // Get reference to the image editor element

    this.imageEditorElement = document?.querySelector('.image-editor');
    if (this.imageEditorElement) {
      // If image editor element exists, prevent default context menu behavior

      this.imageEditorElement.addEventListener('contextmenu', (event) => {
        event.preventDefault();
      });
    }
    // Get reference to the editor container element

    this.editorContainer = document?.querySelector('.editor-container');
    // If editor container element exists, prevent default double-click and wheel scroll behaviors

    if (this.editorContainer) {
      this.editorContainer.addEventListener('dblclick', (event) => {
        event.preventDefault();
      });
      // Prevent default wheel scroll behavior with non-passive event listener

      this.editorContainer.addEventListener(
        'wheel',
        (event) => {
          event.preventDefault();
        },
        { passive: false }
      );
    }
  }
  /**
   * Lifecycle hook that is called when the component is destroyed.
   * Removes event listeners and unsubscribes from subscriptions to prevent memory leaks.
   */
  ngOnDestroy() {
    // Remove contextmenu event listener from imageEditorElement if exists

    if (this.imageEditorElement) {
      this.imageEditorElement.removeEventListener('contextmenu', () => {});
    }
    // Remove dblclick and wheel event listeners from editorContainer if exists

    if (this.editorContainer) {
      this.editorContainer.removeEventListener('dblclick', () => {});
      this.editorContainer.removeEventListener('wheel', () => {});
    }
  }

  /**
   * Initializes list data for the component.
   * Sets loading and initialization flags, retrieves galleries and damage photo data,
   * and loads image data to the canvas.
   */

  initializeListData() {
    // Set loading and initialization flags

    this.isLoading = true;
    this.isInitialized = false;

    this.loadImageToCanvas(this.damage());
  }

  /**
   * Computed property that calculates the zoom value.
   * Rounds the zoom value to one decimal place and returns it as a number.
   */
  getZoomValue = computed(() => {
    // Calculate the zoom value and round it to one decimal place
    const roundedValue = Math.round(this.zoomValue() * 10) / 10; // Round to one decimal place
    // Convert the rounded value to a number with one decimal place
    return Number(roundedValue.toFixed(1)); // Convert to string with one decimal place
  });

  /**
   * Returns a function to handle double-click events on Fabric.js objects.
   * The handler function is only called if the object's 'clicked' property is true.
   * If the object's 'clicked' property is false, it is set to true and reset after a delay.
   * @param obj - The Fabric.js object to handle double-click events for.
   * @param handler - The function to call when a double-click event occurs.
   * @returns A function to handle double-click events on Fabric.js objects.
   */
  fabricDblClick(obj: any, handler: any) {
    return function () {
      // Call the handler function if the object has been clicked
      if (obj.clicked) handler(obj);
      else {
        // Set the 'clicked' property to true and reset after a delay
        obj.clicked = true;
        setTimeout(function () {
          obj.clicked = false;
        }, 500);
      }
    };
  }

  /**
   * Ungroups objects from a Fabric.js group.
   * Removes the group from the canvas, restores the state of its objects,
   * and adds the individual objects back to the canvas.
   * @param group - The Fabric.js group to ungroup.
   */
  unGroup(group: any) {
    this.canvasFabric.remove(group);
    this.canvasFabric.add(...group.removeAll());
    this.canvasFabric?.renderAll();
    this.canvasFabric.requestRenderAll();
  }

  deleteGroup(group: FabricObject[]) {
    group.forEach((obj: FabricObject) => this.canvasFabric.remove(obj));
    this.canvasFabric.discardActiveObject();
    this.canvasFabric.requestRenderAll();
  }

  groupObjects(group: any) {
    this.deleteGroup(group);
    const newGroup = new Group(group.objects);
    this.canvasFabric.add(newGroup);
    this.canvasFabric.requestRenderAll();
  }

  async loadImageToCanvas(damage: any) {
    const imageUrl = this.imageURL();
    // Fetch image size

    const imageSize = await this.getImageSize(this.imageURL());
    this.imageSize = imageSize;

    // Dispose of the previous canvas instance if it exists

    if (this.canvasFabric) {
      this.canvasFabric.dispose();
      (this.canvasFabric as any) = null;
      this.canvasFabric?.clear();
    }
    // Initialize the new canvas

    const fabricCanvas = this.fabricCanvas()?.nativeElement!;
    const canvas: Canvas = new Canvas(fabricCanvas, {
      width: this.imageSize.width,
      height: this.imageSize.height,
      allowTouchScrolling: true,
      selection: false,
      containerClass: 'custom-container',
      enableRetinaScaling: false,
      defaultCursor: this.getZoomValue() > 1 ? 'move' : 'default',
    });

    // override default settings

    // const controlPoints = ["tl", "tr", "ml", "mr", "mb", "mt", "bl", "br"];
    const controls = controlsUtils.createObjectDefaultControls();
    InteractiveFabricObject.ownDefaults.noScaleCache = false;
    FabricText.ownDefaults.fontFamily = 'Noto Sans Thai';
    (FabricObject as any).customProperties = ['name', 'id'];

    InteractiveFabricObject.ownDefaults.controls = {
      ...controls,
      tl: new Control({
        ...controls.tl,
        sizeX: this.groupConfig.cornerSize,
        sizeY: this.groupConfig.cornerSize,
        touchSizeX: this.groupConfig.cornerSize * 2,
        touchSizeY: this.groupConfig.cornerSize * 2,
      }),
      tr: new Control({
        ...controls.tr,
        sizeX: this.groupConfig.cornerSize,
        sizeY: this.groupConfig.cornerSize,
        touchSizeX: this.groupConfig.cornerSize * 2,
        touchSizeY: this.groupConfig.cornerSize * 2,
      }),
      ml: new Control({
        ...controls.ml,
        sizeX: this.groupConfig.cornerSize,
        sizeY: this.groupConfig.cornerSize,
        touchSizeX: this.groupConfig.cornerSize * 2,
        touchSizeY: this.groupConfig.cornerSize * 2,
      }),
      mr: new Control({
        ...controls.mr,
        sizeX: this.groupConfig.cornerSize,
        sizeY: this.groupConfig.cornerSize,
        touchSizeX: this.groupConfig.cornerSize * 2,
        touchSizeY: this.groupConfig.cornerSize * 2,
      }),
      mb: new Control({
        ...controls.mb,
        sizeX: this.groupConfig.cornerSize,
        sizeY: this.groupConfig.cornerSize,
        touchSizeX: this.groupConfig.cornerSize * 2,
        touchSizeY: this.groupConfig.cornerSize * 2,
      }),
      mt: new Control({
        ...controls.mt,
        sizeX: this.groupConfig.cornerSize,
        sizeY: this.groupConfig.cornerSize,
        touchSizeX: this.groupConfig.cornerSize * 2,
        touchSizeY: this.groupConfig.cornerSize * 2,
      }),
      bl: new Control({
        ...controls.bl,
        sizeX: this.groupConfig.cornerSize,
        sizeY: this.groupConfig.cornerSize,
        touchSizeX: this.groupConfig.cornerSize * 2,
        touchSizeY: this.groupConfig.cornerSize * 2,
      }),
      br: new Control({
        ...controls.br,
        sizeX: this.groupConfig.cornerSize,
        sizeY: this.groupConfig.cornerSize,
        touchSizeX: this.groupConfig.cornerSize * 2,
        touchSizeY: this.groupConfig.cornerSize * 2,
      }),
      mtr: new Control({
        x: 0,
        y: -0.5,
        offsetX: 0,
        offsetY: window.innerWidth < 900 ? -150 : -80,
        sizeX: this.groupConfig.cornerSize * 2,
        sizeY: this.groupConfig.cornerSize * 2,
        touchSizeX: this.groupConfig.cornerSize * 2,
        touchSizeY: this.groupConfig.cornerSize * 2,
        cursorStyle: 'crosshair',
        actionHandler: controlsUtils.rotationWithSnapping,
        actionName: 'rotate',
        render: this.renderRotateIcon('bgtrue'),
        withConnection: false,
      }),
      deleteControl: new Control({
        x: 0.5,
        y: -0.5,
        offsetY: window.innerWidth < 900 ? -120 : -60,
        offsetX: window.innerWidth < 900 ? 80 : 60,
        sizeX: this.groupConfig.cornerSize! * 2,
        sizeY: this.groupConfig.cornerSize! * 2,
        touchSizeX: this.groupConfig.cornerSize! * 2,
        touchSizeY: this.groupConfig.cornerSize! * 2,
        cursorStyle: 'pointer',
        mouseUpHandler: this.deleteObject,
        render: this.renderDeleteIcon('bgtrue'),
      }),
    };

    canvas.setDimensions(
      { width: this.imageSize.width, height: this.imageSize.height },
      { cssOnly: true }
    );

    // prevent object out of canvas
    canvas.on('object:moving', function (e: any) {
      const obj = e.target;
      // if object is too big ignore
      if (
        obj.currentHeight > obj.canvas.height ||
        obj.currentWidth > obj.canvas.width
      ) {
        return;
      }
      obj.setCoords();
      // top-left  corner
      if (obj.getBoundingRect().top < 0 || obj.getBoundingRect().left < 0) {
        obj.top = Math.max(obj.top, obj.top - obj.getBoundingRect().top);
        obj.left = Math.max(obj.left, obj.left - obj.getBoundingRect().left);
      }
      // bot-right corner
      if (
        obj.getBoundingRect().top + obj.getBoundingRect().height >
          obj.canvas.height ||
        obj.getBoundingRect().left + obj.getBoundingRect().width >
          obj.canvas.width
      ) {
        obj.top = Math.min(
          obj.top,
          obj.canvas.height -
            obj.getBoundingRect().height +
            obj.top -
            obj.getBoundingRect().top
        );
        obj.left = Math.min(
          obj.left,
          obj.canvas.width -
            obj.getBoundingRect().width +
            obj.left -
            obj.getBoundingRect().left
        );
      }
    });

    // prevent object out of canvas when resize

    // reset active object
    canvas.on('mouse:up', function () {
      if (canvas.getActiveObjects().length > 1) {
        canvas.discardActiveObject();
      }
      canvas.requestRenderAll();
    });

    // wheel event
    canvas.on('mouse:wheel', (opt: any) => {
      opt.e.preventDefault();
      opt.e.stopPropagation();

      const e = opt.e;
      this.panCanvas(canvas, {
        x: e.deltaX,
        y: e.deltaY,
      });
    });

    canvas.on('selection:cleared', () => {
      canvas.discardActiveObject();
    });

    // workaround for touch gesture not working (on mobile) with hammerjs
    const hammerCanvas = new Hammer(canvas.getSelectionElement());
    hammerCanvas.get('pinch').set({ enable: true });
    hammerCanvas.on('pinch', (event: any) => {
      this.zoomCanvas(canvas, event.scale, {
        x: event.center.x,
        y: event.center.y,
      });
    });

    // Set the options for the pan recognizer, including sensitivity
    hammerCanvas.get('pan').set({
      direction: Hammer.DIRECTION_ALL,
      threshold: 0,
      pointers: 0,
    });

    hammerCanvas.on('pan', (event: any) => {
      event.preventDefault();

      const e = event;

      this.panCanvas(canvas, {
        x: e.deltaX,
        y: e.deltaY,
      });
    });

    canvas.renderAll();
    this.canvasFabric = canvas;

    this.originalCanvasViewport = this.canvasFabric.viewportTransform!.slice();
    this.currentCanvasViewport = this.canvasFabric.viewportTransform!.slice();
    // if damage exists, load it
    if (damage && damage.objects?.length > 0) {
      if (fabricCanvas) {
        canvas.loadFromJSON(damage).then(() => {
          canvas.getObjects().forEach((obj) => {
            // get stroke color from obj
            obj.set({
              ...this.groupConfig,
              lockScalingFlip: obj.type.toLowerCase() === 'path' ? false : true,
              selectable: this.isEditing() || !this.isDesktop() ? true : false,
              evented: this.isEditing() || !this.isDesktop() ? true : false,
            });

            const objJson = obj.toJSON();
            const isEditable = objJson?.objects?.some(
              (obj: { type: string }) =>
                obj?.type === 'IText' || obj?.type.toLowerCase() === 'i-text'
            );
            if (obj.type.toLowerCase() === 'group' && isEditable) {
              obj.on(
                'mousedown',
                this.fabricDblClick(obj, () => {
                  this.isGroupEditing = true;
                  this.unGroup(obj as Group); // Ensure obj is treated as Group
                  let react: any;
                  let text: any;
                  canvas.getObjects().forEach((item: any) => {
                    if (item.type.toLowerCase() === 'rect') {
                      react = item;
                    }

                    if (
                      item.type === 'IText' ||
                      item.type.toLowerCase() === 'i-text'
                    ) {
                      text = item;
                    }
                  });
                  if (react && text) {
                    react.set({
                      selectable: false,
                    });
                    canvas.setActiveObject(text);

                    text.enterEditing();
                    text.selectAll();
                    text.on('changed', function () {
                      react.set({
                        width: text.width! + 25,
                        height: text.height! + 14,
                      });
                    });
                    text.on('editing:exited', () => {
                      if (!text.text) {
                        text.set('text', 'กขค..');
                        react.set({
                          width: text.width! + 25,
                          height: text.height! + 14,
                        });
                      }
                      this.deleteGroup([react, text]);
                      const group = new Group([react, text], {
                        ...this.groupConfig,
                      });
                      group.setControlsVisibility(this.hideControls);

                      canvas.add(group);
                      group.on(
                        'mousedown',
                        this.fabricDblClick(group, () => {
                          this.unGroup(group);
                          this.isGroupEditing = true;

                          canvas.setActiveObject(text);
                          text.enterEditing();
                          text.selectAll();
                        })
                      );

                      canvas.renderAll();
                      canvas.requestRenderAll();
                    });

                    canvas.renderAll();
                  }

                  canvas.renderAll();
                })
              );
            }

            if (obj.type === 'IText' || obj.type.toLowerCase() === 'i-text') {
              const item = obj as IText;
              obj.on(
                'mousedown',
                this.fabricDblClick(obj, () => {
                  this.isGroupEditing = false;

                  canvas.setActiveObject(item);
                  item.enterEditing();
                  item.selectAll();

                  item.on('editing:exited', () => {
                    if (!item.text) {
                      item.set('text', 'กขค..');
                    }
                    canvas.renderAll();
                  });
                })
              );
            }

            const hideControl =
              obj.type.toLowerCase() === 'rect'
                ? {
                    ...this.hideControls,
                    ml: true,
                    mr: true,
                    mt: true,
                    mb: true,
                  }
                : this.hideControls;

            obj.setControlsVisibility(hideControl);
            canvas.renderAll();
          });

          this.imgFabric = damage.backgroundImage;
          canvas.renderAll();
          this.canvasFabric = canvas;

          this.resizeCanvas();
          this.isLoading = false;
          this.isInitialized = true;
          this.loadingService.clear();
          this.jsonData = this.canvasFabric?.toJSON();

          this.onFabricLoaded.emit(true);
        });
      }
    } else {
      // clear previous image
      FabricImage.fromURL(imageUrl, {
        crossOrigin: 'anonymous',
      }).then((img) => {
        if (fabricCanvas) {
          img.set({
            selectable: false,
            width: this.imageSize.width,
            height: this.imageSize.height,
          });

          // Directly assign the backgroundImage property
          canvas.backgroundImage = img;

          // Render the canvas after setting the background image
          canvas.renderAll();
          canvas.requestRenderAll();

          this.imgFabric = img;
          this.canvasFabric = canvas;
          this.resizeCanvas();
          this.isLoading = false;

          this.isInitialized = true;
          this.jsonData = this.canvasFabric?.toJSON();
          this.loadingService.clear();
          this.onFabricLoaded.emit(true);
        }
      });
    }
  }

  /**
   * Retrieves the size (width and height) of an image from the given URL.
   * @param imageUrl - The URL of the image to get the size for.
   * @returns A Promise that resolves with an object containing the width and height of the image.
   */
  getImageSize(imageUrl: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      // Create a new Image object
      const img = new Image();
      // Set the image source to the provided URL
      img.src = imageUrl;

      // Handle the 'onload' event when the image is successfully loaded
      img.onload = () => {
        // Extract the natural width and height of the image
        const width = img.naturalWidth;
        const height = img.naturalHeight;
        // Resolve the Promise with the image size
        resolve({ width, height });
      };

      // Handle the 'onerror' event if there's an error loading the image
      img.onerror = (error) => {
        // Reject the Promise with the error
        reject(error);
      };
    });
  }

  panCanvas(canvas: Canvas, delta: { x: number; y: number }) {
    // Convert delta to fabric.Point
    const deltaPoint = new Point(delta.x, delta.y);

    // Copy the current viewport transform
    const vpt: TMat2D = canvas.viewportTransform!.slice(0) as TMat2D;

    // Update the viewport transform with the delta values
    vpt[4] += deltaPoint.x;
    vpt[5] += deltaPoint.y;

    // Define container dimensions
    const containerWidth = this.imageSize.width;
    const containerHeight = this.imageSize.height;

    // Calculate canvas dimensions considering zoom
    const canvasWidth = canvas.getWidth() * canvas.getZoom();
    const canvasHeight = canvas.getHeight() * canvas.getZoom();

    // Adjust viewport to stay within canvas bounds
    if (canvasWidth < containerWidth) {
      vpt[4] = Math.min(0, Math.max(vpt[4], containerWidth - canvasWidth));
    } else {
      vpt[4] = Math.max(containerWidth - canvasWidth, Math.min(0, vpt[4]));
    }

    if (canvasHeight < containerHeight) {
      vpt[5] = Math.min(0, Math.max(vpt[5], containerHeight - canvasHeight));
    } else {
      vpt[5] = Math.max(containerHeight - canvasHeight, Math.min(0, vpt[5]));
    }

    // Set the adjusted viewport transform
    if (canvas.getZoom() > 1 && !this.isActiveObject) {
      canvas.viewportTransform = vpt;
    }

    this.currentCanvasViewport = vpt;

    // Use the adjusted delta point
    canvas.zoomToPoint(deltaPoint, canvas.getZoom());

    // Render the canvas
    canvas.renderAll();
    canvas.requestRenderAll();
  }

  /**
   * Zooms the Fabric.js canvas by the specified zoom factor around the specified center point.
   * Limits the zoom factor between a minimum and maximum value.
   * @param canvas - The Fabric.js canvas to zoom.
   * @param zoomFactor - The factor by which to zoom the canvas.
   * @param center - The center point around which to zoom the canvas.
   */
  zoomCanvas(
    canvas: Canvas,
    zoomFactor: number,
    center: { x: number; y: number }
  ) {
    // Calculate the new zoom level
    const zoom = canvas.getZoom() * zoomFactor;
    const minZoom = 1.0;
    const maxZoom = 2.0;

    let newZoom = zoom;
    // Limit the zoom factor between the minimum and maximum values
    if (newZoom > maxZoom) {
      newZoom = maxZoom;
    } else if (newZoom < minZoom) {
      newZoom = minZoom;
    }

    // Emit the new zoom level if on desktop
    if (this.isDesktop()) {
      this.zoomOutput.emit(newZoom);
    }

    // Convert the center point to a fabric.Point
    const zoomPoint = new Point(center.x, center.y);
    this.zoomPoint = zoomPoint;

    // Update the zoom value
    canvas.zoomToPoint(zoomPoint, newZoom);
    this.zoomValue.set(newZoom);
    // Reset zoom if zoom level is 1.0
    if (newZoom === 1.0) {
      this.resetZoom();
    }
    // Render the canvas
    canvas.renderAll();
    canvas.requestRenderAll();
  }

  /**
   * Handles zoom changes on the Fabric.js canvas.
   * Zooms in or out based on the event ('+' for zoom in, '-' for zoom out),
   * with optional specified zoom value.
   * @param event - The event indicating whether to zoom in or out ('+' or '-').
   * @param zoomValue - The optional zoom value to use for zooming.
   */
  onZoomChange(event: '-' | '+', zoomValue?: number) {
    let zoom = zoomValue ?? this.getZoomValue();
    zoom = Number(zoom.toFixed(1));
    // Get the canvas and zoom point

    const canvas = this.canvasFabric;
    // Handle zoom in event

    if (event === this.zoomOperator.zoomIn && zoom <= 2.0) {
      // Set the maximum zoom level to 2.0

      const zoomNumber = this.isDesktop() ? zoom : zoom * 1.1;
      canvas.zoomToPoint(
        this.zoomPoint,
        zoomNumber! // Increase the zoom by 10%
      );
      this.zoomValue.set(zoomNumber!);

      canvas.defaultCursor = this.getZoomValue() > 1 ? 'move' : 'default';
    }
    // Handle zoom out event
    else if (event === this.zoomOperator.zoomOut && zoom >= 1.1) {
      const zoomNumber = this.isDesktop() ? zoom : zoom * 0.9;
      // Set the minimum zoom level to 1.1
      canvas.zoomToPoint(
        this.zoomPoint,
        zoomNumber! // Decrease the zoom by 10%
      );
      // Reset zoom if zoom level is less than 1
      if (zoomNumber < 1) {
        this.resetZoom();
      }

      this.zoomValue.set(zoomNumber!);
      canvas.defaultCursor = this.getZoomValue() > 1 ? 'move' : 'default';
    }
    // Reset zoom if zoom level is not within acceptable range
    else {
      this.resetZoom();
    }
  }

  /**
   * Resets the zoom level and viewport transform of the Fabric.js canvas to its initial state.
   */
  resetZoom() {
    const canvas = this.canvasFabric; // Assuming canvasFabric is the Fabric.js canvas instance
    const initialZoom = 1.0;
    // Set the zoom value to the initial zoom level
    this.zoomValue.set(initialZoom);

    // Reset zoom and viewport transform if canvas exists
    if (canvas) {
      canvas.discardActiveObject();

      // Create a fabric.Point for the center of the canvas
      const centerPoint = new Point(canvas.width! / 2, canvas.height! / 2);
      // Zoom to the center of the canvas with the initial zoom level
      canvas.zoomToPoint(centerPoint, initialZoom);
      // Reset the viewport transform to default (identity matrix)
      canvas.viewportTransform = [1, 0, 0, 1, 0, 0];
      // Update the current canvas viewport
      this.currentCanvasViewport = [1, 0, 0, 1, 0, 0];
      // Render the canvas
      canvas.defaultCursor = this.getZoomValue() > 1 ? 'move' : 'default';
      canvas.renderAll();
      // Update the zoom point to the center of the canvas
      this.zoomPoint = centerPoint;
    }
  }

  /**
   * Sets the fill or stroke color for the selected object(s) on the Fabric.js canvas.
   * @param color - The color to set for the selected object(s).
   */
  setSelectedColor(color: string) {
    const activeObject: any = this.canvasFabric.getActiveObject();
    // Check if the active object is a group
    if (activeObject && activeObject.type.toLowerCase() === 'group') {
      const objectsInGroup: any[] = activeObject.getObjects();

      // Check if any object in the group is editable text
      const isEditable = objectsInGroup?.some(
        (obj) => obj?.type === 'IText' || obj?.type.toLowerCase() === 'i-text'
      );

      // Set color for objects in the group based on their type
      objectsInGroup.forEach((obj) => {
        if (
          (isEditable && obj.type === 'IText') ||
          obj.type.toLowerCase() === 'i-text'
        ) {
          // Set fill color for editable text
          obj.set(
            'fill',
            [this.colors.black, this.colors.blue].includes(color)
              ? this.colors.white
              : this.colors.black
          );
        } else if (!isEditable && obj.type.toLowerCase() === 'text') {
          // Set fill color for non-editable text
          obj.set(
            'fill',
            [this.colors.black, this.colors.blue].includes(color)
              ? this.colors.white
              : this.colors.black
          );
        } else if (
          obj.type.toLowerCase() === 'rect' ||
          obj.type.toLowerCase() === 'path'
        ) {
          // Set fill color for rectangle or path
          obj.set('fill', color);
        }
      });
    } else if (activeObject) {
      // Set color for a single object (not a group)
      if (activeObject.type.toLowerCase() === 'rect') {
        // Set stroke color for rectangle
        activeObject.set('stroke', color);
      } else if (activeObject.type.toLowerCase() === 'path') {
        // Set fill color for path
        activeObject.set('fill', color);
      } else if (
        activeObject.type === 'IText' ||
        activeObject.type.toLowerCase() === 'i-text'
      ) {
        // Set fill color for editable text
        if (!this.isGroupEditing) {
          activeObject.set('fill', color);
        } else {
          const currentRect = this.canvasFabric
            .getObjects()
            .find(
              (obj: any) =>
                obj.id === activeObject.id && obj.type.toLowerCase() === 'rect'
            );

          const currentText = this.canvasFabric
            .getObjects()
            .find(
              (obj: any) =>
                obj.id === activeObject.id &&
                (obj.type === 'IText' || obj.type.toLowerCase() === 'i-text')
            );

          if (currentRect && currentText) {
            currentText.set(
              'fill',
              [this.colors.black, this.colors.blue].includes(color)
                ? this.colors.white
                : this.colors.black
            );

            currentRect.set('fill', color);
          }
        }
      }
    } else {
      // No active object, set the color as default for the next object to be added
      this.selectedColor = color;
    }
    this.canvasFabric.requestRenderAll(); // Render the canvas after changes
  }

  /**
   * Sets the selected tool for the canvas editing.
   * @param tool - The tool to be selected.
   */
  setSelectedTool(tool: string) {
    this.selectedTool = tool;
  }

  /**
   * Brings the active object to the front of the canvas.
   * If no object is active or the object is already at the front, does nothing.
   */
  bringToFront() {
    const activeObject = this.canvasFabric.getActiveObject();
    // Check if there is an active object
    if (activeObject) {
      // Check if the object is not already at the front
      if (!this.getIsFront) {
        // Send the active object to the back
        this.canvasFabric.bringObjectToFront(activeObject);

        // Render the canvas after changes
        this.canvasFabric.requestRenderAll();

        // Deselect the active object
        this.canvasFabric.discardActiveObject();
      }
    }
  }

  /**
   * Sends the active object to the back of the canvas.
   * If no object is active or the object is already at the back, does nothing.
   */
  sendToBack() {
    const activeObject = this.canvasFabric.getActiveObject();
    // Check if there is an active object
    if (activeObject) {
      // Check if the object is not already at the back
      if (!this.getIsBack) {
        // Send the active object to the back
        this.canvasFabric.sendObjectToBack(activeObject);

        // Render the canvas after changes
        this.canvasFabric.requestRenderAll();

        // Deselect the active object
        this.canvasFabric.discardActiveObject();
      }
    }
  }
  /**
   * Converts an SVG string to a Data URL.
   * @param svgString - The SVG string to convert.
   * @returns The Data URL representing the SVG image.
   */
  convertSvgToDataURL(svgString: string): string {
    return 'data:image/svg+xml,' + encodeURIComponent(svgString);
  }

  /**
   * Renders a delete icon on the canvas.
   * @param bg - Determines whether to render a background behind the icon.
   * @returns A function to render the delete icon on the canvas.
   */
  renderDeleteIcon(bg: string) {
    // const svgIcon = ``;

    // // Convert SVG to Data URL
    // const rotateIcon = this.convertSvgToDataURL(svgIcon);
    const deleteIcon = this.convertSvgToDataURL(
      `<svg xmlns="http://www.w3.org/2000/svg" width="25" height="24" viewBox="0 0 25 24" fill="none">
  <circle cx="12.0156" cy="12" r="12" fill="#D9D9D9"/>
  <path d="M13.5351 5.3335C14.109 5.3335 14.6186 5.70074 14.8 6.24519L15.1628 7.3335H17.349C17.7172 7.3335 18.0156 7.63198 18.0156 8.00016C18.0156 8.36834 17.7172 8.66682 17.349 8.66683L17.3473 8.71433L16.769 16.8093C16.6943 17.856 15.8234 18.6668 14.7742 18.6668H9.25712C8.20784 18.6668 7.33696 17.856 7.2622 16.8093L6.68399 8.71433C6.68285 8.6984 6.68228 8.68256 6.68226 8.66683C6.31408 8.66682 6.01562 8.36834 6.01562 8.00016C6.01562 7.63198 6.31411 7.3335 6.68229 7.3335H8.86845L9.23122 6.24519C9.41271 5.70074 9.92223 5.3335 10.4961 5.3335H13.5351ZM16.014 8.66683H8.01733L8.59214 16.7143C8.61706 17.0632 8.90736 17.3335 9.25712 17.3335H14.7742C15.1239 17.3335 15.4142 17.0632 15.4391 16.7143L16.014 8.66683ZM10.6823 10.6668C11.0242 10.6668 11.306 10.9242 11.3445 11.2557L11.349 11.3335V14.6668C11.349 15.035 11.0505 15.3335 10.6823 15.3335C10.3404 15.3335 10.0586 15.0761 10.0201 14.7446L10.0156 14.6668V11.3335C10.0156 10.9653 10.3141 10.6668 10.6823 10.6668ZM13.349 10.6668C13.7172 10.6668 14.0156 10.9653 14.0156 11.3335V14.6668C14.0156 15.035 13.7172 15.3335 13.349 15.3335C12.9808 15.3335 12.6823 15.035 12.6823 14.6668V11.3335C12.6823 10.9653 12.9808 10.6668 13.349 10.6668ZM13.5351 6.66683H10.4961L10.2739 7.3335H13.7574L13.5351 6.66683Z" fill="#F11E1E"/>
</svg>`
    );
    const icon = document.createElement('img');
    icon.src = deleteIcon;

    const renderIcon = (
      ctx: CanvasRenderingContext2D,
      left: number,
      top: number,
      styleOverride: any,
      fabricObject: FabricObject
    ) => {
      const size = window.innerWidth < 900 ? 80 : 40;
      // Render background behind the icon if specified

      if (bg == 'bgtrue') {
        //left + size/2, top + size/2, size/2, 0, 2 * Math.PI, false
        ctx.save();
        ctx.beginPath();
        ctx.arc(left, top, size / 2 + 12, 0, 2 * Math.PI, false);
        ctx.shadowColor = '#00000055';
        ctx.shadowBlur = 4;
        ctx.fillStyle = this.colors.gray;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.restore();
      }
      // Render the delete icon

      ctx.save();
      ctx.translate(left, top);
      ctx.rotate(util.degreesToRadians(fabricObject.angle!));
      ctx.drawImage(icon, -size / 2, -size / 2, size, size);
      ctx.restore();
    };
    return renderIcon;
  }

  /**
   * Renders a rotate icon on the canvas.
   * @param bg - Determines whether to render a background behind the icon.
   * @returns A function to render the rotate icon on the canvas.
   */
  renderRotateIcon(bg: string) {
    const rotateIcon = this
      .convertSvgToDataURL(`<svg xmlns="http://www.w3.org/2000/svg" width="25" height="25" viewBox="0 0 25 25" fill="none">
<circle cx="12.0156" cy="12.6992" r="12" fill="#D9D9D9"/>
<path d="M4.10159 12.7629C4.09664 12.0795 4.82222 11.6884 5.38227 11.9905L5.45753 12.036L7.5775 13.4644C8.34755 13.9833 7.87651 15.1611 6.9967 15.0531L6.90427 15.0372L6.06244 14.8525C6.7438 16.7339 8.30312 18.2618 10.3807 18.8185C13.4136 19.6311 16.5239 18.0982 17.7823 15.3313C17.9634 14.9334 18.4328 14.7575 18.8307 14.9384C19.2288 15.1195 19.4046 15.5889 19.2236 15.9868C17.65 19.4467 13.7637 21.3642 9.97088 20.3479C6.80118 19.4985 4.60034 16.842 4.17616 13.7868C4.12937 13.4498 4.10416 13.1079 4.10159 12.7629ZM4.8163 9.41498C6.38994 5.95514 10.2762 4.0377 14.069 5.05398C17.2388 5.90331 19.4396 8.55983 19.8638 11.615C19.9106 11.952 19.9357 12.294 19.9383 12.6389C19.9433 13.3223 19.2177 13.7135 18.6576 13.4113L18.5824 13.3658L16.4623 11.9374C15.6923 11.4185 16.1633 10.2408 17.043 10.3487L17.1355 10.3645L17.9774 10.5492C17.296 8.6679 15.7367 7.14003 13.6592 6.58337C10.6264 5.7707 7.51602 7.30365 6.25756 10.0705C6.07655 10.4685 5.60716 10.6444 5.20917 10.4634C4.81118 10.2824 4.63529 9.81298 4.8163 9.41498Z" fill="black"/>
</svg>`);

    const icon = document.createElement('img');
    icon.src = rotateIcon;

    const renderIcon = (
      ctx: CanvasRenderingContext2D,
      left: number,
      top: number,
      styleOverride: any,
      fabricObject: FabricObject
    ) => {
      const size = window.innerWidth < 900 ? 80 : 40;
      // Render background behind the icon if specified

      if (bg == 'bgtrue') {
        //left + size/2, top + size/2, size/2, 0, 2 * Math.PI, false
        ctx.save();
        ctx.beginPath();
        ctx.arc(left, top, size / 2 + 12, 0, 2 * Math.PI, false);
        ctx.shadowColor = '#00000055';
        ctx.shadowBlur = 4;
        ctx.fillStyle = this.colors.gray;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.restore();
      }
      // Render the rotate icon

      ctx.save();
      ctx.translate(left, top);
      ctx.rotate(util.degreesToRadians(fabricObject.angle!));
      ctx.drawImage(icon, -size / 2, -size / 2, size, size);
      ctx.restore();
    };

    return renderIcon;
  }

  /**
   * Deletes the selected object(s) from the canvas.
   * @param eventData The mouse event data associated with the deletion action.
   * @param transform The transformation data of the selected object(s).
   * @param x The x-coordinate of the mouse pointer.
   * @param y The y-coordinate of the mouse pointer.
   * @returns A boolean indicating the success of the deletion operation.
   */
  deleteObject(
    eventData: TPointerEvent,
    transform: Transform,
    x: number,
    y: number
  ): boolean {
    console.log(eventData, x, y);
    // Extract the target object and canvas from the transform

    const target = transform.target as any;
    const canvas = target.canvas;
    // Check if the target is a group or active selection

    if (
      target.type.toLowerCase() === 'group' ||
      target.type.toLowerCase() === 'activeSelection'
    ) {
      // If the target is a group or active selection, remove it from the canvas

      canvas?.remove(target);
      // Get individual objects within the group

      const groupObjects = target?.getObjects();
      // Iterate over each object in the group and remove them from the canvas

      groupObjects?.forEach((obj: any) => {
        canvas?.remove(obj);
      });
    } else {
      // If the target is an individual object, remove it from the canvas

      canvas?.remove(target);
      canvas?.requestRenderAll();
    }
    // Discard the active object to ensure no object remains selected after deletion

    canvas?.discardActiveObject();
    // Return true to indicate successful deletion

    return true;
  }

  /**
   * Sets the selected sub-tool based on the provided type and tool.
   * @param type The type of sub-tool ('draw', 'tag', 'text').
   * @param tool The specific tool selected within the type.
   */
  setSelectedSubTool(type: string, tool: string) {
    if (type === this.subToolType.draw) {
      const draw1 = `<svg xmlns="http://www.w3.org/2000/svg" width="43" height="42" viewBox="0 0 43 42" fill="none"><path d="M41.2932 5.12231C42.4648 3.95074 42.4648 2.05125 41.2932 0.879666C40.1216 -0.291916 38.2222 -0.291927 37.0506 0.879638L41.2932 5.12231ZM0.171875 39.0005C0.171863 40.6573 1.515 42.0005 3.17185 42.0005L30.1719 42.0007C31.8287 42.0007 33.1719 40.6575 33.1719 39.0007C33.1719 37.3438 31.8287 36.0007 30.1719 36.0007L6.17189 36.0005L6.17206 12.0005C6.17207 10.3437 4.82893 9.0005 3.17208 9.00049C1.51522 9.00047 0.172068 10.3436 0.172057 12.0005L0.171875 39.0005ZM37.0506 0.879638L1.05057 36.8792L5.29318 41.1218L41.2932 5.12231L37.0506 0.879638Z" fill="${this.selectedColor}"/></svg>`;
      const draw2 = `<svg xmlns="http://www.w3.org/2000/svg" width="41" height="40" viewBox="0 0 41 40" fill="none"><path d="M39.5861 3.41447C40.3671 2.63342 40.3671 1.36709 39.5861 0.586041C38.8051 -0.195015 37.5387 -0.195023 36.7577 0.586021L39.5861 3.41447ZM0.171391 38.0002C0.171383 39.1048 1.06681 40.0002 2.17138 40.0002L20.1714 40.0004C21.2759 40.0004 22.1714 39.1049 22.1714 38.0004C22.1714 36.8958 21.276 36.0004 20.1714 36.0004L4.17141 36.0003L4.17151 20.0003C4.17152 18.8957 3.2761 18.0002 2.17153 18.0002C1.06696 18.0002 0.171522 18.8957 0.171514 20.0002L0.171391 38.0002ZM36.7577 0.586021L0.757187 36.586L3.58559 39.4145L39.5861 3.41447L36.7577 0.586021Z" fill="${this.selectedColor}"/></svg>`;
      const draw3 = `<svg width="41" height="40" viewBox="0 0 41 40" fill="none" xmlns="http://www.w3.org/2000/svg">
<path fill-rule="evenodd" clip-rule="evenodd" d="M32.0497 1.36871C32.9423 2.26135 32.9423 3.7086 32.0496 4.60123L4.62074 32.0298C3.7281 32.9224 2.28085 32.9224 1.38822 32.0297C0.495586 31.1371 0.495596 29.6898 1.38824 28.7972L28.8171 1.36869C29.7098 0.476055 31.157 0.476064 32.0497 1.36871Z" fill="${this.selectedColor}"/>
</svg>
`;
      const draw4 = `<svg width="41" height="40" viewBox="0 0 41 40" fill="none" xmlns="http://www.w3.org/2000/svg">
<path fill-rule="evenodd" clip-rule="evenodd" d="M32.2505 0.918594C32.8754 1.54344 32.8753 2.55652 32.2505 3.18136L3.45015 31.9813C2.8253 32.6062 1.81222 32.6062 1.18738 31.9813C0.562535 31.3565 0.562542 30.3434 1.18739 29.7185L29.9877 0.918578C30.6126 0.293736 31.6257 0.293743 32.2505 0.918594Z" fill="${this.selectedColor}"/>
</svg>
`;
      const draw5 = `<svg width="158" height="126" viewBox="0 0 158 126" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2.03125" y="2.28442" width="153.102" height="121.633" stroke="${this.selectedColor}" stroke-width="10"/></svg>`;
      // Render the selected draw tool based on the tool name

      if (tool === 'draw-1') {
        this.handleRenderDraw(draw1, 'draw-1');
      }

      if (tool === 'draw-2') {
        this.handleRenderDraw(draw2, 'draw-2');
      }

      if (tool === 'draw-3') {
        this.handleRenderDraw(draw3, 'draw-3');
      }

      if (tool === 'draw-4') {
        this.handleRenderDraw(draw4, 'draw-4');
      }

      if (tool === 'draw-5') {
        this.handleRenderDraw(draw5, 'draw-5');
      }
    }

    // Handling for tag tools

    if (type === this.subToolType.tag) {
      // Extracting tag number from tool name

      const tag = Number(tool.replace('tag-', ''));

      const canvas = this.canvasFabric;
      // SVG definition for tag icon

      const tagSvg = `<svg
                xmlns="http://www.w3.org/2000/svg"
                width="62"
                height="33"
                viewBox="0 0 62 33"
                fill="none"
              >
                <path

                  d="M11.5717 1.31677C11.9501 0.821685 12.5376 0.53125 13.1607 0.53125H59.9266C61.0312 0.53125 61.9266 1.42668 61.9266 2.53125V30.5312C61.9266 31.6358 61.0312 32.5312 59.9266 32.5312H13.1607C12.5376 32.5312 11.9501 32.2408 11.5717 31.7457L0.871652 17.7457C0.323701 17.0288 0.323701 16.0337 0.871653 15.3168L11.5717 1.31677Z"
                  fill="${this.selectedColor}"
                />
              </svg>`;
      // Load SVG as fabric object

      loadSVGFromURL(this.convertSvgToDataURL(tagSvg)).then(
        ({ objects, options }) => {
          const objectId = uuidv4();
          // Creating SVG object
          const svgObject = util.groupSVGElements(objects as any, options);
          svgObject.set({
            left: canvas.width! / 2 - svgObject.width! / 2,
            top: canvas.height! / 2 - svgObject.height! / 2,
          });

          svgObject.set('id', objectId);
          // Creating text object for the tag

          const text = new FabricText(this.tags[tag], {
            fontSize: 16,

            fill: [this.colors.black, this.colors.blue].includes(
              this.selectedColor
            )
              ? this.colors.white
              : this.colors.black,
          });
          // Positioning text relative to SVG

          text.set({
            left:
              svgObject.left! +
              svgObject.getScaledWidth() / 2 -
              svgObject.getScaledWidth() / 2 -
              text.getScaledWidth() / 2 +
              32,
            top:
              svgObject.top! +
              svgObject.getScaledHeight() / 2 -
              svgObject.getScaledHeight() / 2 +
              text.getScaledHeight() / 2 -
              2,
          });
          // Creating group with SVG and text

          const group = new Group([svgObject, text], {
            ...this.groupConfig,
          });

          group.setControlsVisibility(this.hideControls);
          group.scale(this.zoomFactor / this.getZoomValue());
          canvas.discardActiveObject();
          // Adding group to canvas

          canvas.add(group);
          canvas.viewportCenterObject(group);
          canvas.setActiveObject(group);
          canvas.renderAll();
          canvas.requestRenderAll();
        }
      );
    }

    // Handling for text tools

    if (type === this.subToolType.text) {
      const canvas = this.canvasFabric;
      // SVG definition for text icon

      const tagSvg = `<svg
  xmlns="http://www.w3.org/2000/svg"
  width="62"
  height="33"
  viewBox="0 0 62 33"
  fill="none"
>
  <rect
    x="0.5"
    y="0.5"
    width="61"
    height="32"
    rx="5"
    ry="5"
    fill="${this.selectedColor}"
    stroke="none"
    stroke-width="1"
  />
</svg>`;
      // Load SVG as fabric object

      loadSVGFromURL(this.convertSvgToDataURL(tagSvg)).then(
        ({ objects, options }) => {
          // Create IText object for text editing
          const objectId = uuidv4();

          const text = new IText('กขค..', {
            id: objectId,
            fontSize: 16,
            textAlign: 'center',
            fill:
              tool === 'text-bg'
                ? [this.colors.black, this.colors.blue].includes(
                    this.selectedColor
                  )
                  ? this.colors.white
                  : this.colors.black
                : this.selectedColor,
          });
          // Handling for text without background

          if (tool === 'text-no-bg') {
            text.set({
              ...this.groupConfig,
            });

            text.setControlsVisibility(this.hideControls);
            text.scale(this.zoomFactor / this.getZoomValue());
            canvas.discardActiveObject();
            canvas.add(text);
            canvas.viewportCenterObject(text);
            canvas.setActiveObject(text);

            text.on('editing:entered', () => {
              canvas.setActiveObject(text);
              this.isGroupEditing = false;
              text.enterEditing();
              text.selectAll();
              canvas.renderAll();
            });

            text.on('editing:exited', () => {
              if (!text.text) {
                text.set('text', 'กขค..');
              }
            });
          }
          // Handling for text with background

          if (tool === 'text-bg') {
            const svgObject = util.groupSVGElements(objects as any, options);
            svgObject.id = objectId;
            svgObject.set({
              selectable: false,
            });

            // Position the SVG at the center of the image

            // Double-click event handler
            canvas.viewportCenterObject(svgObject);
            text.set({
              left: svgObject.getCenterPoint().x - text.getScaledWidth() / 2,
              top: svgObject.getCenterPoint().y - text.getScaledHeight() / 2,
            });
            const group = new Group([svgObject, text], {
              ...this.groupConfig,
            });

            group.setControlsVisibility(this.hideControls);
            group.scale(this.zoomFactor / this.getZoomValue());
            canvas.add(group);
            canvas.setActiveObject(group);
            canvas.viewportCenterObject(group);

            // ungroup objects in group
            group.on(
              'mousedown',
              this.fabricDblClick(group, () => {
                this.isGroupEditing = true;
                this.unGroup(group);

                canvas.setActiveObject(text);
                text.enterEditing();
                text.selectAll();

                text.on('changed', function () {
                  svgObject.set({
                    width: text.width! + 25,
                    height: text.height! + 14,
                  });
                });

                canvas.renderAll();
              })
            );

            text.on('editing:exited', () => {
              if (!text.text) {
                text.set('text', 'กขค..');
                svgObject.set({
                  width: text.width! + 25,
                  height: text.height! + 14,
                });
              }
              this.deleteGroup([svgObject, text]);
              const group = new Group([svgObject, text], {
                ...this.groupConfig,
              });
              group.setControlsVisibility(this.hideControls);

              canvas.add(group);
              group.on(
                'mousedown',
                this.fabricDblClick(group, () => {
                  this.unGroup(group);
                  this.isGroupEditing = true;
                  canvas.setActiveObject(text);
                  text.enterEditing();
                  text.selectAll();
                })
              );
              this.isGroupEditing = false;
            });
          }
          canvas.renderAll();
          canvas.requestRenderAll();
        }
      );
    }
  }

  /**
   * Handles rendering of the drawing tool on the canvas.
   * @param svg The SVG string representing the drawing tool.
   * @param type The type of drawing tool being rendered.
   */
  handleRenderDraw(svg: string, type: string) {
    const canvas = this.canvasFabric;
    // Load SVG from URL

    loadSVGFromURL(this.convertSvgToDataURL(svg)).then(
      ({ objects, options }) => {
        const objectId = uuidv4();

        const svgObject = util.groupSVGElements(objects as any, options);
        // Set group configuration and lock scaling flip for certain types
        svgObject.set({
          ...this.groupConfig,
          lockScalingFlip: type === 'draw-5' ? true : false,
        });
        svgObject.id = objectId;
        // Determine visibility of controls based on type
        const hideControl =
          type === 'draw-5'
            ? { ...this.hideControls, ml: true, mr: true, mt: true, mb: true }
            : this.hideControls;
        // Set controls visibility for the SVG object
        svgObject.setControlsVisibility(hideControl);
        svgObject.set('draw');
        svgObject.scale(this.zoomFactor / this.getZoomValue());
        // Add SVG object to canvas
        canvas.discardActiveObject();
        canvas.add(svgObject);
        canvas.viewportCenterObject(svgObject);
        canvas.setActiveObject(svgObject);
        canvas.renderAll();
        canvas.requestRenderAll();
      }
    );
  }

  async saveCanvas() {
    this.loadingService.show();
    this.isSaveLoading = true;
    // Asynchronously call handleOnSaveImages method
    await this.handleOnSaveImages();
  }

  async handleOnSaveImages() {
    this.resetZoom();
    try {
      // Discard active object and render canvas

      this.canvasFabric.discardActiveObject();
      this.canvasFabric.renderAll(); // Notify that an async operation is running

      // Convert canvas to data URL and fetch blob data

      const jsonToString = JSON.stringify(this.canvasFabric?.toJSON());
      const canvasDataUrl = this.canvasFabric.toDataURL({
        format: 'jpeg',
        multiplier: 1, // Set the multiplier to 1 for the original resolution
      });
      const res = await fetch(canvasDataUrl);
      const blob = await res.blob();
      // Create a file from the blob data

      const file = new File([blob], 'canvas_image.jpeg', {
        type: 'image/jpeg',
      });
      // Create a FormData object and append data

      const formData = new FormData();
      formData.append('File', file);
      formData.append('Damage', jsonToString);
      // Update damage photo using image editor service
      console.log(formData);

      localStorage.setItem('damage', jsonToString);
      setTimeout(() => {
        this.isSaveLoading = false;
        this.loadingService.clear();
      }, 500);
      return formData;
    } catch (error) {
      // Handle errors, clear loading indicators, and notify async operation completion

      console.error('Error:', error);

      return error;
    }
  }

  handleClear() {
    // Remove all objects from the canvas

    this.canvasFabric.remove(...this.canvasFabric.getObjects());
  }

  /**
   * Handles the click event on the tool container.
   * @param event - The click event object.
   */
  handleToolContainerClick(event: any) {
    // Prevents the default behavior of the click event.

    event.preventDefault();
  }
  /**
   * Handles the click event on the header.
   * @param event - The click event object.
   */
  handleHeaderClick(event: any) {
    // Prevents the default behavior of the click event.

    event.preventDefault();
  }

  /**
   * Determines whether the current canvas viewport transforms are equal to the original transforms.
   * @returns A boolean indicating whether the transforms are equal.
   */
  get areTransformsEqual(): boolean {
    // Compare each value of the original and current canvas viewport transforms.

    return this.originalCanvasViewport.every(
      (val, index) => val === this.currentCanvasViewport[index]
    );
  }

  /**
   * Determines whether the active object is the frontmost object on the canvas.
   * @returns A boolean indicating whether the active object is the frontmost object.
   */
  get getIsFront() {
    // Retrieve the active object from the canvas.

    const activeObject: any = this.canvasFabric?.getActiveObject();
    let isFront = true;
    // Check if there is an active object.

    if (activeObject) {
      // Retrieve the array of objects on the canvas.

      const objects = this.canvasFabric.getObjects();
      // Calculate the index of the frontmost object.

      const lastIndex = objects.length - 1;
      // Retrieve the frontmost object.

      const frontObject = objects[lastIndex];
      // Check if the active object is the frontmost object.

      isFront = activeObject === frontObject;
    }
    return isFront;
  }

  /**
   * Checks whether the active object on the canvas is the background object.
   * @returns A boolean indicating whether the active object is the background object.
   */
  get getIsBack() {
    // Retrieve the active object from the canvas.

    const activeObject: any = this.canvasFabric?.getActiveObject();
    // Initialize a variable to store the result.

    let isBack = true;
    // Check if there is an active object.

    if (activeObject) {
      // Get all objects on the canvas.

      const objects = this.canvasFabric.getObjects();
      // Get the first object, which is considered the background object.

      const backObject = objects[0];
      // Compare the active object with the background object.

      isBack = activeObject === backObject;
    }
    // Return whether the active object is the background object.

    return isBack;
  }

  /**
   * Retrieves the active object on the canvas.
   * @returns The active object on the canvas, or null if there is no active object.
   */
  get isActiveObject() {
    // Retrieve the active object from the canvas.
    return this.canvasFabric?.getActiveObject();
  }
  /**
   * Determines whether the "Clear" action should be disabled based on the number of objects on the canvas.
   * @returns A boolean indicating whether the "Clear" action should be disabled.
   */ get isDisabledClear() {
    // Retrieve the array of objects on the canvas and check its length.
    // If the length is 0, the "Clear" action should be disabled.
    return this.canvasFabric?.getObjects()?.length === 0;
  }

  fit() {
    this._percentageValue = 100;

    this.updateZoomLevel();
  }
  get zoomLevel(): number {
    return this._zoomLevel;
  }

  private updateZoomLevel() {
    // Map the percentageValue to the desired zoom range (e.g., 1 to 2)
    this.zoomLevel = 1 + (this._percentageValue - 100) / 100;
    this.handleZoom(this.zoomLevel);
  }

  set zoomLevel(value: number) {
    this._zoomLevel = value;
  }

  zoomOut() {
    this._percentageValue = Math.max(100, this.percentageValue - 10);

    this.updateZoomLevel();
  }

  zoomIn() {
    this._percentageValue = Math.min(200, this.percentageValue + 10);
    this.updateZoomLevel();
  }

  get percentageValue(): number {
    return this._percentageValue;
  }

  set percentageValue(value: number) {
    this._percentageValue = value;
    this.updateZoomLevel();
  }

  handleDownload() {
    // Reset zoom and prepare canvas for download
    this.resetZoom();
    this.canvasFabric.discardActiveObject();
    this.canvasFabric.renderAll();

    // Convert canvas to data URL
    this.canvasFabric.getElement().toBlob((blob) => {
      if (blob) {
        // Create a temporary object URL for the Blob
        const url = URL.createObjectURL(blob);

        // Create a link element for download
        const link = document.createElement('a');
        link.href = url;
        link.download = 'canvas-image.jpeg'; // Set the default download filename

        // Trigger the download by simulating a click on the link
        link.click();

        // Revoke the object URL after the download starts to release memory
        URL.revokeObjectURL(url);
      }
    }, 'image/jpeg');
  }
}
