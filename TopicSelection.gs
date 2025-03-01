/**
 * Topic Selection Module
 * 
 * This module is responsible for dynamically selecting blog topics from:
 * - RSS feeds from configured sources
 * - Dynamic topic generation using Google Gemini API
 * 
 * Selection is based on:
 * - Necessity (content gaps)
 * - Randomness factor
 * - Content type variation
 * - Trends and relevance
 */

/**
 * Main function to select a topic
 * @return {Object} Topic data with title, description, and source
 */
function selectTopic() {
  try {
    // Check for randomness factor to decide between RSS and generated topics
    const useRandomGeneration = Math.random() < CONFIG.RANDOMNESS_FACTOR;
    
    // First try RSS feeds (unless randomness dictates otherwise)
    let topicData = null;
    if (!useRandomGeneration) {
      topicData = getTopicFromRSSFeeds();
    }
    
    // If no topic found from RSS or if randomness dictates, generate a topic
    if (!topicData) {
      topicData = generateTopic();
    }
    
    return topicData;
    
  } catch (error) {
    Logger.log(`Error selecting topic: ${error}`);
    return null;
  }
}

/**
 * Gets topics from configured RSS feeds
 * @return {Object} Selected topic data or null if none found
 */
function getTopicFromRSSFeeds() {
  try {
    const potentialTopics = [];
    
    // Fetch topics from each RSS feed
    for (const feedUrl of CONFIG.RSS_FEEDS) {
      try {
        const response = UrlFetchApp.fetch(feedUrl);
        const xml = response.getContentText();
        const document = XmlService.parse(xml);
        const root = document.getRootElement();
        
        // Handle RSS format
        let items = [];
        if (root.getName() === 'rss') {
          const channel = root.getChild('channel');
          if (channel) {
            items = channel.getChildren('item');
          }
        } 
        // Handle Atom format
        else if (root.getName() === 'feed') {
          items = root.getChildren('entry');
        }
        
        // Extract topics from feed items
        for (const item of items) {
          let title, description, link;
          
          // Handle RSS format
          if (root.getName() === 'rss') {
            title = getElementText(item, 'title');
            description = getElementText(item, 'description');
            link = getElementText(item, 'link');
          } 
          // Handle Atom format
          else if (root.getName() === 'feed') {
            title = getElementText(item, 'title');
            const content = item.getChild('content', item.getNamespace());
            description = content ? content.getText() : '';
            const linkElement = item.getChild('link', item.getNamespace());
            link = linkElement ? linkElement.getAttribute('href').getValue() : '';
          }
          
          if (title && !isTopicUsed(title)) {
            potentialTopics.push({
              title: title,
              description: description || '',
              source: 'RSS: ' + feedUrl,
              link: link || ''
            });
          }
        }
      } catch (feedError) {
        Logger.log(`Error fetching feed ${feedUrl}: ${feedError}`);
        // Continue with next feed
      }
    }
    
    // If we found potential topics, select one randomly
    if (potentialTopics.length > 0) {
      const randomIndex = Math.floor(Math.random() * potentialTopics.length);
      return potentialTopics[randomIndex];
    }
    
    return null;
    
  } catch (error) {
    Logger.log(`Error in getTopicFromRSSFeeds: ${error}`);
    return null;
  }
}

/**
 * Helper function to safely get text from an XML element
 */
function getElementText(element, childName) {
  const child = element.getChild(childName);
  return child ? child.getText() : '';
}

/**
 * Generates a topic using Google Gemini API
 * @return {Object} Generated topic data
 */
function generateTopic() {
  try {
    // Select a content type based on weights
    const contentType = selectContentType();
    
    // Prompt for Gemini to generate a topic
    const prompt = `Generate an interesting and unique blog topic for a ${contentType} article. 
    The topic should be specific, engaging, and provide value to readers. 
    Format your response as a JSON object with fields:
    "title": A catchy SEO-friendly title (max 10 words)
    "description": A brief 1-2 sentence description of what the article would cover`;
    
    // Call Gemini API to generate topic
    const topicData = callGeminiAPI(prompt);
    
    if (!topicData || !topicData.title) {
      Logger.log("Failed to generate topic from Gemini API");
      return null;
    }
    
    // Check if this topic has been used before
    if (isTopicUsed(topicData.title)) {
      Logger.log("Generated topic has been used before, trying again");
      return generateTopic(); // Try again
    }
    
    return {
      title: topicData.title,
      description: topicData.description || '',
      source: 'Generated',
      contentType: contentType
    };
    
  } catch (error) {
    Logger.log(`Error generating topic: ${error}`);
    return null;
  }
}

/**
 * Select a content type based on configured weights
 * @return {string} Selected content type
 */
function selectContentType() {
  const types = Object.keys(CONFIG.CONTENT_TYPES);
  const weights = types.map(type => CONFIG.CONTENT_TYPES[type]);
  
  // Calculate cumulative weights
  const cumulativeWeights = [];
  let sum = 0;
  for (const weight of weights) {
    sum += weight;
    cumulativeWeights.push(sum);
  }
  
  // Select based on random value
  const randomValue = Math.random() * sum;
  for (let i = 0; i < cumulativeWeights.length; i++) {
    if (randomValue < cumulativeWeights[i]) {
      return types[i];
    }
  }
  
  // Default fallback
  return types[0];
}

/**
 * Checks if a topic has been used before
 * @param {string} title The topic title to check
 * @return {boolean} True if the topic has been used
 */
function isTopicUsed(title) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SHEETS_ID);
    const sheet = ss.getSheetByName(CONFIG.USED_TOPICS_SHEET_NAME);
    
    if (!sheet) {
      return false; // Sheet doesn't exist, so topic can't have been used
    }
    
    const data = sheet.getDataRange().getValues();
    
    // Skip header row and check if title exists
    for (let i = 1; i < data.length; i++) {
      if (data[i][0].toLowerCase() === title.toLowerCase()) {
        return true;
      }
    }
    
    return false;
    
  } catch (error) {
    Logger.log(`Error checking if topic is used: ${error}`);
    // If we can't check, assume it's not used (better to post a duplicate than nothing)
    return false;
  }
}

/**
 * Records a used topic in the tracking sheet
 * @param {string} title The topic title
 * @param {string} source The source of the topic
 */
function trackUsedTopic(title, source) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SHEETS_ID);
    const sheet = ss.getSheetByName(CONFIG.USED_TOPICS_SHEET_NAME);
    
    if (!sheet) {
      Logger.log("Used Topics sheet not found");
      return;
    }
    
    const now = new Date();
    sheet.appendRow([title, source, now, 'Published']);
    
  } catch (error) {
    Logger.log(`Error tracking used topic: ${error}`);
  }
}

/**
 * Records an entry in the logs sheet
 */
function recordLog(status, title, url, keywords, notes) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SHEETS_ID);
    const sheet = ss.getSheetByName(CONFIG.LOGS_SHEET_NAME);
    
    if (!sheet) {
      Logger.log("Logs sheet not found");
      return;
    }
    
    const now = new Date();
    sheet.appendRow([now, status, title, url, keywords, notes]);
    
  } catch (error) {
    Logger.log(`Error recording log: ${error}`);
  }
}