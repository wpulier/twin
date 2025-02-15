import { users, messages, type User, type InsertUser, type Message } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  createUser(user: InsertUser & { 
    letterboxdData?: any;
    spotifyData?: any;
  }): Promise<User>;
  updateUser(id: number, user: InsertUser & {
    letterboxdData?: any;
    spotifyData?: any;
  }): Promise<User>;
  updateUserTwin(id: number, personality: any): Promise<User>;
  getMessages(userId: number): Promise<Message[]>;
  addMessage(userId: number, content: string, fromUser: boolean): Promise<Message>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async createUser(insertUser: InsertUser & {
    letterboxdData?: any;
    spotifyData?: any;
  }): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        ...insertUser,
        spotifyUrl: insertUser.spotifyUrl || null,
        letterboxdUrl: insertUser.letterboxdUrl || null,
        letterboxdData: insertUser.letterboxdData || { status: 'not_provided' },
        spotifyData: insertUser.spotifyData || { status: 'not_provided' },
        twinPersonality: null
      })
      .returning();
    return user;
  }

  async updateUser(id: number, insertUser: InsertUser & {
    letterboxdData?: any;
    spotifyData?: any;
  }): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        ...insertUser,
        spotifyUrl: insertUser.spotifyUrl || null,
        letterboxdUrl: insertUser.letterboxdUrl || null,
        letterboxdData: insertUser.letterboxdData || { status: 'not_provided' },
        spotifyData: insertUser.spotifyData || { status: 'not_provided' }
      })
      .where(eq(users.id, id))
      .returning();

    if (!user) throw new Error("User not found");
    return user;
  }

  async updateUserTwin(id: number, personality: any): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ twinPersonality: personality })
      .where(eq(users.id, id))
      .returning();

    if (!user) throw new Error("User not found");
    return user;
  }

  async getMessages(userId: number): Promise<Message[]> {
    return db.select().from(messages).where(eq(messages.userId, userId));
  }

  async addMessage(userId: number, content: string, fromUser: boolean): Promise<Message> {
    const [message] = await db
      .insert(messages)
      .values({ userId, content, fromUser })
      .returning();
    return message;
  }
}

export const storage = new DatabaseStorage();