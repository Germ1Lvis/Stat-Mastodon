
import React, { useState, useCallback, useMemo } from 'react';
import { Account, Status } from './types';
import { fetchAccountAndStatuses } from './services/mastodonService';
import Loader from './components/Loader';
import ErrorMessage from './components/ErrorMessage';
import StatCard from './components/StatCard';
import { MastodonLogo } from './constants';

// Déclare la variable globale XLSX pour TypeScript, car elle est chargée depuis un CDN.
declare var XLSX: any;

const App: React.FC = () => {
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [account, setAccount] = useState<Account | null>(null);
  const [isLoading, setIsLoading] = useState(false); // Ne pas charger au démarrage
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const handleSearch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setAccount(null);
    setStatuses([]);
    
    // Le compte est maintenant codé en dur pour une fiabilité maximale.
    const mastodonHandle = 'pogscience.bsky.social@bsky.brid.gy';
    const handleRegex = /^([a-zA-Z0-9_.]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})$/;
    const match = mastodonHandle.match(handleRegex);

    if (!match) {
      setError("L'identifiant du compte pré-configuré est invalide.");
      setIsLoading(false);
      return;
    }

    const [, username, instance] = match;

    try {
      const data = await fetchAccountAndStatuses(username, instance, startDate, endDate);
      setAccount(data.account);
      setStatuses(data.statuses);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Une erreur inconnue est survenue.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate]);

  const stripHtml = (html: string) => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || "";
  };

  const hasMedia = (status: Status): boolean => status.media_attachments.length > 0;
  const countLinks = (content: string): number => (stripHtml(content).match(/https?:\/\/[^\s]+/g) || []).length;
  const countHashtags = (content: string): number => (stripHtml(content).match(/#\w+/g) || []).length;
  
  const handleExport = () => {
    if (typeof XLSX === 'undefined' || !account) {
        console.error("La bibliothèque XLSX n'est pas chargée ou le compte n'est pas défini.");
        setError("Impossible d'exporter les données. La bibliothèque d'exportation n'a pas pu être chargée.");
        return;
    }
    
    const dataToExport = statuses.map(status => ({
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

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Statistiques Mastodon");
    XLSX.writeFile(workbook, `${account.acct.replace('@', '_')}_stats.xlsx`);
  };

  const summaryStats = useMemo(() => {
    if (statuses.length === 0) return null;

    return {
      totalPosts: statuses.length,
      totalReplies: statuses.reduce((sum, s) => sum + s.replies_count, 0),
      totalReposts: statuses.reduce((sum, s) => sum + s.reblogs_count, 0),
      totalFavourites: statuses.reduce((sum, s) => sum + s.favourites_count, 0),
      postsWithMedia: statuses.filter(hasMedia).length,
      postsWithLinks: statuses.filter(s => countLinks(s.content) > 0).length,
    };
  }, [statuses]);

  return (
    <div className="min-h-screen bg-brand-bg font-sans p-4 sm:p-6 md:p-8">
      <div className="max-w-6xl mx-auto">
        <header className="text-center mb-8">
          <div className="flex items-center justify-center gap-4 mb-2">
            <MastodonLogo className="h-12 w-12 text-mastodon-purple" />
            <h1 className="text-4xl sm:text-5xl font-bold text-brand-text tracking-tight">
              Mastodon Stats Viewer
            </h1>
          </div>
          <p className="text-brand-text-secondary text-lg">
            Statistiques des posts pour le compte @pogscience.bsky.social@bsky.brid.gy
          </p>
        </header>

        <main>
          <div className="my-6 p-4 bg-brand-surface rounded-lg flex flex-col sm:flex-row items-center justify-between gap-4 flex-wrap">
              <div className="flex flex-col sm:flex-row gap-4 items-center">
                  <label htmlFor="startDate" className="text-brand-text-secondary font-medium">Du :</label>
                  <input 
                      type="date" 
                      id="startDate" 
                      value={startDate} 
                      onChange={(e) => setStartDate(e.target.value)}
                      className="bg-brand-bg border border-gray-600 rounded-md py-2 px-3 text-brand-text focus:outline-none focus:ring-2 focus:ring-mastodon-purple"
                      aria-label="Date de début"
                      disabled={isLoading}
                  />
                  <label htmlFor="endDate" className="text-brand-text-secondary font-medium">Au :</label>
                  <input 
                      type="date" 
                      id="endDate" 
                      value={endDate} 
                      onChange={(e) => setEndDate(e.target.value)}
                      className="bg-brand-bg border border-gray-600 rounded-md py-2 px-3 text-brand-text focus:outline-none focus:ring-2 focus:ring-mastodon-purple"
                      aria-label="Date de fin"
                      disabled={isLoading}
                  />
              </div>
              <div className="flex gap-4">
                  <button
                      onClick={handleSearch}
                      disabled={isLoading || !startDate || !endDate}
                      className="bg-mastodon-purple text-white font-bold py-2 px-4 rounded-md hover:bg-opacity-90 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-brand-bg focus:ring-mastodon-purple disabled:bg-gray-500 disabled:cursor-not-allowed"
                  >
                      {isLoading ? 'Recherche...' : 'Rechercher'}
                  </button>
                  <button
                      onClick={handleExport}
                      disabled={statuses.length === 0 || isLoading}
                      className="bg-green-600 text-white font-bold py-2 px-4 rounded-md hover:bg-green-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-brand-bg focus:ring-green-500 disabled:bg-gray-500 disabled:cursor-not-allowed"
                  >
                      Exporter en Excel
                  </button>
              </div>
          </div>

          {isLoading && <Loader />}
          {error && <ErrorMessage message={error} />}

          {!isLoading && !error && !account && (
            <div className="text-center py-12 bg-brand-surface/50 rounded-lg">
                <p className="text-brand-text-secondary text-xl">Veuillez sélectionner une période et lancer une recherche.</p>
            </div>
          )}

          {account && !isLoading && (
            <>
              <div className="my-8 p-4 bg-brand-surface rounded-lg flex items-center gap-4">
                <img src={account.avatar} alt={`${account.display_name}'s avatar`} className="w-16 h-16 rounded-full border-2 border-mastodon-purple" />
                <div>
                  <h2 className="text-2xl font-bold">{account.display_name}</h2>
                  <p className="text-brand-text-secondary">@{account.acct}</p>
                </div>
              </div>

              {summaryStats && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
                  <StatCard title="Posts" value={summaryStats.totalPosts} />
                  <StatCard title="Total Réponses" value={summaryStats.totalReplies} />
                  <StatCard title="Total Reposts" value={summaryStats.totalReposts} />
                  <StatCard title="Total Favoris" value={summaryStats.totalFavourites} />
                  <StatCard title="Posts avec Média" value={summaryStats.postsWithMedia} />
                  <StatCard title="Posts avec Liens" value={summaryStats.postsWithLinks} />
                </div>
              )}

              {statuses.length > 0 ? (
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
                                    <td className="whitespace-nowrap px-4 py-4 text-sm">
                                        <a href={status.url} target="_blank" rel="noopener noreferrer" className="text-mastodon-purple hover:underline">Voir</a>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
              ) : (
                <div className="text-center py-12 bg-brand-surface/50 rounded-lg">
                    <p className="text-brand-text-secondary text-xl">Aucun post trouvé pour la période sélectionnée.</p>
                </div>
              )}
            </>
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
