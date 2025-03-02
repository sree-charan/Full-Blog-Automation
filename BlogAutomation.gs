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
  },
  
  // API Access security
  API_ACCESS_KEY: '' // Fill this with a random string for basic API authentication
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

/**
 * ===== NEW ENDPOINT FUNCTIONALITY =====
 */

/**
 * Web endpoint to generate and publish blog posts based on custom topics
 * This function allows you to trigger blog generation from anywhere by making an HTTP request
 * 
 * @param {Object} e - Event object from web app request
 * @return {Object} - JSON response with status of the blog creation
 */
function doPost(e) {
  try {
    // Check for authorization
    const accessKey = e.parameter.accessKey;
    if (!accessKey || accessKey !== CONFIG.API_ACCESS_KEY) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Access denied. Invalid or missing access key.'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Parse the request parameters
    let title, description, contentType;
    
    // Check if the request body contains JSON data
    if (e.postData && e.postData.type === "application/json") {
      const requestData = JSON.parse(e.postData.contents);
      title = requestData.title;
      description = requestData.description || "";
      contentType = requestData.contentType || selectContentType();
    } else {
      // Get parameters from URL parameters
      title = e.parameter.title;
      description = e.parameter.description || "";
      contentType = e.parameter.contentType || selectContentType();
    }
    
    // Validate required parameters
    if (!title) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Missing required parameter: title'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Create a topic object from the custom parameters
    const customTopic = {
      title: title,
      description: description,
      source: 'Custom API Request',
      contentType: contentType
    };
    
    Logger.log(`Custom topic request received: ${customTopic.title}`);
    
    // Initialize sheets if needed
    initializeSheets();
    
    // Generate content for this custom topic
    const generatedContent = generateContent(customTopic);
    if (!generatedContent) {
      Logger.log("Failed to generate content for custom topic");
      recordLog("Failed", customTopic.title, "", "", "Failed to generate content from API request");
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Failed to generate content'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Extract keywords and fetch image
    const keywords = extractKeywords(generatedContent);
    const imageUrl = fetchImage(keywords);
    
    // Post to Blogger
    const postUrl = postToBlogger(generatedContent.title, generatedContent.content, imageUrl, keywords);
    
    // Log the result
    if (postUrl) {
      trackUsedTopic(customTopic.title, customTopic.source);
      recordLog("Published", generatedContent.title, postUrl, keywords.join(", "), "Successfully published from API request");
      Logger.log(`Successfully published custom topic blog post: ${postUrl}`);
      
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        title: generatedContent.title,
        url: postUrl,
        keywords: keywords
      })).setMimeType(ContentService.MimeType.JSON);
    } else {
      recordLog("Failed", generatedContent.title, "", keywords.join(", "), "Failed to publish to Blogger from API request");
      Logger.log("Failed to publish custom topic blog post");
      
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Failed to publish blog post'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
  } catch (error) {
    Logger.log(`Error in doPost: ${error}`);
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handle GET requests - can now be used to both test if the endpoint is working
 * AND to generate blog posts from custom topics via URL parameters
 * 
 * @param {Object} e - Event object from web app request
 * @return {Object} - JSON response with status of the blog creation or redirect to the blog post
 */
function doGet(e) {
  // Check if this is a blog post generation request (has title and accessKey)
  if (e.parameter.title && e.parameter.accessKey) {
    // Check for authorization
    const accessKey = e.parameter.accessKey;
    if (!accessKey || accessKey !== CONFIG.API_ACCESS_KEY) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Access denied. Invalid or missing access key.'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Check if redirection is requested - default to true for direct URL usage
    const redirect = e.parameter.redirect !== 'false';
    
    // Get parameters from URL parameters
    const title = e.parameter.title;
    const description = e.parameter.description || "";
    const contentType = e.parameter.contentType || selectContentType();
    
    // Create a topic object from the custom parameters
    const customTopic = {
      title: title,
      description: description,
      source: 'Custom API Request (GET)',
      contentType: contentType
    };
    
    Logger.log(`Custom topic request received via GET: ${customTopic.title}`);
    
    // Initialize sheets if needed
    initializeSheets();
    
    // Generate content for this custom topic
    const generatedContent = generateContent(customTopic);
    if (!generatedContent) {
      Logger.log("Failed to generate content for custom topic");
      recordLog("Failed", customTopic.title, "", "", "Failed to generate content from API request (GET)");
      
      if (redirect) {
        // Can't redirect, so send an error page
        return HtmlService.createHtmlOutput(
          '<html><body>' +
          '<h1>Blog Generation Failed</h1>' +
          '<p>Failed to generate content for the topic. Please check the logs.</p>' +
          '<p><a href="javascript:history.back()">Go Back</a></p>' +
          '</body></html>'
        );
      } else {
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          error: 'Failed to generate content'
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    // Extract keywords and fetch image
    const keywords = extractKeywords(generatedContent);
    const imageUrl = fetchImage(keywords);
    
    // Post to Blogger
    const postUrl = postToBlogger(generatedContent.title, generatedContent.content, imageUrl, keywords);
    
    // Log the result
    if (postUrl) {
      trackUsedTopic(customTopic.title, customTopic.source);
      recordLog("Published", generatedContent.title, postUrl, keywords.join(", "), "Successfully published from API request (GET)");
      Logger.log(`Successfully published custom topic blog post via GET: ${postUrl}`);
      
      if (redirect) {
        // Create a special template for redirect that breaks out of the iframe
        // and includes styling and warning banner hiding
        const template = HtmlService.createTemplate(
          `<!DOCTYPE html>
          <html>
            <head>
              <base target="_top">
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Redirecting to: <?= title ?></title>
              <style>
                body {
                  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
                  margin: 0;
                  padding: 0;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  min-height: 100vh;
                  color: #333;
                }
                .container {
                  background: white;
                  border-radius: 12px;
                  box-shadow: 0 10px 30px rgba(0,0,0,0.1);
                  padding: 30px 40px;
                  text-align: center;
                  max-width: 500px;
                  width: 90%;
                  position: relative;
                  overflow: hidden;
                }
                .container:before {
                  content: '';
                  position: absolute;
                  top: 0;
                  left: 0;
                  width: 100%;
                  height: 5px;
                  background: linear-gradient(90deg, #00C9FF 0%, #92FE9D 100%);
                }
                h1 {
                  color: #444;
                  margin-bottom: 15px;
                  font-size: 24px;
                }
                .redirect-progress {
                  width: 100%;
                  height: 4px;
                  background: #eee;
                  margin: 20px 0;
                  border-radius: 3px;
                  overflow: hidden;
                }
                .progress-bar {
                  height: 100%;
                  background: linear-gradient(90deg, #00C9FF 0%, #92FE9D 100%);
                  width: 0;
                  transition: width 3s linear;
                }
                p {
                  line-height: 1.6;
                  color: #666;
                  margin: 15px 0;
                }
                .blog-title {
                  font-weight: 600;
                  color: #3a7bd5;
                  display: inline-block;
                  margin-top: 10px;
                }
                .btn {
                  display: inline-block;
                  background: linear-gradient(90deg, #00C9FF 0%, #92FE9D 100%);
                  color: white;
                  text-decoration: none;
                  padding: 10px 25px;
                  border-radius: 25px;
                  font-weight: 500;
                  margin-top: 15px;
                  box-shadow: 0 4px 15px rgba(0,201,255,0.2);
                  transition: all 0.3s ease;
                }
                .btn:hover {
                  box-shadow: 0 6px 18px rgba(0,201,255,0.3);
                  transform: translateY(-2px);
                }
                .logo {
                  width: 60px;
                  height: 60px;
                  background: #f1f1f1;
                  border-radius: 50%;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  margin: 0 auto 15px;
                }
                .logo svg {
                  width: 35px;
                  height: 35px;
                }
                /* This is to hide the Google Apps Script warning banner */
                .warning-bar, .warning-banner-bar {
                  display: none !important;
                  visibility: hidden !important;
                  opacity: 0 !important;
                  height: 0 !important;
                  padding: 0 !important;
                  margin: 0 !important;
                }
                @media (max-width: 480px) {
                  .container {
                    padding: 20px 25px;
                  }
                }
              </style>
              <script>
                // Hide the warning banner as soon as possible
                document.addEventListener('DOMContentLoaded', function() {
                  // First attempt to hide the warning banner
                  hideWarningBanner();
                  
                  // Set up animation for the progress bar
                  var progressBar = document.querySelector('.progress-bar');
                  setTimeout(function() {
                    progressBar.style.width = '100%';
                  }, 100);
                  
                  // Try several methods to redirect
                  redirectToPost();
                });
                
                // Function to hide warning banner
                function hideWarningBanner() {
                  // Target elements with class 'warning-bar' or 'warning-banner-bar'
                  var warningElements = document.querySelectorAll('.warning-bar, .warning-banner-bar');
                  warningElements.forEach(function(element) {
                    element.style.display = 'none';
                    element.style.visibility = 'hidden';
                    element.style.opacity = '0';
                    element.style.height = '0';
                    element.style.padding = '0';
                    element.style.margin = '0';
                  });
                  
                  // Add more aggressive methods
                  var style = document.createElement('style');
                  style.textContent = '.warning-bar, .warning-banner-bar { display: none !important; visibility: hidden !important; opacity: 0 !important; height: 0 !important; }';
                  document.head.appendChild(style);
                  
                  // Keep trying to hide the banner in case it loads after our script
                  setTimeout(hideWarningBanner, 100);
                }
                
                // Function to redirect to the blog post
                function redirectToPost() {
                  const url = "<?= postUrl ?>";
                  
                  // Set a timeout to redirect after 3 seconds (matches progress bar animation)
                  setTimeout(function() {
                    // Method 1: window.top
                    try {
                      window.top.location.href = url;
                    } catch(e) {
                      console.log("Method 1 failed, trying method 2");
                      // Method 2: parent
                      try {
                        parent.window.location.href = url;
                      } catch(e) {
                        console.log("Method 2 failed, trying method 3");
                        // Method 3: Regular location
                        window.location.href = url;
                      }
                    }
                  }, 3000);
                }
              </script>
            </head>
            <body onload="hideWarningBanner()">
              <div class="container">
                <div class="logo">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h1>Blog Post Published Successfully!</h1>
                <p>Your blog post has been created and published. You will be automatically redirected to view it in a moment.</p>
                <div class="redirect-progress">
                  <div class="progress-bar"></div>
                </div>
                <p>Redirecting to: <span class="blog-title"><?= title ?></span></p>
                <a href="<?= postUrl ?>" class="btn" target="_blank">View Now</a>
              </div>
              <script>
                // One more attempt to hide the warning banner
                hideWarningBanner();
              </script>
            </body>
          </html>`
        );
        
        // Set template values
        template.postUrl = postUrl;
        template.title = generatedContent.title;
        
        // Create HTML output with special sandbox options to allow top navigation
        const htmlOutput = HtmlService.createHtmlOutput(template.evaluate())
          .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
          .setSandboxMode(HtmlService.SandboxMode.IFRAME)
          .addMetaTag('viewport', 'width=device-width, initial-scale=1')
          .setTitle(`Redirecting to: ${generatedContent.title}`);
          
        return htmlOutput;
      } else {
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          title: generatedContent.title,
          url: postUrl,
          keywords: keywords
        })).setMimeType(ContentService.MimeType.JSON);
      }
    } else {
      recordLog("Failed", generatedContent.title, "", keywords.join(", "), "Failed to publish to Blogger from API request (GET)");
      Logger.log("Failed to publish custom topic blog post via GET");
      
      if (redirect) {
        // Can't redirect, so send an error page with better styling
        return HtmlService.createHtmlOutput(`
          <!DOCTYPE html>
          <html>
            <head>
              <base target="_top">
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Blog Publication Failed</title>
              <style>
                body {
                  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
                  margin: 0;
                  padding: 0;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  min-height: 100vh;
                  color: #333;
                }
                .container {
                  background: white;
                  border-radius: 12px;
                  box-shadow: 0 10px 30px rgba(0,0,0,0.1);
                  padding: 30px 40px;
                  text-align: center;
                  max-width: 500px;
                  width: 90%;
                  position: relative;
                  overflow: hidden;
                }
                .container:before {
                  content: '';
                  position: absolute;
                  top: 0;
                  left: 0;
                  width: 100%;
                  height: 5px;
                  background: linear-gradient(90deg, #FF416C 0%, #FF4B2B 100%);
                }
                h1 {
                  color: #d63031;
                  margin-bottom: 20px;
                }
                p {
                  line-height: 1.6;
                  color: #666;
                  margin-bottom: 20px;
                }
                .btn {
                  display: inline-block;
                  background: #6c5ce7;
                  color: white;
                  text-decoration: none;
                  padding: 10px 20px;
                  border-radius: 25px;
                  font-weight: 500;
                }
                .warning-bar, .warning-banner-bar {
                  display: none !important;
                  visibility: hidden !important;
                  opacity: 0 !important;
                  height: 0 !important;
                  padding: 0 !important;
                  margin: 0 !important;
                }
              </style>
              <script>
                // Hide the warning banner
                document.addEventListener('DOMContentLoaded', function() {
                  var warningElements = document.querySelectorAll('.warning-bar, .warning-banner-bar');
                  warningElements.forEach(function(element) {
                    element.style.display = 'none';
                    element.style.visibility = 'hidden';
                  });
                  
                  var style = document.createElement('style');
                  style.textContent = '.warning-bar, .warning-banner-bar { display: none !important; visibility: hidden !important; }';
                  document.head.appendChild(style);
                });
              </script>
            </head>
            <body>
              <div class="container">
                <h1>Blog Publication Failed</h1>
                <p>Generated content but failed to publish to Blogger. Please check the logs for more information.</p>
                <a href="javascript:history.back()" class="btn">Go Back</a>
              </div>
            </body>
          </html>
        `);
      } else {
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          error: 'Failed to publish blog post'
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
  } else {
    // This is just an API status check
    return ContentService.createTextOutput(JSON.stringify({
      status: 'Blog Automation API is active',
      documentation: 'To generate a blog post, include title, accessKey, and optionally description and contentType parameters',
      usage: 'Example: ?accessKey=YOUR_KEY&title=How%20to%20Build%20a%20Smart%20Home&description=Budget-friendly%20options&contentType=how-to',
      note: 'Add redirect=false if you want JSON output instead of automatic redirection',
      time: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Generate and set a random access key for API security
 * Run this function to generate a new API key
 */
function generateApiAccessKey() {
  const randomKey = Utilities.getUuid();
  
  // Store this key in script properties for persistence
  PropertiesService.getScriptProperties().setProperty('API_ACCESS_KEY', randomKey);
  
  Logger.log(`New API access key generated: ${randomKey}`);
  Logger.log("Add this key to your CONFIG.API_ACCESS_KEY or use it as the accessKey parameter in API requests");
  
  return randomKey;
}

/**
 * Get the current API access key
 * Run this function to see your current API key
 */
function getApiAccessKey() {
  // Try to get from script properties first
  const storedKey = PropertiesService.getScriptProperties().getProperty('API_ACCESS_KEY');
  
  if (storedKey) {
    Logger.log(`Current API access key: ${storedKey}`);
    return storedKey;
  } else {
    Logger.log("No API access key found. Run generateApiAccessKey() to create one.");
    return null;
  }
}