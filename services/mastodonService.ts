import { Account, Status } from './types';

interface FetchResult {
  account: Account;
  statuses: Status[];
}

// Utilisation d'un proxy CORS pour contourner les restrictions de sécurité des navigateurs.
const PROXY_URL = 'https://corsproxy.io/?';
// Utiliser une instance publique fiable pour résoudre les comptes fédérés.
const RESOLVER_INSTANCE = 'mas.to';

// Fonction d'aide pour créer une URL passant par le proxy
const proxify = (url: string) => `${PROXY_URL}${encodeURIComponent(url)}`;

// Fonction d'aide pour analyser l'en-tête 'Link' pour la pagination
function parseLinkHeader(linkHeader: string | null): { next?: string } {
  if (!linkHeader) {
    return {};
  }
  const links: { [key: string]: string } = {};
  const entries = linkHeader.split(',');
  entries.forEach(entry => {
    const match = entry.match(/<(.+?)>; rel="(.+?)"/);
    if (match) {
      const [, url, rel] = match;
      links[rel] = url;
    }
  });
  return links;
}

export async function fetchAccountAndStatuses(
  username: string,
  instance: string, // L'instance d'origine du compte, ex: bsky.brid.gy
  startDate?: string,
  endDate?: string
): Promise<FetchResult> {
  try {
    const fullHandle = `${username}@${instance}`;
    
    // Étape 1 : Utiliser le résolveur public pour obtenir l'ID du compte de manière fiable.
    const lookupApiUrl = `https://${RESOLVER_INSTANCE}/api/v1/accounts/lookup?acct=${fullHandle}`;
    const lookupUrl = proxify(lookupApiUrl);
    
    const lookupResponse = await fetch(lookupUrl);

    if (!lookupResponse.ok) {
        let errorDetails = `statut: ${lookupResponse.status}`;
        try {
            const errorBody = await lookupResponse.json();
            errorDetails = errorBody.error || JSON.stringify(errorBody);
        } catch (e) { /* no-op */ }
        throw new Error(`Le compte ${fullHandle} n'a pas pu être trouvé via le résolveur (${RESOLVER_INSTANCE}). L'API a retourné une erreur. ${errorDetails}`);
    }

    const account: Account = await lookupResponse.json();
    
    // Vérification de sécurité pour s'assurer que le compte retourné est le bon.
    if (account.acct.toLowerCase() !== fullHandle.toLowerCase() && account.acct.toLowerCase() !== username.toLowerCase()) {
        throw new Error(`Un compte a été trouvé, mais une vérification de sécurité a échoué. Attendu: ${fullHandle}, Reçu: ${account.acct}.`);
    }

    // Étape 2 : Récupérer les statuts via le résolveur public, car l'ID n'est valide que sur cette instance.
    const allStatuses: Status[] = [];
    const MAX_PAGES_TO_FETCH = 50; 
    const DELAY_BETWEEN_REQUESTS_MS = 300;
    let pagesFetched = 0;
    
    const start = startDate ? new Date(`${startDate}T00:00:00.000Z`) : null;
    const end = endDate ? new Date(`${endDate}T23:59:59.999Z`) : null;

    const statusesParams = new URLSearchParams({
        limit: '40',
    });
    
    // Utiliser l'instance de résolution pour cet appel, car l'ID du compte vient de là.
    let nextUrl: string | undefined = `https://${RESOLVER_INSTANCE}/api/v1/accounts/${account.id}/statuses?${statusesParams.toString()}`;

    while (nextUrl && pagesFetched < MAX_PAGES_TO_FETCH) {
      const statusesUrl = proxify(nextUrl);
      const statusesResponse = await fetch(statusesUrl);

      if (!statusesResponse.ok) {
        if (statusesResponse.status === 429) {
          throw new Error(`L'API a renvoyé une erreur "Too Many Requests" (429) lors de la récupération des posts. Le serveur est surchargé. Veuillez patienter avant de réessayer.`);
        }
        let errorDetails = `statut: ${statusesResponse.status}`;
        try {
            const errorBody = await statusesResponse.json();
            errorDetails = errorBody.error || JSON.stringify(errorBody);
        } catch (e) { /* no-op */ }
        throw new Error(`Erreur lors de la récupération des posts via le résolveur (${RESOLVER_INSTANCE}). ${errorDetails}`);
      }
      
      const newStatuses: Status[] = await statusesResponse.json();
      if (newStatuses.length === 0) {
        break; // Plus de statuts à récupérer
      }

      allStatuses.push(...newStatuses);
      
      // Optimisation : arrêter la pagination si on dépasse la date de début
      if (start) {
        const lastStatusDate = new Date(newStatuses[newStatuses.length - 1].created_at);
        if (lastStatusDate < start) {
          break;
        }
      }

      const linkHeader = statusesResponse.headers.get('Link');
      const links = parseLinkHeader(linkHeader);
      nextUrl = links.next;
      
      pagesFetched++;

      if (nextUrl) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS_MS));
      }
    }
    
    // Filtrage final en mémoire pour une précision parfaite
    const filteredStatuses = allStatuses.filter(status => {
      const statusDate = new Date(status.created_at);
      if (start && statusDate < start) {
        return false;
      }
      if (end && statusDate > end) {
        return false;
      }
      return true;
    });

    return { account, statuses: filteredStatuses };

  } catch (error) {
    console.error("Mastodon API Error:", error);
    if (error instanceof Error) {
        if (error.message.includes('Failed to fetch')) {
            throw new Error('Une erreur réseau est survenue. Cela peut être dû à un problème de connexion, un bloqueur de publicité, ou le proxy CORS qui est temporairement indisponible.');
        }
        throw error;
    }
    throw new Error('Une erreur inconnue est survenue.');
  }
}