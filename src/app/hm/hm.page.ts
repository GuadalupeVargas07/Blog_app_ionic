import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { 
  IonHeader, 
  IonToolbar, 
  IonTitle, 
  IonContent 
} from '@ionic/angular';

@Component({
  selector: 'app-hm',
  templateUrl: './hm.page.html',
  styleUrls: ['./hm.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent
  ]
})
export class HmPage implements OnInit {

  constructor() { }

  ngOnInit() {
  }

}