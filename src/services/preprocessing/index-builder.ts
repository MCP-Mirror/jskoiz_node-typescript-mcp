import MiniSearch, { SearchResult } from 'minisearch';
import { ProcessedDoc } from './markdown-processor.js';
import { promises as fs } from 'fs';
import { join } from 'path';

export interface IndexedDoc {
  id: string;
  title: string;
  content: string;
  section: string;
  category: string;
  importance: number;
  path: string;
}

export class SearchIndexBuilder {
  private searchIndex: MiniSearch<IndexedDoc>;
  private readonly indexPath: string;
  private readonly cacheDir = 'cache';

  constructor(basePath: string) {
    this.indexPath = join(basePath, this.cacheDir, 'search-index.json');
    
    this.searchIndex = new MiniSearch({
      fields: ['title', 'content'], // Only index essential fields
      storeFields: ['title', 'path', 'category'], // Only store essential fields
      searchOptions: {
        boost: { title: 3, content: 1 }, // Increase title relevance
        prefix: true,
        fuzzy: 0.1 // Reduce fuzzy matching to limit irrelevant results
      },
      extractField: (document, fieldName) => {
        // Custom field extraction to handle nested properties
        if (fieldName === 'section') {
          return document.section || '';
        }
        return (document as any)[fieldName];
      }
    });
  }

  private processDocForIndexing(doc: ProcessedDoc): IndexedDoc[] {
    // Create an indexed document for each chunk
    return doc.chunks.map((chunk, index) => ({
      path: doc.metadata.path,
      id: `${doc.id}_${index}`,
      title: doc.title,
      content: chunk.content,
      section: chunk.metadata.section,
      category: doc.metadata.category,
      importance: chunk.metadata.importance
    }));
  }

  async buildIndex(docs: ProcessedDoc[]): Promise<void> {
    const indexedDocs: IndexedDoc[] = [];
    
    // Process all documents
    for (const doc of docs) {
      const processedDocs = this.processDocForIndexing(doc);
      indexedDocs.push(...processedDocs);
    }

    // Add documents to index
    this.searchIndex.addAll(indexedDocs);

    // Save index to disk
    await this.saveIndex();
  }

  async saveIndex(): Promise<void> {
    try {
      // Create cache directory if it doesn't exist
      const cacheDir = join(this.indexPath, '..');
      await fs.mkdir(cacheDir, { recursive: true });
      
      // Serialize and save index
      const serializedIndex = this.searchIndex.toJSON();
      await fs.writeFile(this.indexPath, JSON.stringify(serializedIndex));
    } catch (error) {
      console.error('Error saving search index:', error);
      throw error;
    }
  }

  async loadIndex(): Promise<boolean> {
    try {
      const indexData = await fs.readFile(this.indexPath, 'utf-8');
      const serializedIndex = JSON.parse(indexData);
      this.searchIndex = MiniSearch.loadJS(serializedIndex, {
        fields: ['title', 'content', 'section', 'category'],
        storeFields: ['title', 'category', 'importance', 'path']
      });
      return true;
    } catch (error) {
      console.error('Error loading search index:', error);
      return false;
    }
  }

  search(query: string, options: { category?: string } = {}): Array<{
    id: string;
    score: number;
    match: string;
    terms: string[];
    title: string;
    category: string;
    path: string;
  }> {
    // Pre-filter query to remove common words and limit length
    const cleanedQuery = query.split(' ')
      .filter(word => word.length > 2) // Remove very short words
      .slice(0, 3) // Limit to first 3 terms for more focused results
      .join(' ');

    const searchResults = this.searchIndex.search(cleanedQuery, {
      filter: options.category ? (result: { id: string }) => {
        const storedFields = this.searchIndex.getStoredFields(result.id);
        if (!storedFields) return false;
        const doc = storedFields as Pick<IndexedDoc, 'category'>;
        return doc.category === options.category;
      } : undefined,
      boost: { title: 3, content: 1 },
      fuzzy: 0.1
    }).slice(0, 5); // Limit to top 5 results

    // Map results with minimal data
    const results = searchResults.map(result => {
      const stored = this.searchIndex.getStoredFields(result.id) as Partial<IndexedDoc>;
      return {
        id: result.id,
        score: result.score,
        title: stored.title || '',
        category: stored.category || '',
        path: stored.path || '',
        match: (typeof result.match === 'string' ? 
          result.match : 
          JSON.stringify(result.match || '')
        ).substring(0, 150), // Limit match context length
        terms: [] // Don't return terms to reduce payload size
      };
    });

    return results.sort((a, b) => {
      const scoreCompare = b.score - a.score;
      if (scoreCompare !== 0) return scoreCompare;
      
      const storedA = this.searchIndex.getStoredFields(a.id);
      const storedB = this.searchIndex.getStoredFields(b.id);
      const importanceA = typeof storedA?.importance === 'number' ? storedA.importance : 0;
      const importanceB = typeof storedB?.importance === 'number' ? storedB.importance : 0;
      return importanceB - importanceA;
    });
  }

  getStoredFields(id: string): Partial<IndexedDoc> {
    return this.searchIndex.getStoredFields(id) || {};
  }

  // Method to update specific documents in the index
  async updateDocs(docs: ProcessedDoc[]): Promise<void> {
    const docsToUpdate = docs.flatMap(doc => this.processDocForIndexing(doc));
    
    // Remove old entries for these docs
    for (const doc of docsToUpdate) {
      try {
        this.searchIndex.remove(doc);
      } catch (error) {
        console.error(`Error removing document ${doc.id}:`, error);
      }
    }
    
    // Add updated documents
    this.searchIndex.addAll(docsToUpdate);
    
    // Save updated index
    await this.saveIndex();
  }
}
