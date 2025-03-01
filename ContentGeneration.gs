/**
 * Content Generation Module
 * 
 * This module handles:
 * - Content generation using Google Gemini API
 * - Keyword extraction from generated content
 * - Content formatting for Blogger
 */

/**
 * Generates blog content from a selected topic
 * @param {Object} topicData The selected topic data
 * @return {Object} The generated content including title and content
 */
function generateContent(topicData) {
  try {
    // Determine content type if not already set
    const contentType = topicData.contentType || selectContentType();
    
    // Prepare the prompt for Gemini API
    let prompt;
    
    // If the topic comes from RSS, build a prompt based on title and description
    if (topicData.source.startsWith('RSS')) {
      prompt = `Write an engaging, informative, and original blog post about "${topicData.title}".
      
      Context about the topic:
      ${topicData.description}
      
      The article should be approximately ${CONFIG.CONTENT_LENGTH} words and formatted as a ${contentType} style post.
      
      Include:
      - A catchy introduction that hooks the reader
      - Main points with clear explanations
      - Relevant examples or case studies where appropriate
      - A conclusion with key takeaways
      
      Important instructions:
      1. Do NOT use placeholder text like "[Insert X]" or template language. Use specific content.
      2. Do NOT use markdown formatting like **bold** or *italic* - use HTML tags like <strong> or <em> instead.
      3. Do NOT wrap your response in code blocks, just respond with the direct JSON.
      
      Format your response as a JSON object with fields:
      "title": An SEO-optimized title (you can refine the original title)
      "content": The full blog post content with proper HTML formatting (h2, p, ul, etc.)
      
      Do not include any disclaimer about AI-generated content.`;
      
    } else {
      // For generated topics, create a more open-ended prompt
      prompt = `Write an engaging, informative, and original blog post for the topic: "${topicData.title}".
      
      Context about the topic:
      ${topicData.description}
      
      The article should be approximately ${CONFIG.CONTENT_LENGTH} words and formatted as a ${contentType} style post.
      
      Include:
      - A catchy introduction that hooks the reader
      - Main points with clear explanations
      - Relevant examples or case studies where appropriate
      - A conclusion with key takeaways
      
      Important instructions:
      1. Do NOT use placeholder text like "[Insert X]" or template language. Use specific content.
      2. Do NOT use markdown formatting like **bold** or *italic* - use HTML tags like <strong> or <em> instead.
      3. Do NOT wrap your response in code blocks, just respond with the direct JSON.
      
      Format your response as a JSON object with fields:
      "title": An SEO-optimized title (you can refine the original title)
      "content": The full blog post content with proper HTML formatting (h2, p, ul, etc.)
      
      Do not include any disclaimer about AI-generated content.`;
    }
    
    // Call Gemini API to generate content
    const generatedContent = callGeminiAPI(prompt);
    Logger.log("Raw Gemini response: " + JSON.stringify(generatedContent));
    
    if (!generatedContent) {
      Logger.log("Failed to generate content from Gemini API - null response");
      return null;
    }
    
    // If content is missing, try a fallback approach with plain text
    if (!generatedContent.content) {
      Logger.log("Structured content not found in response, trying fallback method");
      return generateFallbackContent(topicData);
    }
    
    // Check for placeholder text and attempt to fix
    let cleanedContent = generatedContent.content;
    if (typeof cleanedContent === 'string' && cleanedContent.includes('Insert')) {
      Logger.log("Found placeholder text, requesting a fix");
      return generateFallbackContent(topicData, cleanedContent);
    }
    
    // Convert any remaining markdown to HTML
    cleanedContent = convertMarkdownToHtml(cleanedContent);
    
    // Process and format the content
    return {
      title: generatedContent.title || topicData.title,
      content: formatContentForBlogger(cleanedContent, topicData.title),
      originalTopic: topicData.title
    };
    
  } catch (error) {
    Logger.log(`Error generating content: ${error}`);
    return null;
  }
}

/**
 * Convert markdown formatting to HTML
 * @param {string} content Content that might contain markdown
 * @return {string} Content with markdown converted to HTML
 */
