import { useEffect, useState } from 'react';
import Parser from 'rss-parser';
import { Newspaper, X } from 'lucide-react';

const CORS_PROXY = 'https://api.allorigins.win/get?url=';
const RSS_URL = 'https://news.blizzard.com/en-us/diablo3/feed';

interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
}

export default function NewsButton() {
  const [news, setNews] = useState<NewsItem | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const checkNews = async () => {
      try {
        const parser = new Parser();
        const response = await fetch(CORS_PROXY + encodeURIComponent(RSS_URL));
        const json = await response.json();
        const feed = await parser.parseString(json.contents);

        // Show latest news (debug: show first item regardless of title)
        const latestNews = feed.items[0];

        if (latestNews) {
          setNews({
            title: latestNews.title || 'Diablo 3 News',
            link: latestNews.link || '#',
            pubDate: latestNews.pubDate || ''
          });
        }
      } catch (err) {
        console.error('Failed to fetch news:', err);
      }
    };
    checkNews();
  }, []);

  if (!news || dismissed) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-bounce">
      <div
        className="d3-card p-3 flex items-center gap-3 shadow-2xl"
        style={{
          background: 'var(--gold-dark)',
          border: '1px solid var(--gold-bright)',
        }}
      >
        <Newspaper className="h-5 w-5" style={{ color: '#0a0908' }} />
        <div className="flex flex-col">
          <span className="text-xs font-bold" style={{ color: '#0a0908' }}>New Season Announcement!</span>
          <a
            href={news.link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-mono-diablo underline"
            style={{ color: '#0a0908' }}
            onClick={() => {
              localStorage.setItem('d3_news_dismissed', news.link);
              setDismissed(true);
            }}
          >
            Read more...
          </a>
        </div>
        <button
          onClick={() => {
            localStorage.setItem('d3_news_dismissed', news.link);
            setDismissed(true);
          }}
          className="ml-2 p-1 hover:bg-black/20 rounded-full"
        >
          <X className="h-4 w-4" style={{ color: '#0a0908' }} />
        </button>
      </div>
    </div>
  );
}
