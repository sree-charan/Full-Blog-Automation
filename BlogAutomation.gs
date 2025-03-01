/**
 * Blog Automation Script
 * 
 * This script automates the creation of blog posts for Blogger using:
 * - Dynamic topic selection from RSS feeds or Gemini API
 * - Content generation with Google Gemini API
 * - Image fetching from Pexels API
 * - Tracking of used topics and logs in Google Sheets
 * - Automated publishing to Blogger via the Blogger API
 * 
 * Required Library:
 * - OAuth2 library by Google: 1B7FSrk5Zi6L1rSxxTDgDEUsPzlukDsi4KGuTMorsTQHhGBzBkMun4iDF
 */

// Configuration settings
const CONFIG = {
  // API Keys
  GEMINI_API_KEY: 'YOUR_GEMINI_API_KEY',
  PEXELS_API_KEY: 'YOUR_PEXELS_API_KEY',
  
  // Blogger OAuth credentials
  BLOGGER_CLIENT_ID: 'YOUR_BLOGGER_CLIENT_ID',
  BLOGGER_CLIENT_SECRET: 'YOUR_BLOGGER_CLIENT_SECRET',
  
  // Google Sheets ID for tracking
  SHEETS_ID: 'YOUR_SHEETS_ID_HERE',
  
  // RSS Feed URLs for topic ideas
  RSS_FEEDS: [
    'https://techcrunch.com/feed/',
    'https://www.wired.com/feed/rss',
    'https://hnrss.org/frontpage',
    'https://feeds.feedburner.com/TheHackersNews'
  ],
  
  // Blog configuration
  BLOG_ID: 'YOUR_BLOG_ID', // To be filled by the user
  CONTENT_LENGTH: 1000, // Target word count for blog content
  
  // Automation settings
  POST_FREQUENCY: 'MINUTELY', // DAILY, WEEKLY, HOURLY, MINUTELY
  RANDOMNESS_FACTOR: 0.3, // 0-1 scale, higher means more random topic generation vs. RSS
  
  // Tracking sheets
  USED_TOPICS_SHEET_NAME: 'Used Topics',
  LOGS_SHEET_NAME: 'Logs',
  
  // Content type weights
  CONTENT_TYPES: {
    'how-to': 0.3,
    'listicle': 0.2,
    'opinion': 0.2,
    'industry-insight': 0.3
  }
};

/**
 * Main function to run the blog automation process
 */
function runBlogAutomation() {
  try {
    Logger.log("Starting blog automation process...");
    
    // Step 1: Select or generate topic
    const topicData = selectTopic();
    if (!topicData) {
      Logger.log("Failed to select a topic. Exiting.");
      recordLog("Failed", "", "", "", "Failed to select a topic");
      return;
    }
    
    Logger.log(`Selected topic: ${topicData.title}`);
    
    // Step 2: Generate content using Gemini API
    const generatedContent = generateContent(topicData);
    if (!generatedContent) {
      Logger.log("Failed to generate content. Exiting.");
      recordLog("Failed", topicData.title, "", "", "Failed to generate content");
      return;
    }
    
    // Step 3: Extract keywords and fetch relevant image
    const keywords = extractKeywords(generatedContent);
    const imageUrl = fetchImage(keywords);
    
    // Step 4: Format and post content to Blogger
    const postUrl = postToBlogger(generatedContent.title, generatedContent.content, imageUrl, keywords);
    
    // Step 5: Log the successful post
    if (postUrl) {
      trackUsedTopic(topicData.title, topicData.source);
      recordLog("Published", generatedContent.title, postUrl, keywords.join(", "), "Successfully published");
      Logger.log(`Successfully published blog post: ${postUrl}`);
    } else {
      recordLog("Failed", generatedContent.title, "", keywords.join(", "), "Failed to publish to Blogger");
      Logger.log("Failed to publish blog post");
    }
    
  } catch (error) {
    Logger.log(`Error in runBlogAutomation: ${error}`);
    recordLog("Error", "", "", "", `Error: ${error.toString()}`);
  }
}

/**
 * Set up triggers for automated execution
 * @param {number} hour - Hour to run the trigger (0-23)
 * @param {number} minute - Minute to run the trigger (0-59)
 */
