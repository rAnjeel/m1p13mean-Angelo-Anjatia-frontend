import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

type ClientService = {
  title: string;
  description: string;
  cta: string;
  badge: string;
};

@Component({
  selector: 'app-client-services',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './services.component.html',
  styleUrls: ['./services.component.css'],
})
export class ClientServicesComponent {
  readonly trustPoints: Array<{ label: string; value: string }> = [
    { label: 'Clients satisfaits', value: '98%' },
    { label: 'Support moyen', value: '< 5 min' },
    { label: 'Litiges resolus', value: '24h' },
  ];

  readonly services: ClientService[] = [
    {
      title: 'Livraison rapide',
      description: 'Recevez vos commandes a domicile en 24h a 72h selon votre zone.',
      cta: 'Voir les zones',
      badge: 'Express',
    },
    {
      title: 'Paiement securise',
      description: 'Paiement protege avec verification et suivi de chaque transaction.',
      cta: 'Moyens de paiement',
      badge: 'Protection',
    },
    {
      title: 'Support client',
      description: 'Une equipe disponible pour vous assister avant et apres achat.',
      cta: 'Contacter le support',
      badge: 'Assistance',
    },
    {
      title: 'Retours simplifies',
      description: 'Retour possible sous 7 jours selon les conditions du vendeur.',
      cta: 'Politique de retour',
      badge: 'Flexible',
    },
  ];

  getServiceInitial(value: string): string {
    const safe = String(value || '').trim();
    return safe ? safe.charAt(0).toUpperCase() : 'S';
  }
}
