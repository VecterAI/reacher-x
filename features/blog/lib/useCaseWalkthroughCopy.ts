import type { AudienceDemoId } from "./blogDemoCatalog";

export type UseCaseWalkthroughId = AudienceDemoId | "find-candidates";
export const USE_CASE_WALKTHROUGH_COPY: Record<
  UseCaseWalkthroughId,
  { request: string; refinement: string; reply: string }
> = {
  "find-candidates": {
    request:
      "We're a team of three hiring a frontend engineer for our web app. Find people whose recent work shows React, TypeScript and accessible interface experience.",
    refinement:
      "This is a permanent remote role paying €80–100k. Our team is based in Paris; require working hours within three hours of Paris. Prioritise keyboard accessibility and complex settings interfaces. Ask about interest rather than assuming availability.",
    reply:
      "Thanks for reading my accessibility post. The role sounds relevant, and I can overlap with Paris working hours. Could you share the role details?",
  },
  "find-potential-customers": {
    request:
      "I'm building a client-feedback app for freelance designers. Find designers who describe losing feedback and approvals across email, chat and shared documents.",
    refinement:
      "They must currently do client projects and manage feedback themselves. Exclude full-time course creators who no longer take clients. Start with a question about their process, not a meeting request.",
    reply:
      "Working out which changes were approved is the hardest part. I have three active clients and each uses a different channel. How would your app handle that?",
  },
  "find-investors": {
    request:
      "We're a two-person UK team building scheduling software for independent clinics and raising pre-seed. Find relevant investors.",
    refinement:
      "Require current UK pre-seed health-software activity. Exclude Series B and later investors. Check their current firm and investment focus; ask whether our stage is still in scope before sharing a deck.",
    reply:
      "Yes, UK pre-seed health software is still our focus. Please send a short overview of the clinic scheduling problem and what you've learned from clinics so far.",
  },
  "find-research-participants": {
    request:
      "I'm studying how independent tutors arrange lessons and handle cancellations. Find tutors who discuss scheduling with parents.",
    refinement:
      "Participants must handle their own bookings. Exclude tutors whose centre has an administrator. Offer a 20-minute interview and £20 thank-you; ask consent before recording and explain that notes will be anonymised. This is research, not sales.",
    reply:
      "I handle all my own bookings and parent confirmations. I'd be interested in the research interview. Please send the study information and available times.",
  },
  "find-partners": {
    request:
      "I'd like to run a free workshop about handling client feedback. Find design educators or communities that could host it.",
    refinement:
      "Look for audiences of practising freelance designers. I will prepare the examples and run a 30-minute session; the partner hosts and invites members. No referral scheme, fee or product pitch.",
    reply:
      "This sounds useful for our freelance design members. Could you send an outline and a sample exercise? We could host a 30-minute session next month.",
  },
  "find-creators": {
    request:
      "Find creators teaching developers how to launch web apps. I'd like them to try ReacherX for finding their first users.",
    refinement:
      "Prioritise practical launch tutorials and an audience of independent developers. Offer product access for feedback, with no posting obligation. Personalise the invitation using their relevant tutorial.",
    reply:
      "Finding first users is a frequent question from my viewers. I'd like to try it on a small developer tool and send feedback. How do I get access?",
  },
  "find-community-members": {
    request:
      "I'm starting an app-feedback group for independent developers. Find builders actively asking for feedback on their apps.",
    refinement:
      "Invite them to a free Discord session on Friday at 16:00 UTC. Each person brings one app and tries someone else's. Focus on builders willing to exchange practical feedback, not promotional accounts.",
    reply:
      "I'd like to bring my onboarding flow and try another builder's app. Friday at 16:00 UTC works. Could you send the Discord invitation?",
  },
  "find-podcast-guests": {
    request:
      "I host Independent Work, a podcast for freelancers. Find guests who have recently shared lessons from making their first hire.",
    refinement:
      "Look for firsthand stories about handing over client work. The invitation is for a 30-minute recorded audio interview, no video or preparation. Offer an example episode before booking.",
    reply:
      "I'd be happy to talk about handing over my first client project. Please send an example episode and a little more about your listeners before we book.",
  },
};

export function isUseCaseWalkthrough(
  value: string
): value is UseCaseWalkthroughId {
  return Object.hasOwn(USE_CASE_WALKTHROUGH_COPY, value);
}
