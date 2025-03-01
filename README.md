# Blog Automation System

This Google Apps Script-based system automates the creation of high-quality blog posts for Blogger using:
- Dynamic topic selection from RSS feeds or generated topics
- Content generation with Google Gemini API
- Relevant image selection from Pexels API
- Automated publishing to Blogger
- Tracking of used topics and logs in Google Sheets

## Features

- **Dynamic Topic Selection**: 
  - Fetches topics from configurable RSS feeds
  - Generates unique topics with Google Gemini API based on necessity and randomness
  - Ensures no duplicate topics by checking tracking sheets

- **Content Generation**:
  - Creates 1000-word blog content using Google Gemini API
  - Supports different content types (how-to, listicle, opinion, industry insight)
  - Formats content properly for Blogger with HTML tags

- **Image Integration**:
  - Extracts relevant keywords from generated content
  - Fetches appropriate images from Pexels API
  - Falls back to generic images if specific matches aren't found

- **Publishing & Tracking**:
  - Posts to Blogger with proper formatting, SEO tags, and images
  - Logs all published content to avoid duplication
  - Records post details in Google Sheets for monitoring and analysis

- **Automation**:
  - Runs on configurable schedule (daily, weekly)
  - Handles errors gracefully with detailed logging
  - Works completely unattended once set up

## Setup Instructions

### 1. Create a New Google Apps Script Project

