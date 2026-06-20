
// lib/redis/client.ts
import { kv } from '@vercel/kv';

// ==========================================================
// TYPES
// ==========================================================

export interface RedisStreamEntry {
  id: string;
  fields: Record<string, string>;
}

export interface RedisStreamOptions {
  count?: number;
  block?: number;
}

export interface ZRangeEntry {
  member: string;
  score: number;
}

// ==========================================================
// CLIENT REDIS (Vercel KV Uniquement)
// ==========================================================

/**
 * Client Redis unifié pour VAGONDYS
 * Utilise Vercel KV comme backend
 */
class RedisClient {
  private isVercelKV = false;

  constructor() {
    this.isVercelKV = typeof kv !== 'undefined' && kv !== null;
    console.log(`📦 Redis Client: ${this.isVercelKV ? 'Vercel KV' : 'Mode simulé'}`);
  }

  // ==========================================================
  // STREAMS (Queue) - Simulé avec Listes
  // ==========================================================

  /**
   * Ajoute un message dans un stream (Queue)
   * Utilise une liste Vercel KV comme alternative
   */
  async xadd(stream: string, id: string, ...fields: string[]): Promise<string> {
    const message = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      fields: this._fieldsToObject(fields)
    };
    
    await kv.lpush(stream, JSON.stringify(message));
    return message.id;
  }

  /**
   * Lit les messages d'un stream (Consumer Group)
   * Utilise une liste Vercel KV comme alternative
   */
  async xreadgroup(
    group: string,
    consumer: string,
    id: string,
    stream: string,
    opts: RedisStreamOptions = {}
  ): Promise<RedisStreamEntry[]> {
    const count = opts.count || 10;
    const messages = await kv.lrange(stream, 0, count - 1);
    return messages.map((msg: string) => {
      const data = JSON.parse(msg);
      return {
        id: data.id,
        fields: data.fields
      };
    });
  }

  /**
   * Confirme le traitement d'un message (ACK)
   * Supprime le message de la liste
   */
  async xack(stream: string, group: string, id: string): Promise<number> {
    const removed = await kv.lrem(stream, 1, id);
    return removed || 0;
  }

  // ==========================================================
  // SORTED SETS (Classements)
  // ==========================================================

  /**
   * Ajoute un membre dans un sorted set (classement)
   */
  async zadd(key: string, score: number, member: string): Promise<number> {
    await kv.zadd(key, { score, member });
    return 1;
  }

  /**
   * ✅ CORRIGÉ : Récupère les membres d'un sorted set
   */
  async zrange(
    key: string,
    min: number,
    max: number,
    withScores: boolean = false
  ): Promise<ZRangeEntry[]> {
    if (withScores) {
      const results = await kv.zrange(key, min, max, { withScores: true });
      // ✅ CORRECTION : Assertion de type pour éviter les erreurs TypeScript
      const typedResults = results as unknown as Array<{ member: string; score: number }>;
      return typedResults.map((item) => ({
        member: String(item.member || ''),
        score: Number(item.score || 0)
      }));
    }
    
    const results = await kv.zrange(key, min, max);
    // ✅ CORRECTION : Assertion de type pour éviter les erreurs TypeScript
    const typedResults = results as unknown as string[];
    return typedResults.map((member) => ({
      member: String(member || ''),
      score: 0
    }));
  }

  /**
   * Récupère le rang d'un membre
   */
  async zrank(key: string, member: string): Promise<number | null> {
    const rank = await kv.zrank(key, member);
    return rank !== null ? rank : null;
  }

  /**
   * Supprime les membres au-delà d'un rang
   */
  async zremrangebyrank(key: string, min: number, max: number): Promise<number> {
    // Récupérer les membres à supprimer
    const members = await kv.zrange(key, min, max);
    const typedMembers = members as unknown as string[];
    let count = 0;
    for (const member of typedMembers) {
      const removed = await kv.zrem(key, member);
      if (removed) count++;
    }
    return count;
  }

  /**
   * Récupère le nombre de membres
   */
  async zcard(key: string): Promise<number> {
    return await kv.zcard(key) || 0;
  }

  // ==========================================================
  // HASH (Profils)
  // ==========================================================

  /**
   * Met à jour un hash
   */
  async hset(key: string, fields: Record<string, string | number>): Promise<number> {
    // ✅ CORRECTION : Conversion explicite en Record<string, string>
    const stringFields: Record<string, string> = {};
    for (const [k, v] of Object.entries(fields)) {
      stringFields[k] = String(v);
    }
    await kv.hset(key, stringFields);
    return Object.keys(fields).length;
  }

  /**
   * Récupère un hash
   */
  async hgetall(key: string): Promise<Record<string, string> | null> {
    const result = await kv.hgetall(key);
    if (!result || typeof result !== 'object') return null;
    
    // Convertir les valeurs en string
    const typedResult: Record<string, string> = {};
    for (const [k, v] of Object.entries(result)) {
      typedResult[k] = String(v || '');
    }
    return typedResult;
  }

  /**
   * Récupère plusieurs champs d'un hash
   */
  async hmget(key: string, ...fields: string[]): Promise<(string | null)[]> {
    const result = await kv.hmget(key, ...fields);
    if (!result || !Array.isArray(result)) {
      return fields.map(() => null);
    }
    return result.map((val) => (val !== undefined && val !== null ? String(val) : null));
  }

  // ==========================================================
  // GÉNÉRAL
  // ==========================================================

  /**
   * Supprime une ou plusieurs clés
   */
  async del(...keys: string[]): Promise<number> {
    let count = 0;
    for (const key of keys) {
      const result = await kv.del(key);
      if (result) count++;
    }
    return count;
  }

  /**
   * Récupère une valeur
   */
  async get(key: string): Promise<string | null> {
    const result = await kv.get(key);
    if (result === undefined || result === null) return null;
    return String(result);
  }

  /**
   * Définit une valeur
   */
  async set(key: string, value: string, options?: { ex?: number }): Promise<string | null> {
    if (options?.ex) {
      return await kv.set(key, value, { ex: options.ex });
    }
    return await kv.set(key, value);
  }

  // ==========================================================
  // UTILITAIRES PRIVÉS
  // ==========================================================

  /**
   * Convertit un tableau de champs en objet
   */
  private _fieldsToObject(fields: string[]): Record<string, string> {
    const obj: Record<string, string> = {};
    for (let i = 0; i < fields.length; i += 2) {
      if (i + 1 < fields.length) {
        obj[fields[i]] = fields[i + 1];
      }
    }
    return obj;
  }
}

// ==========================================================
// EXPORT
// ==========================================================

export const redis = new RedisClient();
