import { Component } from '@angular/core';
import { NgFor } from '@angular/common';
import { RouterLink } from '@angular/router';

interface ClientStat {
  label: string;
  value: string;
}

interface ClientOrder {
  id: string;
  status: string;
  date: string;
  total: string;
}

interface ClientPreference {
  label: string;
  value: string;
}

@Component({
  selector: 'app-client-profile',
  standalone: true,
  imports: [NgFor, RouterLink],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css',
})
export class ClientProfileComponent {
  readonly stats: ClientStat[] = [
    { label: 'Commandes', value: '28' },
    { label: 'Favoris', value: '14' },
    { label: 'Points fid\u00e9lit\u00e9', value: '1 240' },
    { label: 'Coupons actifs', value: '3' },
  ];

  readonly recentOrders: ClientOrder[] = [
    { id: 'CMD-1482', status: 'Livr\u00e9e', date: '20 f\u00e9vr. 2026', total: '179 EUR' },
    { id: 'CMD-1467', status: 'En pr\u00e9paration', date: '16 f\u00e9vr. 2026', total: '69 EUR' },
    { id: 'CMD-1451', status: 'Retir\u00e9e', date: '11 f\u00e9vr. 2026', total: '115 EUR' },
  ];

  readonly preferences: ClientPreference[] = [
    { label: 'Cat\u00e9gorie favorite', value: 'Mode premium' },
    { label: 'Boutique favorite', value: 'Maison Etoile' },
    { label: 'Canal promo', value: 'Email + notifications' },
    { label: 'Paiement pr\u00e9f\u00e9r\u00e9', value: 'Carte Visa **** 1042' },
  ];
}
