import { XAccount, Tweet } from '../types';

interface FetchResult {
  account: XAccount;
  tweets: Tweet[];
}

// Toutes les instances (Nitter et LibreTwitter) sont regroupées car elles partagent la même API
// et les mêmes problèmes de fiabilité. Les essayer en un seul lot mélangé est plus efficace.
// La liste a été étendue pour maximiser les chances de trouver une instance fonctionnelle.
const ALL_INSTANCES = [
  // Nitter Instances
  'nitter.net', 'nitter.it', 'nitter.d420.de', 'nitter.rawbit.ch', 
  'nitter.poast.org', 'nitter.projectgold.xyz', 'nitter.moomoo.me', 
  'nitter.privacy.com.de', 'nitter.mint.lgbt', 'nitter.kylrth.com', 
  'nitter.ch', 'nitter.x86-64-unknown-linux-gnu.zip', 'nitter.unixfox.eu', 
  'nitter.freedit.eu', 'nitter.no-logs.com', 'nitter.tux.pizza', 
  'nitter.one', 'nitter.inpt.fr', 'nitter.drivet.xyz', 'nitter.cz',
  'nitter.namazso.eu', 'nitter.lunar.icu', 'nitter.soopy.moe',
  'nitter.qwik.space', 'nitter.fediflix.org', 'nitter.nohost.network',
  'nitter.esmailelbob.xyz', 'nitter.services.woodland.cafe', 'nitter.actionsack.com',
  'nitter.koyu.space', 'nitter.nicfab.eu', 'nitter.foss.wtf', 'nitter.private.coffee',
  'nitter.sethforprivacy.com', 'nitter.dafriser.be', 'nitter.perennialte.ch',

  // LibreTwitter Instances
  'lt.vern.cc', 'libretwitter.freedit.eu', 'twitter.dr460nf1r3.org',
  'twitter.projectsegfau.lt', 'twitter.pomf.se', 'twitter.moe.ngo'
];


// Utilisation d'un proxy CORS. Si des erreurs "Failed to fetch" apparaissent,
// il est probable qu'il faille le remplacer par une alternative.
const PROXY_URL = 'https://corsproxy.io/?';
const X_USERNAME = 'PogScience';

const proxify = (url: string) => `${PROXY_URL}${encodeURIComponent(url)}`;

const shuffleArray = <T>(array: T[]): T[] => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

async function fetchFromInstance(instanceHost: string, apiPath: string, cursor: string | null): Promise<any> {
  const baseUrl = `https://${instanceHost}`;
  let apiUrl = `${baseUrl}/${apiPath}`;
  if (cursor) {
    apiUrl += `?cursor=${encodeURIComponent(cursor)}`;
  }
  
  const proxiedUrl = proxify(apiUrl);
  
  const response = await fetch(proxiedUrl, { cache: 'no-store' });
  
  if (!response.ok) {
    throw new Error(`Instance ${instanceHost} a échoué avec le statut : ${response.status}`);
  }

  const textContent = await response.text();
  try {
    const data = JSON.parse(textContent);
    // Les avatars sont des chemins relatifs, il faut les rendre absolus
    if (data.profile?.avatar) {
        data.profile.avatar = `${baseUrl}${data.profile.avatar}`;
    }
    return data;
  } catch (e) {
      console.error(`Erreur de parsing JSON depuis ${instanceHost}`, textContent);
      throw new Error(`Réponse non-JSON reçue de l'instance ${instanceHost}.`);
  }
}

// Les formats de Nitter et LibreTwitter sont très similaires, une seule fonction de mapping suffit
const mapApiTweetToTweet = (apiTweet: any): Tweet => {
  const createdAt = new Date(apiTweet.date).toISOString();
  return {
    id: apiTweet.id,
    created_at: createdAt,
    text: apiTweet.text,
    url: `https://x.com/${apiTweet.author.username}/status/${apiTweet.id}`,
    reply_count: apiTweet.stats.replies,
    retweet_count: apiTweet.stats.retweets,
    like_count: apiTweet.stats.likes,
    view_count: 0,
    user: {
      id_str: apiTweet.author.id,
      screen_name: apiTweet.author.username,
    },
  };
};


export async function fetchXAccountAndTweets(
  startDate?: string,
  endDate?: string
): Promise<FetchResult> {
  
  let allTweets: Tweet[] = [];
  let account: XAccount | null = null;
  const errors: string[] = [];
  
  const shuffledInstances = shuffleArray([...ALL_INSTANCES]);
  const API_PATH = `${X_USERNAME}/json`;
  
  for (const instance of shuffledInstances) {
      let cursor: string | null = null;
      let pagesFetched = 0;
      const MAX_PAGES_TO_FETCH = 50; 
      const DELAY_BETWEEN_REQUESTS_MS = 300;
      
      try {
        console.log(`Tentative avec l'instance : ${instance}`);
        let rawData = await fetchFromInstance(instance, API_PATH, null);
        console.log(`Connecté avec succès à l'instance : ${instance}`);
        
        const localTweets: Tweet[] = [];

        // Logique de pagination
        while (pagesFetched < MAX_PAGES_TO_FETCH) {
           if (!account && rawData.profile) {
              const profile = rawData.profile;
              account = {
                id_str: profile.id, name: profile.name, screen_name: profile.username,
                profile_image_url_https: profile.avatar.replace('_normal', '_400x400'),
                followers_count: profile.stats.followers, friends_count: profile.stats.following,
                statuses_count: profile.stats.tweets,
              };
            }

            const rawTweets = rawData.timeline;
            if (!rawTweets || rawTweets.length === 0) break;

            const startFilter = startDate ? new Date(`${startDate}T00:00:00.000Z`) : null;
            const endFilter = endDate ? new Date(`${endDate}T23:59:59.999Z`) : null;
            let shouldStopFetching = false;

            for (const rawTweet of rawTweets) {
              const tweet = mapApiTweetToTweet(rawTweet);
              const tweetDate = new Date(tweet.created_at);
              if (startFilter && tweetDate < startFilter) {
                shouldStopFetching = true; break;
              }
              const isAfterStart = startFilter ? tweetDate >= startFilter : true;
              const isBeforeEnd = endFilter ? tweetDate <= endFilter : true;
              if (isAfterStart && isBeforeEnd) localTweets.push(tweet);
            }

            if (shouldStopFetching) break;
            
            cursor = rawData.min_position;
            if (!cursor) break;
            
            pagesFetched++;
            await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS_MS));
            
            const nextPageData = await fetchFromInstance(instance, API_PATH, cursor);
            Object.assign(rawData, { timeline: nextPageData.timeline, min_position: nextPageData.min_position });
        }
        allTweets = localTweets;

        // Si nous avons réussi, nous pouvons retourner le résultat immédiatement
        if (account) {
          return { account, tweets: allTweets };
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push(errorMessage);
        console.warn(`Échec de l'instance ${instance}:`, errorMessage);
      }
    }
  
  // Si nous arrivons ici, toutes les instances ont échoué
  console.error("Échec de toutes les instances pour X:", JSON.stringify(errors, null, 2));

  throw new Error("Échec de la récupération des données de X. En raison de changements récents apportés par X/Twitter, les services alternatifs comme Nitter sont devenus extrêmement instables et ne fonctionnent plus de manière fiable. Cette fonctionnalité est susceptible de ne pas aboutir.");
}