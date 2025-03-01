/**
 * Blogger API Integration Module
 * 
 * This module handles:
 * - OAuth2 authentication with Google Blogger API
 * - Posting content to Blogger
 * - Managing blog posts
 */

/**
 * Authenticates with Blogger API using OAuth2
 * @return {Object} OAuth2 service instance
 */
function getOAuth2Service() {
  return OAuth2.createService('blogger')
      .setAuthorizationBaseUrl('https://accounts.google.com/o/oauth2/auth')
      .setTokenUrl('https://accounts.google.com/o/oauth2/token')
      .setClientId(CONFIG.BLOGGER_CLIENT_ID)
      .setClientSecret(CONFIG.BLOGGER_CLIENT_SECRET)
      .setScope('https://www.googleapis.com/auth/blogger')
      .setParam('access_type', 'offline')
      .setParam('prompt', 'consent')
      .setCallbackFunction('authCallback')
      .setPropertyStore(PropertiesService.getUserProperties());
}

/**
 * Authorization callback function - required for the OAuth2 flow
 * @param {Object} request The request data
 * @return {HtmlOutput} HTML to show the user
 */
function authCallback(request) {
  const service = getOAuth2Service();
  const authorized = service.handleCallback(request);
  
  if (authorized) {
    return HtmlService.createHtmlOutput('Authorization successful! You can close this tab and return to the script editor.');
  } else {
    return HtmlService.createHtmlOutput('Authorization failed. Please try again.');
  }
}

/**
 * Starts the authorization process
 * This generates a URL that the user must visit to authorize the application
 */
function startAuthorization() {
  const service = getOAuth2Service();
  
  if (service.hasAccess()) {
    Logger.log('Already authorized');
    return;
  }
  
  // Get the authorization URL
  const authorizationUrl = service.getAuthorizationUrl();
  
  // Log the URL - user must visit this URL to authorize the app
  Logger.log('Open the following URL and authorize the app:');
  Logger.log(authorizationUrl);
  Logger.log('After authorization, you can run the initialSetup function again.');
  
  // Return the URL for programmatic access if needed
  return authorizationUrl;
}

/**
 * Checks if the service is authorized
 * @return {boolean} True if authorized
 */
function isAuthorized() {
  const service = getOAuth2Service();
  return service.hasAccess();
}

/**
 * Clears the stored OAuth2 token
 * Useful when you want to force a new authorization
 */
function clearToken() {
  const service = getOAuth2Service();
  service.reset();
  Logger.log('Token cleared. You need to reauthorize the application.');
}

/**
 * Refreshes the OAuth2 token using the refresh token
 * @return {boolean} True if token was refreshed successfully
 */
function refreshToken() {
  try {
    const service = getOAuth2Service();
    
    // If we don't have access, and can't refresh, we need to authorize again
    if (!service.hasAccess()) {
      Logger.log("No valid token available. Need to reauthorize.");
      return false;
    }
    
    return true;
    
  } catch (error) {
    Logger.log(`Error refreshing token: ${error}`);
    return false;
  }
}

/**
 * Gets the user's blogs
 * @return {Array} List of user's blogs
 */
