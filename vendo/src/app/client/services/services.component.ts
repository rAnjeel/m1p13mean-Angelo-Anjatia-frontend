import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

type ClientService = {
  title: string;
  description: string;
  cta: string;
};

@Component({
  selector: 'app-client-services',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './services.component.html',
  styleUrl: './services.component.css',
})
export class ClientServicesComponent {
  readonly services: ClientService[] = [
    {
      title: 'Livraison rapide',
      description: 'Recevez vos commandes a domicile en 24h a 72h selon votre zone.',
      cta: 'Voir les zones',
    },
    {
      title: 'Paiement securise',
      description: 'Paiement protege avec verification et suivi de chaque transaction.',
      cta: 'Moyens de paiement',
    },
    {
      title: 'Support client',
      description: 'Une equipe disponible pour vous assister avant et apres achat.',
      cta: 'Contacter le support',
    },
    {
      title: 'Retours simplifies',
      description: 'Retour possible sous 7 jours selon les conditions du vendeur.',
      cta: 'Politique de retour',
    },
  ];
}
