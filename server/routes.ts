import type { Express, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema } from "@shared/schema";
import { generateTwinPersonality, streamChatResponse } from "./openai";
import { WebSocketServer } from 'ws';
import { getLetterboxdProfile } from './letterboxd';
import { spotifyClient } from './spotify';
import session from 'express-session';
import MemoryStore from 'memorystore';
import cors from 'cors';
import helmet from 'helmet';

const MemoryStoreSession = MemoryStore(session);

declare module 'express-session' {
  interface SessionData {
    originalHost: string;
    pendingSpotifyData: any;
  }
}

export function registerRoutes(app: Express): Server {
  const httpServer = createServer(app);

  // Add Helmet middleware for security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'", "https://accounts.spotify.com", "https://*.spotify.com"],
        connectSrc: ["'self'", "https://accounts.spotify.com", "https://api.spotify.com", "ws:", "wss:"],
        formAction: ["'self'", "https://accounts.spotify.com"],
        frameAncestors: ["'none'"],
        frameSrc: ["'self'", "https://accounts.spotify.com"],
        imgSrc: ["'self'", "https://i.scdn.co", "data:", "blob:"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://accounts.spotify.com"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        workerSrc: ["'self'", "blob:"],
        manifestSrc: ["'self'"]
      }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
  }));

  // Setup CORS with specific options
  app.use(cors({
    origin: [
      /\.spotify\.com$/,
      /^https:\/\/[a-zA-Z0-9-]+-[0-9]+-[a-zA-Z0-9]+\.janeway\.replit\.dev$/
    ],
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
    exposedHeaders: ['Set-Cookie']
  }));

  // Setup session middleware with enhanced security
  app.use(session({
    store: new MemoryStoreSession({
      checkPeriod: 86400000 // prune expired entries every 24h
    }),
    secret: process.env.SESSION_SECRET || 'development_secret',
    resave: false,
    saveUninitialized: false,
    cookie: { 
      secure: true,
      sameSite: 'none',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: '/',
      httpOnly: true
    }
  }));

  // Spotify OAuth endpoints
  app.get("/api/connect/spotify", (req, res) => {
    try {
      console.log('Spotify Connect Request:', {
        headers: req.headers,
        originalUrl: req.originalUrl,
        host: req.get('host')
      });

      const state = req.query.userId as string;
      if (!state) {
        return res.status(400).json({ error: "Missing userId parameter" });
      }

      // Store current host in session for callback verification
      if (req.session) {
        req.session.originalHost = req.get('host') || '';
      }

      // Set security headers specifically for Spotify redirect
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Pragma', 'no-cache');

      const authUrl = spotifyClient.getAuthUrl(state, req.get('host'));
      console.log('Generated Spotify Auth URL:', authUrl);
      console.log('Generating Spotify auth URL with redirect URI:', `https://${req.get('host')}/api/callback/spotify`);
      return res.redirect(authUrl);
    } catch (error) {
      console.error('Error in Spotify connect:', error);
      return res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to connect to Spotify',
        details: 'An unexpected error occurred during Spotify connection'
      });
    }
  });

  app.get("/api/callback/spotify", async (req, res) => {
    console.log('Spotify callback received:', {
      code: req.query.code ? 'present' : 'missing',
      state: req.query.state,
      error: req.query.error,
      host: req.get('host'),
      fullUrl: req.originalUrl
    });

    const { code, state: userId, error } = req.query;

    if (error) {
      console.error('Spotify auth error:', error);
      return res.redirect(`/?error=${error}`);
    }

    if (!code || !userId) {
      console.error('Missing required parameters:', { code: !!code, userId: !!userId });
      return res.redirect('/?error=missing_params');
    }

    try {
      const accessToken = await spotifyClient.getAccessToken(code as string, req.get('host'));
      const spotifyData = await spotifyClient.getUserData(accessToken);

      if (userId === 'pending') {
        // Store Spotify data in session and redirect back to create form
        if (req.session) {
          req.session.pendingSpotifyData = spotifyData;
        }
        return res.redirect('/?spotify=connected');
      }

      // Update user with Spotify data
      const user = await storage.getUser(Number(userId));
      if (!user) {
        return res.redirect('/?error=user_not_found');
      }

      // Generate new twin personality with updated data
      const twin = await generateTwinPersonality(
        user.name,
        user.bio,
        user.letterboxdData?.status === 'success' ? user.letterboxdData : undefined,
        spotifyData.status === 'success' ? spotifyData : undefined
      );

      await storage.updateUser(user.id, {
        ...user,
        spotifyData
      });
      await storage.updateUserTwin(user.id, twin);

      res.redirect(`/chat/${userId}`);
    } catch (error) {
      console.error('Spotify callback error:', error);
      res.redirect('/?error=spotify_auth_failed');
    }
  });

  // Test endpoint for Letterboxd scraping
  app.get("/api/test/letterboxd", async (req, res) => {
    const url = req.query.url as string;
    if (!url) {
      return res.status(400).json({ error: "URL parameter required" });
    }

    try {
      console.log('Testing Letterboxd scraping for URL:', url);
      const result = await getLetterboxdProfile(url);
      res.json(result);
    } catch (error) {
      console.error('Letterboxd test endpoint error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  });

  app.post("/api/users", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const user = await storage.createUser(userData);

      // Initialize integration data
      const letterboxdData = userData.letterboxdUrl
        ? await getLetterboxdProfile(userData.letterboxdUrl)
        : { status: 'not_provided' as const };

      console.log('Letterboxd integration result:', letterboxdData);

      const spotifyData = { 
        status: 'not_provided' as const
      };

      // Update user with integration data
      const updatedUser = await storage.updateUser(user.id, {
        ...userData,
        letterboxdData,
        spotifyData
      });

      // Generate twin personality using the fetched data
      const twin = await generateTwinPersonality(
        userData.name,
        userData.bio,
        letterboxdData.status === 'success' ? letterboxdData : undefined
      );

      const finalUser = await storage.updateUserTwin(user.id, twin);
      res.json(finalUser);
    } catch (error) {
      const message = error instanceof Error ? error.message : "An error occurred";
      res.status(400).json({ message });
    }
  });

  app.patch("/api/users/:id", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const userId = Number(req.params.id);

      let user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Update integration data
      const letterboxdData = userData.letterboxdUrl
        ? await getLetterboxdProfile(userData.letterboxdUrl)
        : { status: 'not_provided' as const };

      const spotifyData = { 
        status: userData.spotifyUrl ? 'error' : 'not_provided' as const,
        error: userData.spotifyUrl ? 'Spotify integration not implemented yet' : undefined
      };

      // Update user with integration data
      user = await storage.updateUser(userId, {
        ...userData,
        letterboxdData,
        spotifyData
      });

      // Generate twin personality using the fetched data
      const twin = await generateTwinPersonality(
        userData.name,
        userData.bio,
        letterboxdData.status === 'success' ? letterboxdData : undefined
      );

      const updatedUser = await storage.updateUserTwin(userId, twin);
      res.json(updatedUser);
    } catch (error) {
      const message = error instanceof Error ? error.message : "An error occurred";
      res.status(400).json({ message });
    }
  });

  app.get("/api/users/:id", async (req, res) => {
    const user = await storage.getUser(Number(req.params.id));
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  });

  app.get("/api/users/:id/messages", async (req, res) => {
    const messages = await storage.getMessages(Number(req.params.id));
    res.json(messages);
  });

  app.post("/api/users/:id/messages", async (req, res) => {
    const userId = Number(req.params.id);
    const { content } = req.body;

    try {
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Save user message first
      const userMessage = await storage.addMessage(userId, content, true);

      // Set up streaming response
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Transfer-Encoding', 'chunked');

      // Send user message object first
      res.write(JSON.stringify({ userMessage }) + '\n');

      // Get context from previous messages
      const messages = await storage.getMessages(userId);
      const context = messages.slice(-5).map(m =>
        `${m.fromUser ? "User" : user.name}: ${m.content}`
      );

      // Stream the twin's response
      let fullResponse = '';
      try {
        for await (const chunk of streamChatResponse(
          user.twinPersonality,
          user.name,
          content,
          context
        )) {
          res.write(chunk);
          fullResponse += chunk;
        }

        // Save twin's complete response
        await storage.addMessage(userId, fullResponse, false);
        res.end();
      } catch (error) {
        // Only send error if we haven't started streaming
        if (res.writableEnded) return;
        res.end(JSON.stringify({ error: "Failed to generate response" }));
      }
    } catch (error) {
      // Only send error if we haven't started streaming
      if (res.writableEnded) return;
      const message = error instanceof Error ? error.message : "An error occurred";
      res.status(400).json({ message });
    }
  });

  return httpServer;
}