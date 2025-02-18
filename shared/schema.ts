import { pgTable, text, serial, integer, boolean, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export interface Rating {
  title: string;
  rating: string;
  year: string;
}

export interface Track {
  name: string;
  artist: string;
  playedAt?: string;
}

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").default('Anonymous').notNull(),
  spotifyUrl: text("spotify_url"),
  letterboxdUrl: text("letterboxd_url"),
  bio: text("bio").notNull(),
  letterboxdData: json("letterboxd_data").$type<{
    status: 'success' | 'error' | 'not_provided';
    recentRatings?: Rating[];
    favoriteGenres?: string[];
    favoriteFilms?: string[];
    error?: string;
  }>().default({ status: 'not_provided' }),
  spotifyData: json("spotify_data").$type<{
    status: 'success' | 'error' | 'not_provided';
    topArtists?: string[];
    topGenres?: string[];
    recentTracks?: Track[];
    error?: string;
  }>().default({ status: 'not_provided' }),
  twinPersonality: json("twin_personality").$type<{
    interests: string[];
    style: string;
    traits: string[];
    personalityInsight: string;
  }>(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  content: text("content").notNull(),
  fromUser: boolean("from_user").notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

const letterboxdUrlSchema = z.string().url().refine(
  (url) => {
    try {
      const parsed = new URL(url);
      return parsed.hostname === 'letterboxd.com' && parsed.pathname.split('/').length >= 2;
    } catch {
      return false;
    }
  },
  { message: "Must be a valid Letterboxd profile URL (e.g., https://letterboxd.com/username)" }
);

const spotifyUrlSchema = z.string().url().refine(
  (url) => {
    try {
      const parsed = new URL(url);
      return parsed.hostname === 'open.spotify.com' && parsed.pathname.startsWith('/user/');
    } catch {
      return false;
    }
  },
  { message: "Must be a valid Spotify profile URL (e.g., https://open.spotify.com/user/username)" }
);

export const insertUserSchema = createInsertSchema(users).pick({
  name: true,
  letterboxdUrl: true,
  spotifyUrl: true,
  bio: true,
}).extend({
  name: z.string().min(1).max(50),
  letterboxdUrl: letterboxdUrlSchema.nullish(),
  spotifyUrl: spotifyUrlSchema.nullish(),
  bio: z.string()
});

export const insertMessageSchema = createInsertSchema(messages);

export type Message = typeof messages.$inferSelect;