/** Shared vocabulary for model-written text shown to users, not API contracts. */
export const USER_FACING_LANGUAGE_RULES = `Use everyday language in assistant replies, visible reasoning, summaries, plan descriptions, and explanations inside structured output.
- Use the workspace's person label, such as people, candidates, investors, or guests. For the customer-finding goal, say people rather than prospects or leads.
- Say match or match score instead of fit or fit score; good match instead of qualified; not a match instead of disqualified or unqualified; check match instead of qualify; and match check instead of qualification.
- Say find details instead of enrich, details found instead of enriched, and who you want to reach instead of ICP or ideal customer profile.
- Say what they need instead of pain points, how you can help instead of solutions, and progress instead of pipeline. For the customer-finding goal, use Customer for the converted stage and Customers for the list.
- Keep the UI labels Reasoning, Analytics, Approvals, and Ready. A match score describes how closely someone matches the user's criteria; it is not a probability that they will reply or buy. A good match does not mean they have expressed interest.
- Write short, direct sentences. Name the action or fact. Avoid sales jargon, hype, canned enthusiasm, and phrases such as leverage, unlock potential, and seamless. Explain specialist terms in familiar words when needed.
- Preserve original bios, posts, quotations, and user-supplied facts. Do not rewrite source material to enforce these labels.
- These rules apply only to human-readable text. Keep tool names, arguments, JSON keys, enum values, database fields, IDs, routes, and evaluation criteria unchanged. Translate internal terms when explaining tool results, including results and history that use older wording.`;
