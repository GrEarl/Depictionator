/**
 * Additional External Source Providers
 *
 * Integration with Flickr, Freesound, Internet Archive, and more
 */

import type { ExternalSource } from "./external-search";

// ============================================
// Types
// ============================================

export interface FlickrPhoto {
  id: string;
  owner: string;
  secret: string;
  server: string;
  farm: number;
  title: string;
  license: string;
  ownername: string;
  url_l?: string;
  url_o?: string;
  url_m?: string;
  height_l?: number;
  width_l?: number;
}

export interface FreesoundResult {
  id: number;
  name: string;
  url: string;
  previews: Record<string, string>;
  license: string;
  username: string;
  duration: number;
  tags: string[];
}

export interface ArchiveItem {
  identifier: string;
  title: string;
  description?: string;
  mediatype: string;
  creator?: string;
  date?: string;
  licenseurl?: string;
}

// ============================================
// Flickr Integration
// ============================================

const FLICKR_API_KEY = process.env.FLICKR_API_KEY;
const FLICKR_LICENSE_MAP: Record<string, { id: string; name: string; url: string }> = {
  "0": { id: "all-rights-reserved", name: "All Rights Reserved", url: "" },
  "1": { id: "CC-BY-NC-SA-2.0", name: "CC BY-NC-SA 2.0", url: "https://creativecommons.org/licenses/by-nc-sa/2.0/" },
  "2": { id: "CC-BY-NC-2.0", name: "CC BY-NC 2.0", url: "https://creativecommons.org/licenses/by-nc/2.0/" },
  "3": { id: "CC-BY-NC-ND-2.0", name: "CC BY-NC-ND 2.0", url: "https://creativecommons.org/licenses/by-nc-nd/2.0/" },
  "4": { id: "CC-BY-2.0", name: "CC BY 2.0", url: "https://creativecommons.org/licenses/by/2.0/" },
  "5": { id: "CC-BY-SA-2.0", name: "CC BY-SA 2.0", url: "https://creativecommons.org/licenses/by-sa/2.0/" },
  "6": { id: "CC-BY-ND-2.0", name: "CC BY-ND 2.0", url: "https://creativecommons.org/licenses/by-nd/2.0/" },
  "7": { id: "no-known-copyright", name: "No known copyright restrictions", url: "" },
  "8": { id: "us-gov", name: "United States Government Work", url: "" },
  "9": { id: "CC0", name: "Public Domain Dedication (CC0)", url: "https://creativecommons.org/publicdomain/zero/1.0/" },
  "10": { id: "PDM", name: "Public Domain Mark", url: "https://creativecommons.org/publicdomain/mark/1.0/" },
};

function generateId(): string {
  return `ext_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Search Flickr for CC-licensed images
 */
export async function searchFlickr(
  query: string,
  options: {
    limit?: number;
    licenseFilter?: "cc" | "commercial" | "all";
  } = {}
): Promise<ExternalSource[]> {
  if (!FLICKR_API_KEY) {
    console.warn("[Flickr] API key not configured");
    return [];
  }

  const sources: ExternalSource[] = [];
  const limit = options.limit || 20;

  // License codes for different filters
  let licenses = "1,2,3,4,5,6,7,8,9,10"; // All CC and PD
  if (options.licenseFilter === "commercial") {
    licenses = "4,5,7,8,9,10"; // Commercial-friendly
  }

  try {
    const params = new URLSearchParams({
      method: "flickr.photos.search",
      api_key: FLICKR_API_KEY,
      text: query,
      license: licenses,
      extras: "license,owner_name,url_l,url_o,url_m",
      per_page: String(limit),
      format: "json",
      nojsoncallback: "1",
      sort: "relevance",
      content_type: "1", // Photos only
    });

    const response = await fetch(`https://api.flickr.com/services/rest/?${params}`);
    if (!response.ok) return sources;

    const data = await response.json();
    const photos: FlickrPhoto[] = data.photos?.photo || [];

    for (const photo of photos) {
      const imageUrl = photo.url_l || photo.url_o || photo.url_m;
      if (!imageUrl) continue;

      const license = FLICKR_LICENSE_MAP[photo.license] || FLICKR_LICENSE_MAP["0"];
      const photoPageUrl = `https://www.flickr.com/photos/${photo.owner}/${photo.id}`;

      sources.push({
        id: generateId(),
        sourceType: "flickr",
        url: imageUrl,
        title: photo.title || `Flickr photo ${photo.id}`,
        mediaUrls: [imageUrl],
        relevanceScore: 0.6,
        licenseId: license.id,
        licenseUrl: license.url || undefined,
        author: photo.ownername,
        retrievedAt: new Date(),
        verified: true,
        metadata: {
          flickrId: photo.id,
          photoPageUrl,
          width: photo.width_l,
          height: photo.height_l,
        },
      });
    }

    console.log(`[Flickr] Found ${sources.length} images for "${query}"`);
  } catch (error) {
    console.error("[Flickr] Search failed:", error);
  }

  return sources;
}

