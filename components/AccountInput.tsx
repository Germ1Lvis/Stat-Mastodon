
import React from 'react';

interface AccountInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: () => void;
  isLoading: boolean;
}

const AccountInput: React.FC<AccountInputProps> = ({ value, onChange, onSubmit, isLoading }) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 mb-8">
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder="Ex: Gargron@mastodon.social"
        className="flex-grow bg-brand-surface border border-gray-600 rounded-md py-3 px-4 text-brand-text placeholder-brand-text-secondary focus:outline-none focus:ring-2 focus:ring-mastodon-purple"
        disabled={isLoading}
      />
      <button
        type="submit"
        disabled={isLoading}
        className="bg-mastodon-purple text-white font-bold py-3 px-6 rounded-md hover:bg-opacity-90 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-brand-bg focus:ring-mastodon-purple disabled:bg-gray-500 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Chargement...' : 'Récupérer les Stats'}
      </button>
    </form>
  );
};

export default AccountInput;
