import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HmPage } from './hm.page';

describe('HmPage', () => {
  let component: HmPage;
  let fixture: ComponentFixture<HmPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(HmPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