// ============================================
// Freesound Integration
// ============================================

const FREESOUND_API_KEY = process.env.FREESOUND_API_KEY;

/**
 * Search Freesound for CC-licensed audio
 */
export async function searchFreesound(
  query: string,
  options: {
    limit?: number;
    minDuration?: number;
    maxDuration?: number;
  } = {}
): Promise<ExternalSource[]> {
  if (!FREESOUND_API_KEY) {
    console.warn("[Freesound] API key not configured");
    return [];
  }

  const sources: ExternalSource[] = [];
  const limit = options.limit || 15;

  try {
    let filterStr = "";
    if (options.minDuration) filterStr += `duration:[${options.minDuration} TO *]`;
    if (options.maxDuration) filterStr += ` duration:[* TO ${options.maxDuration}]`;

    const params = new URLSearchParams({
      query,
      token: FREESOUND_API_KEY,
      fields: "id,name,url,previews,license,username,duration,tags",
      page_size: String(limit),
      ...(filterStr ? { filter: filterStr.trim() } : {}),
    });

    const response = await fetch(`https://freesound.org/apiv2/search/text/?${params}`);
    if (!response.ok) return sources;

    const data = await response.json();
    const results: FreesoundResult[] = data.results || [];

    for (const sound of results) {
      const previewUrl = sound.previews?.["preview-hq-mp3"] || sound.previews?.["preview-lq-mp3"];
      if (!previewUrl) continue;

      // Parse license URL to get license ID
      let licenseId = "unknown";
      if (sound.license.includes("zero")) licenseId = "CC0";
      else if (sound.license.includes("by-nc")) licenseId = "CC-BY-NC-3.0";
      else if (sound.license.includes("by")) licenseId = "CC-BY-3.0";

      sources.push({
        id: generateId(),
        sourceType: "freesound",
        url: previewUrl,
        title: sound.name,
        snippet: sound.tags?.slice(0, 5).join(", "),
        mediaUrls: [previewUrl],
        relevanceScore: 0.6,
        licenseId,
        licenseUrl: sound.license,
        author: sound.username,
        retrievedAt: new Date(),
        verified: true,
        metadata: {
          freesoundId: sound.id,
          soundPageUrl: sound.url,
          duration: sound.duration,
          tags: sound.tags,
        },
      });
    }

    console.log(`[Freesound] Found ${sources.length} sounds for "${query}"`);
  } catch (error) {
    console.error("[Freesound] Search failed:", error);
  }

  return sources;
}

// ============================================
// Internet Archive Integration
// ============================================

/**
 * Search Internet Archive for historical media and documents
 */
export async function searchInternetArchive(
  query: string,
  options: {
    mediaType?: "texts" | "image" | "audio" | "movies" | "all";
    limit?: number;
  } = {}
): Promise<ExternalSource[]> {
  const sources: ExternalSource[] = [];
  const limit = options.limit || 15;

  try {
    let queryStr = query;
    if (options.mediaType && options.mediaType !== "all") {
      queryStr += ` AND mediatype:${options.mediaType}`;
    }

    const params = new URLSearchParams({
      q: queryStr,
      output: "json",
      rows: String(limit),
      fl: "identifier,title,description,mediatype,creator,date,licenseurl",
    });

    const response = await fetch(`https://archive.org/advancedsearch.php?${params}`);
    if (!response.ok) return sources;

    const data = await response.json();
    const docs: ArchiveItem[] = data.response?.docs || [];

    for (const item of docs) {
      const itemUrl = `https://archive.org/details/${item.identifier}`;

      sources.push({
        id: generateId(),
        sourceType: "internet_archive",
        url: itemUrl,
        title: item.title,
        snippet: item.description?.slice(0, 300),
        relevanceScore: 0.5,
        licenseUrl: item.licenseurl,
        author: item.creator,
        publishedAt: item.date ? new Date(item.date) : undefined,
        retrievedAt: new Date(),
        verified: true,
        metadata: {
          archiveId: item.identifier,
          mediaType: item.mediatype,
        },
      });
    }

    console.log(`[Archive] Found ${sources.length} items for "${query}"`);
  } catch (error) {
    console.error("[Archive] Search failed:", error);
  }

  return sources;
}

