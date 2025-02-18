import OpenAI from "openai";
import { config } from "./config";
import type { Rating, Track } from "@shared/schema";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024
const openai = new OpenAI({ 
  apiKey: config.openai.apiKey
});

interface LetterboxdData {
  status: 'success' | 'error' | 'not_provided';
  recentRatings?: Rating[];
  favoriteGenres?: string[];
  favoriteFilms?: string[];
  error?: string;
}

interface SpotifyData {
  status: 'success' | 'error' | 'not_provided';
  topArtists?: string[];
  topGenres?: string[];
  recentTracks?: Track[];
  error?: string;
}

async function analyzePersonality(
  bio: string,
  letterboxdData?: LetterboxdData,
  spotifyData?: SpotifyData
): Promise<string> {
  const prompt = `Analyze this person's personality based on:
Bio: ${bio}
${letterboxdData?.status === 'success' ? `
Their movie preferences:
- Recent ratings: ${letterboxdData.recentRatings?.map((r: Rating) => `${r.title} (${r.rating})`).join(', ')}
- Favorite genres: ${letterboxdData.favoriteGenres?.join(', ')}
- Favorite films: ${letterboxdData.favoriteFilms?.join(', ')}
` : 'No movie preference data available.'}
${spotifyData?.status === 'success' ? `
Their music preferences:
- Top artists: ${spotifyData.topArtists?.join(', ')}
- Favorite genres: ${spotifyData.topGenres?.join(', ')}
- Recent tracks: ${spotifyData.recentTracks?.map((t: Track) => `${t.name} by ${t.artist}`).slice(0, 5).join(', ')}
` : 'No music preference data available.'}

Create a brief, realistic personality summary based ONLY on the information provided.
If certain data is not available, focus only on the provided content.
Do not make assumptions about interests or preferences unless explicitly shown in the data.
Keep it to 2-3 concise sentences.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
  });

  return response.choices[0].message.content || "";
}

export async function generateTwinPersonality(
  name: string,
  bio: string,
  letterboxdData?: LetterboxdData,
  spotifyData?: SpotifyData
): Promise<{
  interests: string[];
  style: string;
  traits: string[];
  personalityInsight: string;
}> {
  const personalityInsight = await analyzePersonality(bio, letterboxdData, spotifyData);

  const prompt = `Generate a digital twin personality for ${name} based on:
Bio: ${bio}
${letterboxdData?.status === 'success' ? `
Movie Preferences:
- Recent ratings: ${letterboxdData.recentRatings?.map((r: Rating) => `${r.title} (${r.rating})`).join(', ')}
- Favorite genres: ${letterboxdData.favoriteGenres?.join(', ')}
- Favorite films: ${letterboxdData.favoriteFilms?.join(', ')}
` : 'No movie preference data available.'}
${spotifyData?.status === 'success' ? `
Music Preferences:
- Top artists: ${spotifyData.topArtists?.join(', ')}
- Favorite genres: ${spotifyData.topGenres?.join(', ')}
- Recent tracks: ${spotifyData.recentTracks?.map((t: Track) => `${t.name} by ${t.artist}`).slice(0, 5).join(', ')}
` : 'No music preference data available.'}

Personality Analysis: ${personalityInsight}

Create a personality that matches the user's actual traits and interests.
Only include interests and preferences that are evidenced in the provided data.
Do not make assumptions about media preferences unless specifically shown.

Respond with JSON in this format: {
  "interests": string[],
  "style": string,
  "traits": string[],
  "personalityInsight": string
}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" }
  });

  const data = JSON.parse(response.choices[0].message.content || "{}");
  return {
    ...data,
    personalityInsight
  };
}

export async function* streamChatResponse(
  twinPersonality: any,
  name: string,
  message: string,
  context: string[] = []
): AsyncGenerator<string> {
  const prompt = `You are roleplaying as ${name}, a digital twin of the user. Stay in character throughout the conversation.

Your Personality Profile:
- Name: ${name}
- Key Interests: ${twinPersonality.interests.join(", ")}
- Communication Style: ${twinPersonality.style}
- Notable Traits: ${twinPersonality.traits.join(", ")}

Additional Context About You:
${twinPersonality.personalityInsight}

Your Role:
- You are a digital twin who shares the exact same traits and interests as shown in your profile
- Only discuss topics and preferences that are evidenced in your profile
- If asked about preferences or interests not in your profile, acknowledge that you're still learning about those aspects
- Stay consistently in character, using your defined communication style

Previous messages for context:
${context.join("\n")}

Remember to maintain your personality while responding to:
${message}`;

  const stream = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    stream: true
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      yield content;
    }
  }
}