function getBlogs() {
  try {
    const service = getOAuth2Service();
    if (!service.hasAccess()) {
      Logger.log("Not authorized to access Blogger API");
      return null;
    }
    
    const accessToken = service.getAccessToken();
    const apiUrl = 'https://www.googleapis.com/blogger/v3/users/self/blogs';
    
    const options = {
      method: 'get',
      headers: {
        'Authorization': 'Bearer ' + accessToken
      },
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(apiUrl, options);
    const responseCode = response.getResponseCode();
    
    if (responseCode !== 200) {
      Logger.log(`Blogger API Error: ${responseCode} - ${response.getContentText()}`);
      return null;
    }
    
    const responseData = JSON.parse(response.getContentText());
    return responseData.items || [];
    
  } catch (error) {
    Logger.log(`Error getting blogs: ${error}`);
    return null;
  }
}

/**
 * Posts content to Blogger
 * @param {string} title The blog post title
 * @param {string} content The HTML content
 * @param {string} imageUrl URL of the image to include
 * @param {Array} keywords List of keywords for labels/tags
 * @return {string} URL of the published post or null if failed
 */
function postToBlogger(title, content, imageUrl, keywords) {
  try {
    const blogId = CONFIG.BLOG_ID;
    if (!blogId) {
      Logger.log("No blog ID configured");
      return null;
    }
    
    const service = getOAuth2Service();
    if (!service.hasAccess()) {
      Logger.log("Not authorized to access Blogger API");
      return null;
    }
    
    // Validate content before posting
    if (!content || content.trim().length < 50) {
      Logger.log("Content is too short or invalid - less than 50 chars");
      // Generate emergency content
      content = `<p>This is an automatically generated post about "${title}".</p>
                <p>The original article content could not be generated properly.</p>
                <p>Please check back later for more detailed information on this topic.</p>
                <p><em>This post was published as part of our automated content series.</em></p>`;
    }
    
    // Ensure content is wrapped in proper HTML
    if (!content.includes("<p>") && !content.includes("<h")) {
      content = `<p>${content}</p>`;
    }
    
    const accessToken = service.getAccessToken();
    const apiUrl = `https://www.googleapis.com/blogger/v3/blogs/${blogId}/posts`;
    
    // Format content with image if available - using Blogger's preferred format
    let formattedContent = content;
    if (imageUrl) {
      // Use Blogger's native separator format for images
      formattedContent = `<span style="font-size: large;">
            <a href="${imageUrl}" imageanchor="1" style="margin-left: 1em; margin-right: 1em;">
                <img border="0" src="${imageUrl}" />
            </a>
        </span>
           
      ${content}`;
    }
    
    Logger.log(`Publishing post with title: "${title}" and content length: ${formattedContent.length} chars`);
    
    const payload = {
      kind: 'blogger#post',
      title: title,
      content: formattedContent,
      labels: keywords || []
    };
    
    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      headers: {
        'Authorization': 'Bearer ' + accessToken
      },
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(apiUrl, options);
    const responseCode = response.getResponseCode();
    
    if (responseCode !== 200) {
      Logger.log(`Error posting to Blogger: ${responseCode} - ${response.getContentText()}`);
      return null;
    }
    
    const responseData = JSON.parse(response.getContentText());
    Logger.log(`Successfully published post with URL: ${responseData.url}`);
    return responseData.url; // Return the URL of the published post
    
  } catch (error) {
    Logger.log(`Error posting to Blogger: ${error}`);
    return null;
  }
}

/**
 * Gets a list of recent posts to avoid duplication
 * @param {number} maxResults Maximum number of results to return
 * @return {Array} List of recent post titles
 */
function getRecentPosts(maxResults = 10) {
  try {
    const blogId = CONFIG.BLOG_ID;
    if (!blogId) {
      Logger.log("No blog ID configured");
      return [];
    }
    
    const service = getOAuth2Service();
    if (!service.hasAccess()) {
      Logger.log("Not authorized to access Blogger API");
      return [];
    }
    
    const accessToken = service.getAccessToken();
    const apiUrl = `https://www.googleapis.com/blogger/v3/blogs/${blogId}/posts?maxResults=${maxResults}`;
    
    const options = {
      method: 'get',
      headers: {
        'Authorization': 'Bearer ' + accessToken
      },
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(apiUrl, options);
    const responseCode = response.getResponseCode();
    
    if (responseCode !== 200) {
      Logger.log(`Blogger API Error: ${responseCode} - ${response.getContentText()}`);
      return [];
    }
    
    const responseData = JSON.parse(response.getContentText());
    
    // Extract titles from posts
    return (responseData.items || []).map(post => post.title);
    
  } catch (error) {
    Logger.log(`Error getting recent posts: ${error}`);
    return [];
  }
}

/**
 * Helper function to set up the Blogger API connection
 * Allows the user to select which blog to post to
 */
function setupBloggerConnection() {
  try {
    // Check if authorized
    const service = getOAuth2Service();
    
    if (!service.hasAccess()) {
      // Start the authorization process
      const authUrl = startAuthorization();
      Logger.log("You need to authorize the application before proceeding.");
      Logger.log("Please visit the authorization URL logged above.");
      return false;
    }
    
    // Get available blogs
    const blogs = getBlogs();
    if (!blogs || blogs.length === 0) {
      Logger.log("No blogs found for this account");
      return false;
    }
    
    // Log blogs so user can choose one
    Logger.log("Available blogs:");
    blogs.forEach((blog, index) => {
      Logger.log(`${index + 1}. ${blog.name} (ID: ${blog.id})`);
    });
    
    Logger.log("\nTo set your blog ID, edit the CONFIG.BLOG_ID value in the script.");
    
    return true;
    
  } catch (error) {
    Logger.log(`Error setting up Blogger connection: ${error}`);
    return false;
  }
}