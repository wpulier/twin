import axios from 'axios';
import { parseString } from 'xml2js';
import { promisify } from 'util';

const parseXml = promisify(parseString);

interface LetterboxdRating {
  title: string;
  rating: string;
  year: string;
  genres: string[];
}

interface LetterboxdSuccess {
  status: 'success';
  recentRatings: LetterboxdRating[];
  favoriteGenres: string[];
  favoriteFilms: string[];
}

interface LetterboxdError {
  status: 'error';
  error: string;
}

interface LetterboxdNotProvided {
  status: 'not_provided';
}

type LetterboxdResult = LetterboxdSuccess | LetterboxdError | LetterboxdNotProvided;

function validateLetterboxdUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname === 'letterboxd.com' && parsed.pathname.split('/').length >= 2;
  } catch {
    return false;
  }
}

function extractUsername(url: string): string {
  const path = new URL(url).pathname;
  return path.split('/')[1];
}

export async function getLetterboxdProfile(url: string): Promise<LetterboxdResult> {
  console.log('Starting Letterboxd profile fetch for URL:', url);

  try {
    if (!validateLetterboxdUrl(url)) {
      console.error('Invalid Letterboxd URL:', url);
      return {
        status: 'error',
        error: 'Invalid Letterboxd URL format'
      };
    }

    const username = extractUsername(url);
    const rssUrl = `https://letterboxd.com/${username}/rss/`;
    console.log('Fetching RSS feed from:', rssUrl);

    const response = await axios.get(rssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*'
      },
      timeout: 10000 // 10 second timeout
    });

    console.log('RSS response status:', response.status);
    console.log('RSS response type:', response.headers['content-type']);
    console.log('RSS content preview:', response.data.substring(0, 500));

    let result;
    try {
      result = await parseXml(response.data);
    } catch (parseError) {
      console.error('Failed to parse XML:', parseError);
      return {
        status: 'error',
        error: 'Invalid XML response from Letterboxd'
      };
    }

    console.log('Parsed RSS data structure:', Object.keys(result || {}));

    if (!result?.rss?.channel?.[0]) {
      console.error('Invalid RSS structure:', JSON.stringify(result, null, 2));
      return {
        status: 'error',
        error: 'Invalid RSS data structure'
      };
    }

    const channel = result.rss.channel[0];
    console.log('Channel data structure:', Object.keys(channel || {}));

    const items = channel.item || [];
    console.log('Found items:', items.length);

    if (items.length === 0) {
      console.error('No items found in RSS feed');
      return {
        status: 'error',
        error: 'No activity found in profile'
      };
    }

    // Collect all genres from all films
    const genreFrequency: { [key: string]: number } = {};

    // Process recent films
    const recentRatings = items
      .slice(0, 20) // Look at more items to get better genre data
      .map((item: any): LetterboxdRating | null => {
        try {
          const filmTitle = item['letterboxd:filmTitle']?.[0];
          const filmYear = item['letterboxd:filmYear']?.[0];
          const rating = item['letterboxd:memberRating']?.[0];
          const genres = item['letterboxd:filmGenres']?.[0]?.split(',').map((g: string) => g.trim()) || [];

          // Count genre frequencies
          genres.forEach((genre: string) => {
            genreFrequency[genre] = (genreFrequency[genre] || 0) + 1;
          });

          console.log('Processing film:', {
            title: filmTitle,
            year: filmYear,
            rating: rating,
            genres: genres
          });

          if (!filmTitle) return null;

          return {
            title: filmTitle,
            rating: rating ? `${rating}/5` : 'Watched',
            year: filmYear || '',
            genres: genres
          };
        } catch (itemError) {
          console.error('Error processing item:', itemError);
          return null;
        }
      })
      .filter((item): item is LetterboxdRating => item !== null);

    console.log('Processed ratings:', recentRatings);

    if (recentRatings.length === 0) {
      console.error('No valid ratings found in profile');
      return {
        status: 'error',
        error: 'No valid ratings found in profile'
      };
    }

    // Get favorite films (4.5+ star ratings)
    const favoriteFilms = recentRatings
      .filter(r => parseFloat(r.rating) >= 4.5)
      .map(r => r.title)
      .slice(0, 5);

    // Get favorite genres (most frequently rated genres)
    const favoriteGenres = Object.entries(genreFrequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([genre]) => genre);

    console.log('Extracted data:', {
      favoriteGenres,
      favoriteFilms,
      totalRatings: recentRatings.length
    });

    return {
      status: 'success',
      recentRatings: recentRatings.slice(0, 10), // Only return the 10 most recent
      favoriteGenres,
      favoriteFilms
    };

  } catch (error) {
    console.error('Failed to fetch Letterboxd RSS:', error);
    const errorMessage = error instanceof Error ? 
      `${error.message} (${error.name})` : 
      'Unknown error occurred';

    return {
      status: 'error',
      error: errorMessage
    };
  }
}