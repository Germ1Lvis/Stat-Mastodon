
export interface Account {
  id: string;
  username: string;
  acct: string;
  display_name: string;
  url: string;
  avatar: string;
  header: string;
  followers_count: number;
  following_count: number;
  statuses_count: number;
}

export interface Status {
  id: string;
  created_at: string;
  content: string; // This is HTML content
  url: string;
  replies_count: number;
  reblogs_count: number;
  favourites_count: number;
  account: Account;
  media_attachments: MediaAttachment[];
}

export interface MediaAttachment {
  id: string;
  type: 'image' | 'video' | 'gifv' | 'audio';
  url: string;
  preview_url: string;
  description: string | null;
}

// Types for X (Twitter)
export interface XAccount {
  id_str: string;
  name: string;
  screen_name: string;
  profile_image_url_https: string;
  followers_count: number;
  friends_count: number;
  statuses_count: number;
}

export interface Tweet {
  id: string;
  created_at: string;
  text: string;
  url: string;
  reply_count: number;
  retweet_count: number;
  like_count: number;
  view_count: number; // Impressions
  user: {
    id_str: string;
    screen_name: string;
  };
}