1. Go to [Google Apps Script](https://script.google.com/)
2. Create a new project
3. Upload all the script files from this folder to your project:
   - `BlogAutomation.gs` (main script)
   - `TopicSelection.gs` (topic selection module)
   - `ContentGeneration.gs` (content generation module)
   - `ImageHandler.gs` (image handling module)
   - `BloggerAPI.gs` (Blogger API integration)

### 2. Add the OAuth2 Library

1. In your Apps Script project, click on Libraries (+ symbol)
2. Enter the OAuth2 library ID: `1B7FSrk5Zi6L1rSxxTDgDEUsPzlukDsi4KGuTMorsTQHhGBzBkMun4iDF`
3. Select the latest version and click "Add"

### 3. Configure the System

1. Open `BlogAutomation.gs`
2. Review the `CONFIG` object at the top
3. You can customize:
   - RSS feed sources
   - Content length
   - Post frequency (DAILY/WEEKLY)
   - Randomness factor for topic selection
   - Content type weights
   - Leave `BLOG_ID` blank for now - you'll fill this in later

### 4. Set Up Google Sheets

1. Open the Google Sheet with the ID in your configuration (`1JUURp3h1A114GnOVyB53uCWPY5ZsuAIwLzsAfBbSoYQ`)
2. If you want to use a different sheet:
   - Create a new Google Sheet
   - Share it with edit permissions to your Google Apps Script service account
   - Update the `SHEETS_ID` in the configuration

### 5. Set Up OAuth2 Credentials

#### Important: Fix for Error 400: redirect_uri_mismatch

When you try to authorize the application, you might encounter a `redirect_uri_mismatch` error. This happens because the OAuth credentials don't match your script's deployment. Follow these steps to fix it:

#### Option A: Create New OAuth Credentials (Recommended)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to "APIs & Services" > "Credentials"
4. Click "Create Credentials" > "OAuth client ID"
5. Select "Web application" as the application type
6. Give it a name like "Blog Automation"
7. Under "Authorized redirect URIs", add:
   - Your script's redirect URI (similar to `https://script.google.com/macros/d/YOUR_SCRIPT_ID/usercallback`)
   - You can find your script's ID in the Apps Script editor by going to Project Settings
8. Click "Create"
9. Copy the new Client ID and Client Secret
10. Update these values in the `CONFIG` object in `BlogAutomation.gs`

#### Option B: Deploy as Web App

1. In the Apps Script editor, click "Deploy" > "New deployment"
2. Select "Web app" as the deployment type
3. Set "Execute as" to "Me"
4. Set "Who has access" to "Anyone"
5. Click "Deploy"
6. Copy the Web App URL
7. Go to Google Cloud Console, find the OAuth client credentials you're using
8. Add the path `/usercallback` to your Web App URL and add this as an authorized redirect URI
9. Save the changes

### 6. Authorize the Application

1. Run the `authorizeApp` function from the Apps Script editor
2. This will generate an authorization URL in the logs
3. Copy and open this URL in your browser
4. Sign in with your Google account
5. Grant the requested permissions for Blogger access
6. You'll be redirected to a success page when complete

### 7. Connect to Your Blogger Account

1. After authorization is complete, run the `initialSetup` function
2. This will:
   - Initialize your tracking sheets
   - Authenticate with Blogger API
   - Display a list of your blogs with their IDs
3. Copy your preferred blog ID and update the `BLOG_ID` in the `CONFIG` object

### 8. Set Up Automation

1. Run the `setup` function from the Apps Script editor
2. This will:
   - Ensure your sheets are properly initialized
   - Set up the automatic trigger based on your configuration (daily/weekly)

## Obtaining API Keys and Credentials

### Google Gemini API Key

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project or select an existing one.
3. Navigate to `APIs & Services` > `Library`.
4. Search for `Gemini API` and enable it.
5. Go to `APIs & Services` > `Credentials`.
6. Click `Create Credentials` > `API Key`.
7. Copy the generated API key and update the `GEMINI_API_KEY` in the `CONFIG` object in `BlogAutomation.gs`.
8. Alternatively, you can use this [link to create Gemini API key](https://aistudio.google.com/app/apikey). Click `Create API Key`, select your Google Cloud project, and create the API key in the existing project.

### Pexels API Key

1. Go to the [Pexels API](https://www.pexels.com/api/).
2. Sign up for a free account if you don't have one.
3. Log in and navigate to the API section.
4. Click `Generate API Key`.
5. Copy the generated API key and update the `PEXELS_API_KEY` in the `CONFIG` object in `BlogAutomation.gs`.

### Blogger OAuth Credentials

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project or select an existing one.
3. Navigate to `APIs & Services` > `Library`.
4. Search for `Blogger API` and enable it.
5. Go to `APIs & Services` > `Credentials`.
6. Click `Create Credentials` > `OAuth client ID`.
7. Select `Web application` as the application type.
8. Under `Authorized redirect URIs`, add your script's redirect URI (similar to `https://script.google.com/macros/d/YOUR_SCRIPT_ID/usercallback`).
9. Click `Create`.
10. Copy the Client ID and Client Secret.
11. Update the `BLOGGER_CLIENT_ID` and `BLOGGER_CLIENT_SECRET` in the `CONFIG` object in `BlogAutomation.gs`.
12. Follow the steps in the `Set Up OAuth2 Credentials` section to handle the `redirect_uri_mismatch` error.

### Blogger Refresh Token

1. Follow the steps in the `Set Up OAuth2 Credentials` section to create OAuth2 credentials in the Google Cloud Console.
2. Run the `authorizeApp` function from the Apps Script editor.
3. This will generate an authorization URL in the logs.
4. Copy and open this URL in your browser.
5. Sign in with your Google account and grant the requested permissions for Blogger access.
6. You'll be redirected to a success page when complete.
7. The refresh token will be stored in the script's properties.
8. To retrieve the refresh token, you can run a function that logs the refresh token. For example:

```javascript
function logRefreshToken() {
  const scriptProperties = PropertiesService.getScriptProperties();
  const refreshToken = scriptProperties.getProperty('BLOGGER_REFRESH_TOKEN');
  Logger.log(`Refresh Token: ${refreshToken}`);
}
```
9. Run the `logRefreshToken` function from the Apps Script editor to see the refresh token in the logs.
10. Update the `BLOGGER_REFRESH_TOKEN` in the `CONFIG` object in `BlogAutomation.gs` with the retrieved refresh token.

### Google Sheets ID

1. Open the Google Sheet you want to use for tracking.
2. Share it with edit permissions to your Google Apps Script service account.
3. Copy the Sheet ID from the URL (the part after `/d/` and before `/edit`).
4. Update the `SHEETS_ID` in the `CONFIG` object in `BlogAutomation.gs`.

## Usage

### Manual Run

To manually trigger a blog post creation:

1. Open the Apps Script editor
2. Run the `manualRun` function
3. Check execution logs for progress and any errors

### Automated Usage

Once set up, the system will:

1. Run automatically based on your configured schedule
2. Select or generate a topic
3. Create blog content using Google Gemini API
4. Fetch a relevant image
5. Post to your Blogger blog
6. Log the details in your tracking sheets

### Tracking and Monitoring

Monitor your automation through:

1. Google Sheets tracking logs
2. Apps Script execution logs
3. Your Blogger dashboard

## Troubleshooting

### Common Issues

- **Authentication Errors**:
  1. Run `clearToken()` to reset authentication
  2. Run `authorizeApp()` to restart the authorization process
  3. Make sure you visit the authorization URL and grant permissions
  
- **No Blog Posts Generated**:
  1. Check your API keys in the CONFIG object
  2. Verify the tracking sheets are properly initialized
  3. Check Apps Script execution logs for specific errors
  
- **Image Not Appearing**:
  1. Verify your Pexels API key is correct
  2. Check if the image search keywords make sense
  3. Look for errors in the execution logs

### Getting Help

If you encounter issues:
1. Check the Apps Script execution logs for detailed error messages
2. Review the Logs sheet in your Google Sheet for operation history
3. Validate your API keys and credentials are correct

## Step-by-Step Setup Walkthrough

For first-time setup, follow these steps in exact order:

1. **Create Google Apps Script project and add files**
2. **Add the OAuth2 library**
3. **Run `authorizeApp()`** - The most important first step!
4. **Copy the authorization URL from logs and open it in your browser**
5. **Grant permission to the app**
6. **Run `initialSetup()` to see your available blogs**
7. **Copy a blog ID and update the CONFIG.BLOG_ID value**
8. **Run `setup()` to configure automatic triggers**
9. **Test with `manualRun()` to create your first automated post**

## Configuration Options

### Adjusting Content Generation

To change the style or length of generated content:
- Modify `CONTENT_LENGTH` in the CONFIG object
- Adjust the weights in `CONTENT_TYPES` to favor different post styles

### Customizing Topic Selection

To change how topics are selected:
- Add or remove RSS feeds in `RSS_FEEDS` array
- Adjust `RANDOMNESS_FACTOR` (higher value = more Gemini-generated topics)

### Changing Post Frequency

To change how often posts are created:
- Update `POST_FREQUENCY` to "DAILY", "WEEKLY", "HOURLY" or "MINUTELY"
- Run `setup()` function again to apply changes

## Credits

- Uses Google Gemini API for content generation
- Uses Pexels API for image selection
- Uses Google OAuth2 library for Blogger authentication