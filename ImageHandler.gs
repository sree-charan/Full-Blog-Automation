/**
 * Image Handler Module
 * 
 * This module is responsible for:
 * - Fetching relevant images from Pexels API based on keywords
 * - Handling image selection and processing
 */

/**
 * Fetches a relevant image from Pexels API based on extracted keywords
 * @param {Array} keywords List of keywords for the image search
 * @return {string} URL of the selected image
 */
function fetchImage(keywords) {
  try {
    if (!keywords || keywords.length === 0) {
      Logger.log("No keywords provided for image search");
      return null;
    }
    
    // Combine keywords into a search query, trying different combinations if needed
    const searchQueries = [
      keywords.join(' '), // All keywords
      keywords.slice(0, 2).join(' '), // First two keywords
      keywords[0] // Just the first keyword as fallback
    ];
    
    for (const query of searchQueries) {
      const imageUrl = searchPexels(query);
      if (imageUrl) {
        return imageUrl;
      }
    }
    
    // If all queries failed, try a more generic search based on the first keyword
    if (keywords[0]) {
      const genericQuery = getRelatedGenericTerm(keywords[0]);
      return searchPexels(genericQuery);
    }
    
    return null;
    
  } catch (error) {
    Logger.log(`Error fetching image: ${error}`);
    return null;
  }
}

/**
 * Searches Pexels API with the given query
 * @param {string} query The search query
 * @return {string} URL of the selected image or null if none found
 */
function searchPexels(query) {
  try {
    const apiKey = CONFIG.PEXELS_API_KEY;
    const apiUrl = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=10`;
    
    const options = {
      method: 'get',
      headers: {
        'Authorization': apiKey
      },
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(apiUrl, options);
    const responseCode = response.getResponseCode();
    
    if (responseCode !== 200) {
      Logger.log(`Pexels API Error: ${responseCode} - ${response.getContentText()}`);
      return null;
    }
    
    const responseData = JSON.parse(response.getContentText());
    
    if (!responseData.photos || responseData.photos.length === 0) {
      Logger.log(`No images found for query: ${query}`);
      return null;
    }
    
    // Select a random image from the results
    const randomIndex = Math.floor(Math.random() * Math.min(responseData.photos.length, 5));
    const selectedPhoto = responseData.photos[randomIndex];
    
    // Get the medium size image URL
    let imageUrl = selectedPhoto.src.medium;
    
    // Remove URL parameters for clearer image display
    if (imageUrl && imageUrl.includes('?')) {
      imageUrl = imageUrl.split('?')[0];
    }
    
    return imageUrl;
    
  } catch (error) {
    Logger.log(`Error searching Pexels: ${error}`);
    return null;
  }
}

/**
 * Gets a more generic related term for a specific keyword
 * Used as fallback for image searches
 * @param {string} keyword The specific keyword
 * @return {string} A more generic related term
 */
function getRelatedGenericTerm(keyword) {
  // Map of specific terms to generic categories
  const genericTerms = {
    // Technology
    'programming': 'computer code',
    'blockchain': 'technology network',
    'cryptocurrency': 'digital finance',
    'bitcoin': 'digital currency',
    'software': 'computer technology',
    'developer': 'person coding',
    'coding': 'computer screen code',
    'app': 'smartphone application',
    'artificial': 'artificial intelligence',
    'intelligence': 'brain technology',
    'machine': 'machine learning',
    'learning': 'education technology',
    'data': 'data visualization',
    'cloud': 'cloud computing',
    
    // Business
    'business': 'business meeting',
    'startup': 'startup office',
    'entrepreneur': 'entrepreneur working',
    'marketing': 'digital marketing',
    'strategy': 'strategy planning',
    'leadership': 'leadership team',
    'management': 'business management',
    'growth': 'business growth',
    
    // Lifestyle
    'fitness': 'fitness exercise',
    'health': 'healthy lifestyle',
    'nutrition': 'healthy food',
    'wellness': 'wellness lifestyle',
    'meditation': 'person meditating',
    'mindfulness': 'peaceful meditation',
    
    // Generic fallbacks
    'guide': 'person showing direction',
    'tips': 'helpful advice',
    'how': 'tutorial learning',
    'why': 'question mark concept',
    'what': 'explanation concept',
    'best': 'winner trophy',
    'top': 'mountain peak success'
  };
  
  // Check if we have a direct match
  const lowerKeyword = keyword.toLowerCase();
  if (genericTerms[lowerKeyword]) {
    return genericTerms[lowerKeyword];
  }
  
  // Check if keyword contains any of our keys
  for (const key in genericTerms) {
    if (lowerKeyword.includes(key)) {
      return genericTerms[key];
    }
  }
  
  // Default fallback
  return 'colorful abstract';
}