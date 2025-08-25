
import React from 'react';
import { Status } from '../types';
import { ReplyIcon, RepostIcon, LikeIcon } from '../constants';
import StatIcon from './StatIcon';

interface PostCardProps {
  status: Status;
}

const PostCard: React.FC<PostCardProps> = ({ status }) => {
  const formattedDate = new Date(status.created_at).toLocaleString('fr-FR', {
    dateStyle: 'long',
    timeStyle: 'short',
  });

  return (
    <div className="bg-brand-surface rounded-xl shadow-lg p-5 border border-gray-700 hover:border-mastodon-purple transition-colors duration-300">
      <div className="flex items-center mb-4">
        <a href={status.account.url} target="_blank" rel="noopener noreferrer" className="flex items-center">
          <img src={status.account.avatar} alt="avatar" className="w-12 h-12 rounded-full mr-4" />
          <div>
            <p className="font-bold text-brand-text">{status.account.display_name}</p>
            <p className="text-sm text-brand-text-secondary">@{status.account.acct}</p>
          </div>
        </a>
      </div>
      
      {/* For security in a real-world app, use a library like DOMPurify to sanitize this HTML. */}
      <div
        className="prose prose-invert prose-sm max-w-none text-brand-text prose-a:text-mastodon-purple hover:prose-a:underline"
        dangerouslySetInnerHTML={{ __html: status.content }}
      />

       {status.media_attachments.length > 0 && (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {status.media_attachments.map(attachment => (
            attachment.type === 'image' && (
              <a key={attachment.id} href={attachment.url} target="_blank" rel="noopener noreferrer">
                <img 
                  src={attachment.preview_url} 
                  alt={attachment.description || 'Post media'} 
                  className="rounded-lg w-full h-auto object-cover"
                />
              </a>
            )
          ))}
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-gray-700 flex justify-between items-center text-brand-text-secondary">
        <div className="flex gap-6">
          <StatIcon icon={<ReplyIcon />} value={status.replies_count} label="Réponses" />
          <StatIcon icon={<RepostIcon />} value={status.reblogs_count} label="Reposts" />
          <StatIcon icon={<LikeIcon />} value={status.favourites_count} label="Favoris" />
        </div>
        <a href={status.url} target="_blank" rel="noopener noreferrer" className="text-sm hover:text-mastodon-purple transition-colors">
          {formattedDate}
        </a>
      </div>
    </div>
  );
};

export default PostCard;
