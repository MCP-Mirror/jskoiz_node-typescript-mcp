# Changelog

### Major Changes
- Moved documentation files out of version control, now downloaded during build
- Completely refactored documentation search system from web scraping to local file processing
- Implemented new search indexing system for improved performance and accuracy
- Added support for local documentation files instead of fetching from web

### Infrastructure Changes
- Added setup-docs script to automatically download and setup documentation during build
- Documentation is now fetched from official repositories during build:
  - TypeScript: microsoft/TypeScript-Website
  - Node.js: nodejs/node
- Reduced repository size by removing pre-fetched documentation
- Documentation now stays current with source repositories

### Dependencies
#### Added
- `marked`: For processing markdown documentation files
- `minisearch`: For building and querying search indices

#### Removed
- `cheerio`: No longer needed as we're not scraping web content
- `axios`: No longer needed for HTTP requests
- Rate limiting utilities removed as they're no longer required

### Features
- Added new preprocessing system with markdown processor and index builder
- Implemented file-based documentation search for both TypeScript and Node.js docs
- Added category-based filtering for documentation search
- Improved search result accuracy with proper indexing
- Added score-based ranking for search results

### TypeScript Documentation Changes
- Replaced web scraping of TypeScript documentation with local file processing
- Added support for multiple documentation categories:
  - handbook
  - reference
  - release-notes
  - declaration-files
  - javascript
- Improved search context with better category handling

### Node.js Documentation Changes
- Moved from web API documentation scraping to local markdown files
- Simplified version handling by focusing on current documentation
- Added 'core' category support
- Enhanced search result context and accuracy

### Technical Improvements
- Implemented memory-only caching for search results
- Added better error handling and logging
- Improved search result formatting with scores
- Added support for stored fields in search index
- Enhanced documentation processing with proper file path handling

### Breaking Changes
- Changed search API parameters:
  - Removed version parameter from Node.js docs search
  - Added category parameter for both TypeScript and Node.js searches
- Modified search result format to include scores and categories
- Changed URL format to use local file paths instead of web URLs

### Modular Documentation System
- Implemented configurable documentation source system
- Added selective documentation installation:
  - Interactive selection mode
  - Individual source installation scripts
  - All-sources installation option
- Created configuration-driven documentation source management
- Added support for easy addition of new documentation sources
- Improved build process to handle selective documentation setup

### Discord.js Documentation
- Added support for Discord.js guide documentation
- Implemented new documentation categories:
  - preparations
  - creating-your-bot
  - slash-commands
  - interactions
  - message-components
  - popular-topics
  - voice
  - additional-features
  - improving-dev-environment
  - miscellaneous
- Added search support for Discord.js guide content
- Integrated with modular documentation system

### Infrastructure Improvements
- Added docs-config.js for centralized documentation source configuration
- Updated setup scripts to support selective installation
- Added new npm scripts for individual documentation setup
- Improved documentation organization and structure