// ============================================
// Google Custom Search (as fallback)
// ============================================

const GOOGLE_CSE_KEY = process.env.GOOGLE_CSE_API_KEY;
const GOOGLE_CSE_CX = process.env.GOOGLE_CSE_CX;

/**
 * Search using Google Custom Search Engine (fallback for non-Gemini usage)
 */
export async function searchGoogleCSE(
  query: string,
  options: {
    limit?: number;
    searchType?: "image" | "web";
    imageType?: "photo" | "clipart" | "lineart";
  } = {}
): Promise<ExternalSource[]> {
  if (!GOOGLE_CSE_KEY || !GOOGLE_CSE_CX) {
    console.warn("[GoogleCSE] API key or CX not configured");
    return [];
  }

  const sources: ExternalSource[] = [];
  const limit = Math.min(options.limit || 10, 10); // CSE max is 10 per request

  try {
    const params = new URLSearchParams({
      key: GOOGLE_CSE_KEY,
      cx: GOOGLE_CSE_CX,
      q: query,
      num: String(limit),
    });

    if (options.searchType === "image") {
      params.set("searchType", "image");
      if (options.imageType) {
        params.set("imgType", options.imageType);
      }
    }

    const response = await fetch(`https://www.googleapis.com/customsearch/v1?${params}`);
    if (!response.ok) return sources;

    const data = await response.json();
    const items = data.items || [];

    for (const item of items) {
      sources.push({
        id: generateId(),
        sourceType: "google_search",
        url: item.link,
        title: item.title,
        snippet: item.snippet,
        relevanceScore: 0.7,
        retrievedAt: new Date(),
        verified: false,
        metadata: {
          displayLink: item.displayLink,
          formattedUrl: item.formattedUrl,
          ...(item.image ? {
            imageWidth: item.image.width,
            imageHeight: item.image.height,
            thumbnailLink: item.image.thumbnailLink,
          } : {}),
        },
      });
    }

    console.log(`[GoogleCSE] Found ${sources.length} results for "${query}"`);
  } catch (error) {
    console.error("[GoogleCSE] Search failed:", error);
  }

  return sources;
}

// ============================================
// Sketchfab Integration (3D Models Reference)
// ============================================

const SKETCHFAB_API_KEY = process.env.SKETCHFAB_API_KEY;

/**
 * Search Sketchfab for 3D model references
 */
export async function searchSketchfab(
  query: string,
  options: {
    limit?: number;
    downloadable?: boolean;
  } = {}
): Promise<ExternalSource[]> {
  const sources: ExternalSource[] = [];
  const limit = options.limit || 10;

  try {
    const params = new URLSearchParams({
      q: query,
      type: "models",
      count: String(limit),
      ...(options.downloadable ? { downloadable: "true" } : {}),
    });

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (SKETCHFAB_API_KEY) {
      headers["Authorization"] = `Token ${SKETCHFAB_API_KEY}`;
    }

    const response = await fetch(`https://api.sketchfab.com/v3/search?${params}`, { headers });
    if (!response.ok) return sources;

    const data = await response.json();
    const results = data.results || [];

    for (const model of results) {
      const thumbnails = model.thumbnails?.images || [];
      const thumbnail = thumbnails.find((t: any) => t.width >= 400) || thumbnails[0];

      sources.push({
        id: generateId(),
        sourceType: "other", // Sketchfab doesn't have a dedicated type yet
        url: model.viewerUrl,
        title: model.name,
        snippet: model.description?.slice(0, 300),
        relevanceScore: 0.6,
        author: model.user?.username,
        retrievedAt: new Date(),
        verified: true,
        metadata: {
          sketchfabId: model.uid,
          thumbnailUrl: thumbnail?.url,
          faceCount: model.faceCount,
          vertexCount: model.vertexCount,
          isDownloadable: model.isDownloadable,
          license: model.license?.label,
        },
      });
    }

    console.log(`[Sketchfab] Found ${sources.length} 3D models for "${query}"`);
  } catch (error) {
    console.error("[Sketchfab] Search failed:", error);
  }

  return sources;
}