function convertMarkdownToHtml(content) {
  if (typeof content !== 'string') return '';
  
  return content
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')  // Bold: **text** -> <strong>text</strong>
    .replace(/\*(.*?)\*/g, '<em>$1</em>')              // Italic: *text* -> <em>text</em>
    .replace(/^# (.*?)$/gm, '<h1>$1</h1>')             // # heading -> <h1>heading</h1>
    .replace(/^## (.*?)$/gm, '<h2>$1</h2>')            // ## heading -> <h2>heading</h2>
    .replace(/^### (.*?)$/gm, '<h3>$1</h3>')           // ### heading -> <h3>heading</h3>
    .replace(/^\* (.*?)$/gm, '<li>$1</li>');           // * item -> <li>item</li>
}

/**
 * Fallback method to generate content if structured JSON fails
 * @param {Object} topicData The topic data
 * @param {string} partialContent Optional partial content that needs fixing
 * @return {Object} Formatted content
 */
function generateFallbackContent(topicData, partialContent = null) {
  try {
    // Use a simpler prompt that doesn't ask for JSON
    let prompt;
    if (partialContent) {
      prompt = `Rewrite the following blog post about "${topicData.title}" to be approximately ${CONFIG.CONTENT_LENGTH} words.
      
      Replace ALL placeholder text like "[Insert X]" with actual, specific content.
      Do not use any placeholder or template language.
      Do NOT use markdown formatting like **bold** or *italic* - use HTML tags like <strong> or <em> instead.
      
      Here's the content to fix:
      ${partialContent.substring(0, 4000)} // Limit to avoid token issues
      
      Context about the topic: ${topicData.description}`;
    } else {
      prompt = `Write an engaging blog post about "${topicData.title}" that's around ${CONFIG.CONTENT_LENGTH} words. 
      Include a good introduction, main content sections with specific examples (not placeholders), and a conclusion.
      
      Here's some context about the topic: ${topicData.description}
      
      Important:
      1. Do NOT use placeholder text like "[Insert X]" or template language. Use actual, specific examples.
      2. Do NOT use markdown formatting like **bold** or *italic* - use HTML tags like <strong> or <em> instead.
      3. Use HTML formatting for headings, lists, etc.`;
    }
    
    // Call Gemini API with raw text output
    const rawContent = callGeminiAPI(prompt, true);
    
    if (!rawContent || typeof rawContent !== 'string' || rawContent.trim().length === 0) {
      Logger.log("Failed to generate fallback content");
      return null;
    }
    
    // Create a basic title if needed
    const title = topicData.title;
    
    // Remove any JSON syntax that might have leaked through
    let cleanedContent = cleanJsonSyntax(rawContent);
    
    // Convert any markdown to HTML
    cleanedContent = convertMarkdownToHtml(cleanedContent);
    
    // Format the raw content
    const content = formatContentForBlogger(cleanedContent, title);
    
    return {
      title: title,
      content: content,
      originalTopic: topicData.title
    };
    
  } catch (error) {
    Logger.log(`Error generating fallback content: ${error}`);
    return null;
  }
}

/**
 * Clean any JSON syntax that might have leaked into the content
 * @param {string} content The content that might have JSON syntax
 * @return {string} Cleaned content
 */
function cleanJsonSyntax(content) {
  if (typeof content !== 'string') return '';
  
  // Remove common JSON formatting issues
  return content
    .replace(/```json[\s\S]*?```/g, '') // Remove JSON code blocks with content
    .replace(/```[\s\S]*?```/g, '')     // Remove any code blocks with content
    .replace(/```json/g, '')            // Remove standalone JSON markers
    .replace(/```/g, '')                // Remove standalone code markers
    .replace(/\n\n'''json/g, '')        // Remove JSON markers
    .replace(/'''/g, '')                // Remove triple quotes
    .replace(/"title":\s*"[^"]*",?\s*/g, '') // Remove JSON title field
    .replace(/"content":\s*"/g, '')     // Remove JSON content field start
    .replace(/"\s*}\s*$/g, '')          // Remove JSON ending
    .replace(/\\n/g, '\n')              // Convert escaped newlines
    .replace(/\\"/g, '"');              // Convert escaped quotes
}

/**
 * Formats content for Blogger platform ensuring proper HTML
 * @param {string} content The raw generated content
 * @param {string} [title] Optional title to use in emergency content
 * @return {string} Formatted HTML content for Blogger
 */
function formatContentForBlogger(content, title = "this topic") {
  try {
    // If content is undefined or null, return empty paragraph
    if (!content) {
      Logger.log("Empty content received, returning placeholder");
      return "<p>Content generation failed. Please check the logs for more information.</p>";
    }
    
    // Ensure content is a string
    content = content.toString().trim();
    Logger.log("Formatting content of length: " + content.length);
    
    // If content doesn't start with HTML tags, wrap paragraphs
    if (!content.startsWith('<')) {
      const paragraphs = content.split('\n\n');
      content = paragraphs.map(p => {
        p = p.trim();
        if (!p) return '';
        if (p.startsWith('# ')) {
          return `<h1>${p.substring(2)}</h1>`;
        } else if (p.startsWith('## ')) {
          return `<h2>${p.substring(3)}</h2>`;
        } else if (p.startsWith('### ')) {
          return `<h3>${p.substring(4)}</h3>`;
        } else if (p.startsWith('- ')) {
          const items = p.split('\n- ').map(item => item.replace(/^- /, ''));
          return `<ul>${items.map(item => `<li>${item}</li>`).join('')}</ul>`;
        } else if (p.match(/^\d+\. /)) {
          const items = p.split(/\n\d+\. /).filter(i => i.trim().length > 0);
          return `<ol>${items.map(item => `<li>${item}</li>`).join('')}</ol>`;
        } else {
          return `<p>${p}</p>`;
        }
      }).join('\n');
    }
    
    // Check if content is still empty after formatting
    if (content.length < 10) {
      Logger.log("Content too short after formatting, using emergency content");
      content = `<p>This is an automatically generated post about ${title}.</p>
                <p>Please check back later for more detailed information on this topic.</p>`;
    }
    
    // Add a signature
    content += '\n<p><em>This post was published as part of our automated content series.</em></p>';
    
    return content;
  } catch (error) {
    Logger.log(`Error formatting content: ${error}`);
    return "<p>Error formatting content. Please check the logs.</p>";
  }
}

/**
 * Extracts keywords from the generated content for SEO and image search
 * @param {Object} generatedContent The generated blog content
 * @return {Array} List of keywords
 */
function extractKeywords(generatedContent) {
  try {
    // First try to extract keywords using Gemini API
    const prompt = `Extract 3-5 relevant SEO keywords from the following blog post title and content. 
    Return ONLY the keywords as a comma-separated list with no other text or explanation.
    
    TITLE: ${generatedContent.title}
    
    CONTENT EXCERPT:
    ${generatedContent.content.substring(0, 1000)}...`;
    
    const result = callGeminiAPI(prompt, true);
    
    if (typeof result === 'string' && result.trim().length > 0) {
      // Split by commas and clean up
      return result.split(',')
        .map(keyword => keyword.trim())
        .filter(keyword => keyword.length > 0);
    }
    
    // Fallback: Extract keywords from title
    const titleWords = generatedContent.title.toLowerCase()
      .replace(/[^\w\s]/gi, '') // Remove punctuation
      .split(' ')
      .filter(word => word.length > 3 && !['with', 'that', 'this', 'from', 'what', 'when', 'where', 'which', 'while'].includes(word));
    
    // Return up to 5 unique keywords
    return [...new Set(titleWords)].slice(0, 5);
    
  } catch (error) {
    Logger.log(`Error extracting keywords: ${error}`);
    // Return basic keywords from title as fallback
    return generatedContent.title.toLowerCase()
      .replace(/[^\w\s]/gi, '')
      .split(' ')
      .filter(word => word.length > 3)
      .slice(0, 3);
  }
}

/**
 * Makes a call to the Google Gemini API
 * @param {string} prompt The prompt to send to the API
 * @param {boolean} rawText Whether to return raw text (true) or parse as JSON (false)
 * @return {Object|string} The response from the API
 */
function callGeminiAPI(prompt, rawText = false) {
  try {
    const apiKey = CONFIG.GEMINI_API_KEY;
    const apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent';
    
    const payload = {
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192
      }
    };
    
    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      headers: {
        'x-goog-api-key': apiKey
      },
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(`${apiUrl}`, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    if (responseCode !== 200) {
      Logger.log(`Gemini API Error: ${responseCode} - ${responseText}`);
      return null;
    }
    
    const responseData = JSON.parse(responseText);
    
    if (!responseData.candidates || responseData.candidates.length === 0 || 
        !responseData.candidates[0].content || !responseData.candidates[0].content.parts || 
        responseData.candidates[0].content.parts.length === 0) {
      Logger.log('No valid response from Gemini API');
      return null;
    }
    
    let text = responseData.candidates[0].content.parts[0].text;
    
    // Clean up the text by removing code blocks and other markdown artifacts
    text = text
      .replace(/```json\s*/g, '')
      .replace(/```\s*$/g, '')
      .replace(/```/g, '');
    
    if (rawText) {
      return cleanJsonSyntax(text);
    }
    
    // Try to parse JSON from the response
    try {
      // Check if the response is already JSON
      return JSON.parse(text);
    } catch (jsonError) {
      Logger.log(`Error parsing JSON response: ${jsonError}`);
      
      // If not JSON, try to extract JSON from the response using regex
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch (nestedJsonError) {
          Logger.log(`Error parsing nested JSON: ${nestedJsonError}`);
        }
      }
      
      // If all parsing attempts fail, clean and return the text
      return { content: cleanJsonSyntax(text) };
    }
    
  } catch (error) {
    Logger.log(`Error calling Gemini API: ${error}`);
    return null;
  }
}