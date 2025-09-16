
import React, { useState, useCallback, useMemo } from 'react';
import { Account as MastodonAccount, Status as MastodonStatus, XAccount, Tweet } from './types';
import { fetchAccountAndStatuses } from './services/mastodonService';
import { fetchXAccountAndTweets } from './services/xService';
import Loader from './components/Loader';
import ErrorMessage from './components/ErrorMessage';
import StatCard from './components/StatCard';
import { MastodonLogo } from './constants';

declare var XLSX: any;

type ActiveTab = 'mastodon' | 'x';

const App: React.FC = () => {
  // Mastodon state
  const [statuses, setStatuses] = useState<MastodonStatus[]>([]);
  const [mastodonAccount, setMastodonAccount] = useState<MastodonAccount | null>(null);

  // X (Twitter) state
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [xAccount, setXAccount] = useState<XAccount | null>(null);

  // Shared state
  const [activeTab, setActiveTab] = useState<ActiveTab>('mastodon');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const handleSearch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setMastodonAccount(null);
    setStatuses([]);
    setXAccount(null);
    setTweets([]);

    if (activeTab === 'mastodon') {
      const mastodonHandle = 'pogscience.bsky.social@bsky.brid.gy';
      const handleRegex = /^([a-zA-Z0-9_.]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})$/;
      const match = mastodonHandle.match(handleRegex);

      if (!match) {
        setError("L'identifiant du compte Mastodon pré-configuré est invalide.");
        setIsLoading(false);
        return;
      }
      const [, username, instance] = match;

      try {
        const data = await fetchAccountAndStatuses(username, instance, startDate, endDate);
        setMastodonAccount(data.account);
        setStatuses(data.statuses);
      } catch (err) {
        if (err instanceof Error) setError(err.message);
        else setError('Une erreur inconnue est survenue.');
      } finally {
        setIsLoading(false);
      }
    } else { // activeTab === 'x'
      try {
        const data = await fetchXAccountAndTweets(startDate, endDate);
        setXAccount(data.account);
        setTweets(data.tweets);
      } catch (err) {
        if (err instanceof Error) setError(err.message);
        else setError('Une erreur inconnue est survenue lors de la récupération des données de X.');
      } finally {
        setIsLoading(false);
      }
    }
  }, [startDate, endDate, activeTab]);
  
  const stripHtml = (html: string) => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || "";
  };

  const hasMedia = (status: MastodonStatus): boolean => status.media_attachments.length > 0;
  const countLinks = (content: string): number => (stripHtml(content).match(/https?:\/\/[^\s]+/g) || []).length;
  const countHashtags = (content: string): number => (stripHtml(content).match(/#\w+/g) || []).length;

  const handleExport = () => {
    if (typeof XLSX === 'undefined') {
      setError("Impossible d'exporter les données. La bibliothèque d'exportation n'a pas pu être chargée.");
      return;
    }

    let dataToExport: any[] = [];
    let filename = 'stats.xlsx';
    let sheetName = 'Statistiques';

    if (activeTab === 'mastodon' && mastodonAccount) {
      dataToExport = statuses.map(status => ({
        'Date': new Date(status.created_at).toLocaleString('fr-FR'),
        'Contenu': stripHtml(status.content),
        'Réponses': status.replies_count,
        'Reposts': status.reblogs_count,
        'Favoris': status.favourites_count,
        'Média': hasMedia(status) ? 'Oui' : 'Non',
        'Liens': countLinks(status.content),
        'Hashtags': countHashtags(status.content),
        'Lien': status.url
      }));
      filename = `${mastodonAccount.acct.replace('@', '_')}_mastodon_stats.xlsx`;
      sheetName = 'Stats Mastodon';
    } else if (activeTab === 'x' && xAccount) {
      dataToExport = tweets.map(tweet => ({
        'Date': new Date(tweet.created_at).toLocaleString('fr-FR'),
        'Contenu': tweet.text,
        'Réponses': tweet.reply_count,
        'Retweets': tweet.retweet_count,
        'Likes': tweet.like_count,
        'Lien': tweet.url
      }));
      filename = `${xAccount.screen_name}_x_stats.xlsx`;
      sheetName = 'Stats X';
    }

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, filename);
  };

  const summaryStats = useMemo(() => {
    if (activeTab === 'mastodon') {
      if (statuses.length === 0) return null;
      return {
        totalPosts: statuses.length,
        totalReplies: statuses.reduce((sum, s) => sum + s.replies_count, 0),
        totalReposts: statuses.reduce((sum, s) => sum + s.reblogs_count, 0),
        totalFavourites: statuses.reduce((sum, s) => sum + s.favourites_count, 0),
        postsWithMedia: statuses.filter(hasMedia).length,
        postsWithLinks: statuses.filter(s => countLinks(s.content) > 0).length,
      };
    } else { // activeTab === 'x'
      if (tweets.length === 0) return null;
      return {
        totalPosts: tweets.length,
        totalReplies: tweets.reduce((sum, t) => sum + t.reply_count, 0),
        totalRetweets: tweets.reduce((sum, t) => sum + t.retweet_count, 0),
        totalLikes: tweets.reduce((sum, t) => sum + t.like_count, 0),
      };
    }
  }, [statuses, tweets, activeTab]);
  
  const isSearchDisabled = isLoading || !startDate || !endDate;
  const isExportDisabled = isLoading || (activeTab === 'mastodon' && statuses.length === 0) || (activeTab === 'x' && tweets.length === 0);

  const renderAccountInfo = () => {
    if (activeTab === 'mastodon' && mastodonAccount) {
      return (
        <div className="my-8 p-4 bg-brand-surface rounded-lg flex items-center gap-4">
          <img src={mastodonAccount.avatar} alt={`${mastodonAccount.display_name}'s avatar`} className="w-16 h-16 rounded-full border-2 border-mastodon-purple" />
          <div>
            <h2 className="text-2xl font-bold">{mastodonAccount.display_name}</h2>
            <p className="text-brand-text-secondary">@{mastodonAccount.acct}</p>
          </div>
        </div>
      );
    }
    if (activeTab === 'x' && xAccount) {
      return (
        <div className="my-8 p-4 bg-brand-surface rounded-lg flex items-center gap-4">
          <img src={xAccount.profile_image_url_https} alt={`${xAccount.name}'s avatar`} className="w-16 h-16 rounded-full border-2 border-blue-400" />
          <div>
            <h2 className="text-2xl font-bold">{xAccount.name}</h2>
            <p className="text-brand-text-secondary">@{xAccount.screen_name}</p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-brand-bg font-sans p-4 sm:p-6 md:p-8">
      <div className="max-w-6xl mx-auto">
        <header className="text-center mb-8">
          <div className="flex items-center justify-center gap-4 mb-2">
            <MastodonLogo className="h-12 w-12 text-mastodon-purple" />
            <h1 className="text-4xl sm:text-5xl font-bold text-brand-text tracking-tight">
              Social Stats Viewer
            </h1>
          </div>
          <p className="text-brand-text-secondary text-lg">
            Statistiques des posts pour @pogscience
          </p>
        </header>

        <main>
          <div className="mb-6 border-b border-gray-700">
            <nav className="-mb-px flex space-x-6" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('mastodon')}
                className={`${activeTab === 'mastodon' ? 'border-mastodon-purple text-mastodon-purple' : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-lg transition-colors`}
              >
                Mastodon
              </button>
              <button
                onClick={() => setActiveTab('x')}
                className={`${activeTab === 'x' ? 'border-blue-400 text-blue-400' : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-lg transition-colors`}
              >
                X (Twitter)
              </button>
            </nav>
          </div>
          
          {activeTab === 'x' && (
            <div className="bg-yellow-900/50 border border-yellow-700 text-yellow-200 px-4 py-3 rounded-lg my-6 flex items-start gap-3" role="alert">
              <div>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <strong className="font-bold">Avertissement de Fiabilité</strong>
                <p className="text-sm mt-1">
                  Les données de X sont récupérées via des services publics (Nitter) qui sont devenus très instables suite aux récentes modifications de l'API de X/Twitter. La recherche a de fortes chances d'échouer.
                </p>
              </div>
            </div>
          )}

          <div className="my-6 p-4 bg-brand-surface rounded-lg flex flex-col sm:flex-row items-center justify-between gap-4 flex-wrap">
              <div className="flex flex-col sm:flex-row gap-4 items-center">
                  <label htmlFor="startDate" className="text-brand-text-secondary font-medium">Du :</label>
                  <input type="date" id="startDate" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-brand-bg border border-gray-600 rounded-md py-2 px-3 text-brand-text focus:outline-none focus:ring-2 focus:ring-mastodon-purple" aria-label="Date de début" disabled={isLoading}/>
                  <label htmlFor="endDate" className="text-brand-text-secondary font-medium">Au :</label>
                  <input type="date" id="endDate" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-brand-bg border border-gray-600 rounded-md py-2 px-3 text-brand-text focus:outline-none focus:ring-2 focus:ring-mastodon-purple" aria-label="Date de fin" disabled={isLoading} />
              </div>
              <div className="flex gap-4">
                  <button onClick={handleSearch} disabled={isSearchDisabled} className="bg-mastodon-purple text-white font-bold py-2 px-4 rounded-md hover:bg-opacity-90 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-brand-bg focus:ring-mastodon-purple disabled:bg-gray-500 disabled:cursor-not-allowed">
                      {isLoading ? 'Recherche...' : 'Rechercher'}
                  </button>
                  <button onClick={handleExport} disabled={isExportDisabled} className="bg-green-600 text-white font-bold py-2 px-4 rounded-md hover:bg-green-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-brand-bg focus:ring-green-500 disabled:bg-gray-500 disabled:cursor-not-allowed">
                      Exporter en Excel
                  </button>
              </div>
          </div>

          {isLoading && <Loader />}
          {error && <ErrorMessage message={error} />}
          
          {!isLoading && !error && !mastodonAccount && !xAccount && (
            <div className="text-center py-12 bg-brand-surface/50 rounded-lg">
              <p className="text-brand-text-secondary text-xl">Veuillez sélectionner une période et lancer une recherche.</p>
            </div>
          )}

          {!isLoading && (renderAccountInfo())}
          
          {summaryStats && activeTab === 'mastodon' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
              <StatCard title="Posts" value={summaryStats.totalPosts} />
              <StatCard title="Total Réponses" value={summaryStats.totalReplies} />
              <StatCard title="Total Reposts" value={summaryStats.totalReposts} />
              <StatCard title="Total Favoris" value={summaryStats.totalFavourites} />
              <StatCard title="Posts avec Média" value={summaryStats.postsWithMedia} />
              <StatCard title="Posts avec Liens" value={summaryStats.postsWithLinks} />
            </div>
          )}
          
          {summaryStats && activeTab === 'x' && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <StatCard title="Tweets" value={summaryStats.totalPosts} />
              <StatCard title="Total Réponses" value={summaryStats.totalReplies} />
              <StatCard title="Total Retweets" value={summaryStats.totalRetweets} />
              <StatCard title="Total Likes" value={summaryStats.totalLikes} />
            </div>
          )}

          {activeTab === 'mastodon' && mastodonAccount && !isLoading && (
            statuses.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-gray-700">
                <table className="min-w-full divide-y divide-gray-700">
                  <thead className="bg-brand-surface">
                    <tr>
                      <th scope="col" className="py-3.5 px-4 text-left text-sm font-semibold text-brand-text">Date</th>
                      <th scope="col" className="py-3.5 px-4 text-left text-sm font-semibold text-brand-text">Contenu (extrait)</th>
                      <th scope="col" className="py-3.5 px-4 text-center text-sm font-semibold text-brand-text">Réponses</th>
                      <th scope="col" className="py-3.5 px-4 text-center text-sm font-semibold text-brand-text">Reposts</th>
                      <th scope="col" className="py-3.5 px-4 text-center text-sm font-semibold text-brand-text">Favoris</th>
                      <th scope="col" className="py-3.5 px-4 text-center text-sm font-semibold text-brand-text">Média</th>
                      <th scope="col" className="py-3.5 px-4 text-center text-sm font-semibold text-brand-text">Liens</th>
                      <th scope="col" className="py-3.5 px-4 text-center text-sm font-semibold text-brand-text">Hashtags</th>
                      <th scope="col" className="py-3.5 px-4 text-left text-sm font-semibold text-brand-text">Lien</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800 bg-brand-surface/50">
                    {statuses.map(status => (
                      <tr key={status.id} className="hover:bg-brand-surface/80">
                        <td className="whitespace-nowrap px-4 py-4 text-sm text-brand-text-secondary">{new Date(status.created_at).toLocaleDateString('fr-FR')}</td>
                        <td className="px-4 py-4 text-sm text-brand-text max-w-sm truncate" title={stripHtml(status.content)}>{stripHtml(status.content)}</td>
                        <td className="whitespace-nowrap px-4 py-4 text-sm text-brand-text-secondary text-center">{status.replies_count.toLocaleString('fr-FR')}</td>
                        <td className="whitespace-nowrap px-4 py-4 text-sm text-brand-text-secondary text-center">{status.reblogs_count.toLocaleString('fr-FR')}</td>
                        <td className="whitespace-nowrap px-4 py-4 text-sm text-brand-text-secondary text-center">{status.favourites_count.toLocaleString('fr-FR')}</td>
                        <td className="whitespace-nowrap px-4 py-4 text-sm text-brand-text-secondary text-center">{hasMedia(status) ? '✅' : ''}</td>
                        <td className="whitespace-nowrap px-4 py-4 text-sm text-brand-text-secondary text-center">{countLinks(status.content)}</td>
                        <td className="whitespace-nowrap px-4 py-4 text-sm text-brand-text-secondary text-center">{countHashtags(status.content)}</td>
                        <td className="whitespace-nowrap px-4 py-4 text-sm"><a href={status.url} target="_blank" rel="noopener noreferrer" className="text-mastodon-purple hover:underline">Voir</a></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : ( <div className="text-center py-12 bg-brand-surface/50 rounded-lg"><p className="text-brand-text-secondary text-xl">Aucun post trouvé pour la période sélectionnée.</p></div> )
          )}

          {activeTab === 'x' && xAccount && !isLoading && (
            tweets.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-gray-700">
                <table className="min-w-full divide-y divide-gray-700">
                  <thead className="bg-brand-surface">
                    <tr>
                      <th scope="col" className="py-3.5 px-4 text-left text-sm font-semibold text-brand-text">Date</th>
                      <th scope="col" className="py-3.5 px-4 text-left text-sm font-semibold text-brand-text">Contenu</th>
                      <th scope="col" className="py-3.5 px-4 text-center text-sm font-semibold text-brand-text">Réponses</th>
                      <th scope="col" className="py-3.5 px-4 text-center text-sm font-semibold text-brand-text">Retweets</th>
                      <th scope="col" className="py-3.5 px-4 text-center text-sm font-semibold text-brand-text">Likes</th>
                      <th scope="col" className="py-3.5 px-4 text-left text-sm font-semibold text-brand-text">Lien</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800 bg-brand-surface/50">
                    {tweets.map(tweet => (
                      <tr key={tweet.id} className="hover:bg-brand-surface/80">
                        <td className="whitespace-nowrap px-4 py-4 text-sm text-brand-text-secondary">{new Date(tweet.created_at).toLocaleDateString('fr-FR')}</td>
                        <td className="px-4 py-4 text-sm text-brand-text max-w-sm truncate" title={tweet.text}>{tweet.text}</td>
                        <td className="whitespace-nowrap px-4 py-4 text-sm text-brand-text-secondary text-center">{tweet.reply_count.toLocaleString('fr-FR')}</td>
                        <td className="whitespace-nowrap px-4 py-4 text-sm text-brand-text-secondary text-center">{tweet.retweet_count.toLocaleString('fr-FR')}</td>
                        <td className="whitespace-nowrap px-4 py-4 text-sm text-brand-text-secondary text-center">{tweet.like_count.toLocaleString('fr-FR')}</td>
                        <td className="whitespace-nowrap px-4 py-4 text-sm"><a href={tweet.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Voir</a></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : ( <div className="text-center py-12 bg-brand-surface/50 rounded-lg"><p className="text-brand-text-secondary text-xl">Aucun tweet trouvé pour la période sélectionnée.</p></div> )
          )}

        </main>
         <footer className="text-center mt-12 text-brand-text-secondary text-sm">
          <p>Créé avec React, TypeScript, et Tailwind CSS.</p>
        </footer>
      </div>
    </div>
  );
};

export default App;