// ============================================
// Aggregated Multi-Source Search
// ============================================

export interface MultiSourceSearchOptions {
  query: string;
  enabledSources: {
    flickr?: boolean;
    freesound?: boolean;
    archive?: boolean;
    googleCSE?: boolean;
    sketchfab?: boolean;
  };
  limits?: {
    flickr?: number;
    freesound?: number;
    archive?: number;
    googleCSE?: number;
    sketchfab?: number;
  };
  mediaFocus?: "image" | "audio" | "video" | "3d" | "all";
}

/**
 * Search across multiple external sources in parallel
 */
export async function searchMultipleSources(
  options: MultiSourceSearchOptions
): Promise<{
  sources: ExternalSource[];
  byType: Record<string, ExternalSource[]>;
  errors: string[];
}> {
  const { query, enabledSources, limits = {}, mediaFocus = "all" } = options;
  const allSources: ExternalSource[] = [];
  const byType: Record<string, ExternalSource[]> = {};
  const errors: string[] = [];

  const promises: Promise<void>[] = [];

  // Flickr (images)
  if (enabledSources.flickr && (mediaFocus === "image" || mediaFocus === "all")) {
    promises.push(
      searchFlickr(query, { limit: limits.flickr || 15, licenseFilter: "commercial" })
        .then(sources => {
          allSources.push(...sources);
          byType["flickr"] = sources;
        })
        .catch(e => { errors.push(`Flickr: ${e.message}`); })
    );
  }

  // Freesound (audio)
  if (enabledSources.freesound && (mediaFocus === "audio" || mediaFocus === "all")) {
    promises.push(
      searchFreesound(query, { limit: limits.freesound || 10 })
        .then(sources => {
          allSources.push(...sources);
          byType["freesound"] = sources;
        })
        .catch(e => { errors.push(`Freesound: ${e.message}`); })
    );
  }

  // Internet Archive
  if (enabledSources.archive) {
    const archiveMediaType = mediaFocus === "all" ? "all" :
      mediaFocus === "audio" ? "audio" :
      mediaFocus === "video" ? "movies" :
      mediaFocus === "image" ? "image" : "texts";

    promises.push(
      searchInternetArchive(query, { limit: limits.archive || 10, mediaType: archiveMediaType as any })
        .then(sources => {
          allSources.push(...sources);
          byType["archive"] = sources;
        })
        .catch(e => { errors.push(`Archive: ${e.message}`); })
    );
  }

  // Google CSE
  if (enabledSources.googleCSE) {
    promises.push(
      searchGoogleCSE(query, {
        limit: limits.googleCSE || 10,
        searchType: mediaFocus === "image" ? "image" : "web",
      })
        .then(sources => {
          allSources.push(...sources);
          byType["googleCSE"] = sources;
        })
        .catch(e => { errors.push(`GoogleCSE: ${e.message}`); })
    );
  }

  // Sketchfab (3D models)
  if (enabledSources.sketchfab && (mediaFocus === "3d" || mediaFocus === "all")) {
    promises.push(
      searchSketchfab(query, { limit: limits.sketchfab || 8 })
        .then(sources => {
          allSources.push(...sources);
          byType["sketchfab"] = sources;
        })
        .catch(e => { errors.push(`Sketchfab: ${e.message}`); })
    );
  }

  await Promise.all(promises);

  // Sort by relevance
  allSources.sort((a, b) => b.relevanceScore - a.relevanceScore);

  console.log(`[MultiSource] Found ${allSources.length} total sources across ${Object.keys(byType).length} providers`);

  return { sources: allSources, byType, errors };
}
