import axios from 'axios';

// Get credentials from environment variables
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

// Get the domain from environment variables with proper domain construction
const getRedirectUri = (requestHost?: string) => {
  try {
    if (requestHost) {
      // Parse and reconstruct the URI to ensure it's properly formatted
      const sanitizedHost = requestHost
        .replace(/:[0-9]+$/, '') // Remove any port number
        .replace(/^https?:\/\//, ''); // Remove protocol if present

      const redirectUri = `https://${sanitizedHost}/api/callback/spotify`;
      console.log('Generating Spotify auth URL with redirect URI:', redirectUri);
      return redirectUri;
    }

    console.warn('No host provided, using development redirect URI');
    return process.env.SPOTIFY_REDIRECT_URI || 'http://localhost:5000/api/callback/spotify';
  } catch (error) {
    console.error('Error generating redirect URI:', error);
    throw error;
  }
};

// Validate Spotify credentials are present
if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
  console.error('Missing required Spotify credentials');
  console.error('Please ensure you have set up your Spotify app correctly');
}

interface SpotifyError {
  status: 'error';
  error: string;
}

interface SpotifyNotProvided {
  status: 'not_provided';
}

interface SpotifySuccess {
  status: 'success';
  topArtists: string[];
  topGenres: string[];
  recentTracks: Array<{
    name: string;
    artist: string;
    playedAt?: string;
  }>;
}

type SpotifyResult = SpotifySuccess | SpotifyError | SpotifyNotProvided;

class SpotifyClient {
  private static instance: SpotifyClient;
  private constructor() {}

  static getInstance(): SpotifyClient {
    if (!SpotifyClient.instance) {
      SpotifyClient.instance = new SpotifyClient();
    }
    return SpotifyClient.instance;
  }

  getAuthUrl(state?: string, requestHost?: string): string {
    if (!SPOTIFY_CLIENT_ID) {
      throw new Error('SPOTIFY_CLIENT_ID is not configured');
    }

    try {
      const redirectUri = getRedirectUri(requestHost);
      console.log('Generating Spotify auth URL with redirect URI:', redirectUri);

      const scopes = [
        'user-read-recently-played',
        'user-top-read',
        'playlist-read-private'
      ];

      const params = new URLSearchParams({
        client_id: SPOTIFY_CLIENT_ID,
        response_type: 'code',
        redirect_uri: redirectUri,
        scope: scopes.join(' '),
        ...(state && { state })
      });

      const authUrl = `https://accounts.spotify.com/authorize?${params.toString()}`;
      console.log('Generated Spotify Auth URL:', authUrl);
      return authUrl;
    } catch (error) {
      console.error('Error generating Spotify auth URL:', error);
      throw new Error('Failed to generate Spotify authorization URL');
    }
  }

  async getAccessToken(code: string, requestHost?: string): Promise<string> {
    const redirectUri = getRedirectUri(requestHost);
    console.log('Getting access token with redirect URI:', redirectUri);

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri
    });

    try {
      const response = await axios.post('https://accounts.spotify.com/api/token',
        params.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + Buffer.from(
              SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET
            ).toString('base64')
          }
        }
      );

      return response.data.access_token;
    } catch (error) {
      console.error('Failed to get Spotify access token:', error);
      if (axios.isAxiosError(error) && error.response) {
        throw new Error(`Spotify authentication failed: ${error.response.data.error_description || error.response.data.error}`);
      }
      throw new Error('Failed to authenticate with Spotify');
    }
  }

  async getUserData(accessToken: string): Promise<SpotifyResult> {
    try {
      const [topArtists, recentTracks] = await Promise.all([
        this.getTopArtists(accessToken),
        this.getRecentlyPlayed(accessToken)
      ]);

      // Extract unique genres from top artists
      const genres = new Set<string>();
      topArtists.items.forEach((artist: any) => {
        artist.genres.forEach((genre: string) => genres.add(genre));
      });

      return {
        status: 'success',
        topArtists: topArtists.items.slice(0, 5).map((artist: any) => artist.name),
        topGenres: Array.from(genres).slice(0, 5),
        recentTracks: recentTracks.items.slice(0, 10).map((item: any) => ({
          name: item.track.name,
          artist: item.track.artists[0].name,
          playedAt: item.played_at
        }))
      };
    } catch (error) {
      console.error('Failed to fetch Spotify user data:', error);
      if (axios.isAxiosError(error) && error.response) {
        return {
          status: 'error',
          error: `Spotify API error: ${error.response.data.error?.message || error.response.data.error}`
        };
      }
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to fetch Spotify data'
      };
    }
  }

  private async getTopArtists(accessToken: string) {
    const response = await axios.get('https://api.spotify.com/v1/me/top/artists', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      params: {
        limit: 20,
        time_range: 'medium_term'
      }
    });
    return response.data;
  }

  private async getRecentlyPlayed(accessToken: string) {
    const response = await axios.get('https://api.spotify.com/v1/me/player/recently-played', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      params: {
        limit: 50
      }
    });
    return response.data;
  }
}

export const spotifyClient = SpotifyClient.getInstance();