import { Account, Status } from '../types';

interface FetchResult {
  account: Account;
  statuses: Status[];
}

// Liste de proxies CORS pour améliorer la fiabilité.
// Chaque fonction prend une URL et retourne une URL "proxifiée".
const PROXIES = [
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://thingproxy.freeboard.io/fetch/${url}`,
];

// Instance publique et fiable utilisée pour "résoudre" les identifiants Mastodon et obtenir l'ID canonique d'un compte.
// mastodon.social est utilisé car c'est l'une des plus grandes instances, garantissant la meilleure couverture fédérée possible.
const RESOLVER_INSTANCE = 'mastodon.social';

const shuffleArray = <T>(array: T[]): T[] => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

async function fetchWithProxyFallbacks(url: string, options: RequestInit): Promise<Response> {
    const shuffledProxies = shuffleArray([...PROXIES]);
    const errors: string[] = [];

    for (const proxyBuilder of shuffledProxies) {
        const proxiedUrl = proxyBuilder(url);
        const proxyHost = new URL(proxiedUrl).hostname;
        try {
            console.log(`Tentative de fetch via le proxy : ${proxyHost}`);
            const response = await fetch(proxiedUrl, options);
            if (!response.ok) {
                throw new Error(`La requête via le proxy a échoué avec le statut : ${response.status}`);
            }
            console.log(`Fetch réussi avec le proxy : ${proxyHost}`);
            return response;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.warn(`Échec du fetch avec le proxy ${proxyHost}. Erreur : ${errorMessage}`);
            errors.push(`${proxyHost}: ${errorMessage}`);
        }
    }

    throw new Error(`Tous les proxies CORS ont échoué. Impossible de récupérer les données. Erreurs : ${errors.join('; ')}`);
}


export async function fetchAccountAndStatuses(
  username: string,
  instance: string, // L'instance d'origine du compte, ex: bsky.brid.gy
  startDate?: string,
  endDate?: string
): Promise<FetchResult> {
  try {
    const fullHandle = `${username}@${instance}`;
    
    // Étape 1 : Utiliser un résolveur public pour obtenir l'ID du compte.
    const lookupApiUrl = `https://${RESOLVER_INSTANCE}/api/v1/accounts/lookup?acct=${fullHandle}`;
    
    const lookupResponse = await fetchWithProxyFallbacks(lookupApiUrl, { cache: 'no-store' });

    if (!lookupResponse.ok) { // Cette vérification est techniquement redondante avec fetchWithProxyFallbacks mais gardée pour la robustesse
        let errorDetails = `statut: ${lookupResponse.status}`;
        try {
            const errorBody = await lookupResponse.json();
            errorDetails = errorBody.error || JSON.stringify(errorBody);
        } catch (e) { /* no-op */ }
        throw new Error(`Le compte ${fullHandle} n'a pas pu être trouvé via le résolveur public (${RESOLVER_INSTANCE}). L'API a retourné une erreur. ${errorDetails}`);
    }

    const account: Account = await lookupResponse.json();
    
    if (account.acct.toLowerCase() !== fullHandle.toLowerCase() && account.acct.toLowerCase() !== username.toLowerCase()) {
        throw new Error(`Un compte a été trouvé, mais une vérification de sécurité a échoué. Attendu: ${fullHandle}, Reçu: ${account.acct}.`);
    }

    // Étape 2 : Préparer et effectuer la requête pour les statuts avec une pagination manuelle robuste.
    const allStatuses: Status[] = [];
    const MAX_PAGES_TO_FETCH = 50; 
    const DELAY_BETWEEN_REQUESTS_MS = 300;
    let pagesFetched = 0;
    
    const baseStatusesUrl = `https://${RESOLVER_INSTANCE}/api/v1/accounts/${account.id}/statuses`;
    const baseParams = new URLSearchParams({
        limit: '40',
        exclude_replies: 'true',
        exclude_reblogs: 'true',
    });
    
    let currentParams = new URLSearchParams(baseParams);

    // Préparation pour la logique de filtrage côté client et l'optimisation de l'arrêt.
    const startFilter = startDate ? new Date(`${startDate}T00:00:00.000Z`) : null;
    const endFilter = endDate ? new Date(`${endDate}T23:59:59.999Z`) : null;
    
    while (pagesFetched < MAX_PAGES_TO_FETCH) {
      const statusesApiUrl = `${baseStatusesUrl}?${currentParams.toString()}`;
      const statusesResponse = await fetchWithProxyFallbacks(statusesApiUrl, { cache: 'no-store' });

      if (!statusesResponse.ok) {
        throw new Error(`Erreur lors de la récupération des posts depuis ${RESOLVER_INSTANCE}. statut: ${statusesResponse.status}`);
      }
      
      const pageStatuses: Status[] = await statusesResponse.json();
      if (pageStatuses.length === 0) {
        break; // Plus de posts à charger, fin de la pagination.
      }
      
      let shouldStopFetching = false;
      for (const status of pageStatuses) {
        const statusDate = new Date(status.created_at);
        
        // Optimisation : si on atteint un post plus ancien que la date de début, on peut arrêter.
        if (startFilter && statusDate < startFilter) {
          shouldStopFetching = true;
          break;
        }

        // Filtrage côté client : garantit que seuls les posts strictement dans la plage sont conservés.
        const isAfterStart = startFilter ? statusDate >= startFilter : true;
        const isBeforeEnd = endFilter ? statusDate <= endFilter : true;
        
        if (isAfterStart && isBeforeEnd) {
          allStatuses.push(status);
        }
      }

      if (shouldStopFetching) {
        break;
      }
      
      // Préparer la page suivante en utilisant l'ID du dernier statut (max_id).
      // C'est la méthode de pagination la plus fiable.
      const lastId = pageStatuses[pageStatuses.length - 1].id;
      currentParams.set('max_id', lastId);
      
      pagesFetched++;
      
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS_MS));
    }

    return { account, statuses: allStatuses };

  } catch (error) {
    console.error("Mastodon API Error:", error);
    if (error instanceof Error) {
        if (error.message.includes('Tous les proxies CORS ont échoué')) {
            throw new Error("La connexion au service Mastodon a échoué. Tous les services proxy utilisés sont probablement hors ligne ou inaccessibles. Veuillez réessayer plus tard.");
        }
        throw new Error(error.message);
    }
    throw new Error('Une erreur réseau ou API inattendue est survenue.');
  }
}
