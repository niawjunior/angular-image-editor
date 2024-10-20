/* tslint:disable:no-unused-variable */
import { ComponentFixture, TestBed } from "@angular/core/testing"

import { ImageEditorComponent } from "./image-editor.component"

describe("ImageEditorComponent", () => {
  let component: ImageEditorComponent
  let fixture: ComponentFixture<ImageEditorComponent>

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ImageEditorComponent],
    }).compileComponents()
  })

  beforeEach(() => {
    fixture = TestBed.createComponent(ImageEditorComponent)
    component = fixture.componentInstance
    fixture.detectChanges()
  })

  it("should create", () => {
    expect(component).toBeTruthy()
  })
})
