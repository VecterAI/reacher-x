import twitter from "twitter-text";

// Function to detect and link email addresses
function linkEmails(text: string): string {
  const emailRegex =
    /(?:[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+)@(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}/g;
  return text.replace(emailRegex, (email) => {
    // Basic validation to ensure it's a valid email
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return email; // Return unchanged if invalid
    }
    return `<a href="mailto:${email}" target="_blank" class="text-blue-500 hover:underline">${email}</a>`;
  });
}

// Main parsing function
export function parseText(
  body: string,
  entities?: {
    urls?: Array<{
      url: string;
      expanded_url: string;
      display_url: string; // Added required property
      indices: [number, number]; // Added required property
    }>;
  }
): string {
  if (!body) return "";
  // Escape HTML characters to prevent XSS
  const escaped = twitter.htmlEscape(body);
  // Parse Twitter-like entities (hashtags, mentions, URLs)
  const twitterParsed = twitter.autoLink(escaped, {
    hashtagUrlBase: "https://x.com/hashtag/",
    usernameUrlBase: "https://x.com/",
    usernameIncludeSymbol: true,
    targetBlank: true,
    urlEntities: entities?.urls || [],
  });
  // Add email linking
  return linkEmails(twitterParsed);
}