function setupTriggers(hour = 9, minute = 0) {
  // Clear existing triggers
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'runBlogAutomation') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  
  // Create new trigger based on configuration
  if (CONFIG.POST_FREQUENCY === 'DAILY') {
    ScriptApp.newTrigger('runBlogAutomation')
      .timeBased()
      .everyDays(1)
      .atHour(hour)
      .nearMinute(minute)
      .create();
    Logger.log(`Daily trigger set up for ${hour}:${minute < 10 ? '0' + minute : minute}`);
  } else if (CONFIG.POST_FREQUENCY === 'WEEKLY') {
    ScriptApp.newTrigger('runBlogAutomation')
      .timeBased()
      .everyWeeks(1)
      .onWeekDay(ScriptApp.WeekDay.MONDAY)
      .atHour(hour)
      .nearMinute(minute)
      .create();
    Logger.log(`Weekly trigger set up for Monday at ${hour}:${minute < 10 ? '0' + minute : minute}`);
  } else if (CONFIG.POST_FREQUENCY === 'HOURLY') {
    ScriptApp.newTrigger('runBlogAutomation')
      .timeBased()
      .everyHours(1)
      .nearMinute(minute)
      .create();
    Logger.log(`Hourly trigger set up for every hour at minute ${minute < 10 ? '0' + minute : minute}`);
  } else if (CONFIG.POST_FREQUENCY === 'MINUTELY') {
    ScriptApp.newTrigger('runBlogAutomation')
      .timeBased()
      .everyMinutes(30)
      .create();
    Logger.log(`Minutely trigger set up for every 30 minutes`);
  }
}

/**
 * Initialize the tracking sheets if they don't exist
 */
function initializeSheets() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SHEETS_ID);
    
    // Check and create Used Topics sheet if needed
    let usedTopicsSheet;
    try {
      usedTopicsSheet = ss.getSheetByName(CONFIG.USED_TOPICS_SHEET_NAME);
    } catch (e) {
      usedTopicsSheet = null;
    }
    
    if (!usedTopicsSheet) {
      usedTopicsSheet = ss.insertSheet(CONFIG.USED_TOPICS_SHEET_NAME);
      usedTopicsSheet.appendRow(['Topic', 'Source', 'Date', 'Status']);
      // Format header row
      usedTopicsSheet.getRange(1, 1, 1, 4).setFontWeight('bold');
    }
    
    // Check and create Logs sheet if needed
    let logsSheet;
    try {
      logsSheet = ss.getSheetByName(CONFIG.LOGS_SHEET_NAME);
    } catch (e) {
      logsSheet = null;
    }
    
    if (!logsSheet) {
      logsSheet = ss.insertSheet(CONFIG.LOGS_SHEET_NAME);
      logsSheet.appendRow(['Date', 'Status', 'Title', 'URL', 'Keywords', 'Notes']);
      // Format header row
      logsSheet.getRange(1, 1, 1, 6).setFontWeight('bold');
    }
    
    Logger.log("Sheets initialized successfully");
    return true;
  } catch (error) {
    Logger.log(`Error initializing sheets: ${error}`);
    return false;
  }
}

/**
 * Function to manually start the blog automation process
 * This can be triggered from the script editor manually
 */
function manualRun() {
  initializeSheets();
  runBlogAutomation();
}

/**
 * Function to set up the automation system
 * Initializes sheets and sets up triggers
 */
function setup() {
  if (initializeSheets()) {
    setupTriggers();
    Logger.log("Blog automation system set up successfully");
  } else {
    Logger.log("Failed to set up blog automation system");
  }
}

/**
 * Entry point for first-time setup
 * Initializes sheets, connects to Blogger API, and shows available blogs
 */
function initialSetup() {
  // Initialize the tracking sheets
  if (!initializeSheets()) {
    Logger.log("Failed to initialize tracking sheets");
    return;
  }
  
  // Set up Blogger connection and show available blogs
  if (!setupBloggerConnection()) {
    Logger.log("Failed to set up Blogger connection");
    return;
  }
  
  Logger.log("Initial setup complete! Before setting up triggers:");
  Logger.log("1. Select your blog ID from the list above");
  Logger.log("2. Update the CONFIG.BLOG_ID value in the script");
  Logger.log("3. Run the 'setup' function to configure triggers");
}

/**
 * IMPORTANT: First step in setup - Authorize the application
 * Run this function first to authorize with Blogger API
 */
function authorizeApp() {
  Logger.log("Starting the authorization process...");
  Logger.log("This will generate a URL that you need to visit to authorize the application.");
  
  // Call the startAuthorization function from BloggerAPI.gs
  const authUrl = startAuthorization();
  
  Logger.log("\n========== AUTHORIZATION REQUIRED ==========");
  Logger.log("1. Copy the URL below");
  Logger.log("2. Paste it into your browser");
  Logger.log("3. Sign in with your Google account");
  Logger.log("4. Grant the requested permissions");
  Logger.log("5. You'll be redirected to a page saying 'Authorization successful!'");
  Logger.log("6. After authorization is complete, return here and run the 'initialSetup' function");
  Logger.log("\nAuthorization URL:");
  Logger.log(authUrl);
  Logger.log("===========================================");
}