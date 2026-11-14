import type { Doc } from "@/convex/_generated/dataModel";
import { getStringProperty } from "@/convex/lib/typeGuards";

/** Extra public activity is written for each story, not borrowed from another audience. */
const activity: Record<string, string[]> = {
  "Maya Shaw": [
    "Preparing a teaching exercise about two stakeholders requesting opposite logo changes.",
    "My design students are practising how to ask a client for one final decision.",
    "A ten-minute exercise on feedback can be more useful than another hour of theory.",
  ],
  "Tom Reed": [
    "Members asked for a workshop about revisions arriving after approval.",
    "We keep community sessions practical: a short example, discussion and something to try on the next project.",
    "Collecting client-review questions from independent designers before next month's event.",
  ],
  "Lee Park": [
    "A client sent a new set of comments after signing off the screen. How do other freelancers handle that conversation?",
    "Trying a review checklist on my next product design project.",
    "I'd join a small workshop to compare client feedback processes with other designers.",
  ],
  "Nora Ellis": [
    "A client approved the logo in email, then sent different feedback in chat. I'm trying a single review link for the next round.",
    "My project handoff checklist now includes one named approver. Five people commenting without a decision owner was slowing every revision.",
    "Freelance designers: do your clients actually use the project portal? Mine usually reply to the email instead.",
  ],
  "Alex Rivera": [
    "Recording a lesson on revision limits for my design course. Teaching is my full-time work now.",
    "A student asked how to define final approval. We worked through a sample client email together.",
    "The next course exercise is about conflicting stakeholder feedback. These are teaching examples, not current client projects.",
  ],
  "Samir Patel": [
    "Finished a shop's mobile checkout redesign. Getting the final copy approved took longer than building the page.",
    "I'm adding revision dates to each client review. Otherwise a comment on last week's screenshot looks like a new request.",
    "A shared document is easy for clients to open, but I still need to connect each comment to the right screen.",
  ],
  "Erin Walsh": [
    "A client sent revision notes on WhatsApp at midnight, then followed up by email this morning. Same change, two channels.",
    "Started numbering client requests in the shared sheet. At least now I can see when the list grows after sign-off.",
    "Freelance web designers: do you charge for revisions that arrive after approval? Mine keep resurfacing from old email threads.",
  ],
  "Helena Costa": [
    "Drew up a one-page approval summary for each brand round. Clients still reply in three different places.",
    "The wrong logo version nearly went to print because an old email thread looked newer than the chat. Reviewing my process tonight.",
    "Solo studio question: how do you record who approved what, when the client's team keeps changing?",
  ],
  "Ibrahim Saleh": [
    "Menu page launched, but the sign-off lived in chat and the change requests in a document. Reconciling them took an evening.",
    "Trying a simple rule with restaurant clients: one thread per project. So far nobody reads it.",
    "Independent designers: how do you protect a launch date when approvals keep moving between apps?",
  ],
  "Hannah Schmidt": [
    "Assembled a client review timeline from Figma comments, email decisions, and a drive brief. Never again in one sitting.",
    "Trialling a weekly feedback digest for my dashboard clients. Three sources in, one summary out.",
    "Product design peers: how do you keep the reason behind each decision attached to the screen it changed?",
  ],
  "Chloe Dupont": [
    "Two inboxes, one client, and a homepage revision nobody can find. Writing the approval down this time.",
    "Boutique clients mean personal service, but the approval trail should not live in my memory.",
    "Asking freelance designers: what do you send a client so approvals are clear, without another portal login?",
  ],
  "Amelia Grant": [
    "Meeting UK pre-seed teams this month. For clinic software I want to understand the receptionist's workflow before seeing a pitch deck.",
    "A scheduling tool should account for cancellations and clinician availability. Small practices rarely have someone dedicated to operations software.",
    "Our health software thesis stays focused on independent providers. We can meet founders before they have repeatable sales.",
  ],
  "Daniel Park": [
    "Reviewing Series B healthcare software businesses with established enterprise contracts this quarter.",
    "For growth investments, repeatable sales and retention data matter more than a promising prototype.",
    "We are not opening a pre-seed programme. Our team remains focused on growth-stage companies.",
  ],
  "Priya Sen": [
    "At my old clinic, reminder calls were an afternoon job. I like tools that make that work easier for a small reception team.",
    "I make a few angel investments each year in early UK health operations teams.",
    "Clinic software founders: spend time observing rescheduling, not only the first booking.",
  ],
  "Lena Brooks": [
    "A parent moved Thursday's lesson, then the old calendar invitation caused confusion. I manage these changes myself.",
    "Trying one weekly confirmation message for my maths pupils. Fewer threads would make Sunday planning easier.",
    "I tutor independently, so lesson preparation and arranging times compete for the same evening hours.",
  ],
  "Owen Clarke": [
    "Prepared a new algebra worksheet for the learning centre's evening group.",
    "Our administrator confirmed next week's timetable. I don't manage the parents' bookings myself.",
    "Teaching two small groups tomorrow. The centre handles cancellations and replacement slots.",
  ],
  "Mei Foster": [
    "Two families confirmed different times in separate messages. I need one place to check my language lesson schedule.",
    "I run my own tutoring practice and handle every booking directly with parents.",
    "Trialling a Friday reminder before next week's lessons. Has anyone found a good way to record a changed time?",
  ],
  "Maya Lawson": [
    "Our design community workshop used a real revision brief today. Naming the final approver changed the discussion.",
    "Members want examples they can use in their next client meeting, not a list of tools.",
    "Planning a practical session on conflicting feedback. A short exercise works better than a long presentation.",
  ],
  "Tom Mercer": [
    "Collecting questions from freelance designers for next month's member workshop.",
    "Members voted for a session on scope creep and revision limits. We keep these sessions practical and free of sales pitches.",
    "Looking for a guest who can teach a small feedback exercise our members can try together.",
  ],
  "Lee Morgan": [
    "A coaching client now sends a feedback checklist before each design review.",
    "We practised asking which stakeholder owns the approval. It made a difficult client call much clearer.",
    "Comparing revision processes with other design coaches this week. What examples do you teach?",
  ],
  "Evan Brooks": [
    "Recorded a developer-tool tutorial using a small working app, including the setup mistakes I made.",
    "A useful sponsored demo should show where a tool helps and where it does not.",
    "My next video walks through a real integration from an empty project. Keeping the example reproducible.",
  ],
  "Aisha Khan": [
    "Writing a tutorial for indie developers with a small, runnable example.",
    "I only recommend tools after building something with them. My audience asks good questions about the tradeoffs.",
    "Planning a short developer workflow video. The setup needs to be clear enough for viewers to follow.",
  ],
  "Noah Reed": [
    "Taught a web development workshop using a small app instead of slides.",
    "My students asked for more examples of debugging integrations. Preparing a walkthrough for next week.",
    "A tool demo is useful when a learner can reproduce it with their own project.",
  ],
  "Alex Kim": [
    "Shipped a small fix in my solo project today. Would like a few other makers to review the onboarding.",
    "Working alone makes prioritising features harder. A regular small-group check-in would help.",
    "Looking for a quiet builder group where we share progress and useful feedback, not launch links all day.",
  ],
  "Zara Ahmed": [
    "Tested a new onboarding screen for my independent app. Two users got stuck at the same step.",
    "I miss having peers to talk through small product decisions with.",
    "A weekly maker check-in sounds more useful to me than another large promotion channel.",
  ],
  "Jamie Cole": [
    "Spent the afternoon simplifying a form in my solo web app.",
    "Does anyone run a small peer group for developers building their own products?",
    "I'd like feedback on a working feature, and I'm happy to review someone else's in return.",
  ],
  "Sofia Bennett": [
    "Looking back at our agency's first client: a small paid project taught us more than polishing the website.",
    "The early pricing mistakes are the part of building a studio people rarely discuss.",
    "Happy to share practical lessons from starting a small design agency, including what we got wrong.",
  ],
  "Marcus Lee": [
    "Our independent studio grew through a handful of repeat clients before we hired anyone.",
    "The first year involved learning how to scope projects and ask for deposits.",
    "I enjoy candid founder conversations about the unglamorous work behind a small studio.",
  ],
  "Elena Cruz": [
    "The move from freelance development to running a small business changed how I plan my week.",
    "My first recurring client came from a small fixed-scope project, not a launch campaign.",
    "Documenting early mistakes for other independent founders. Pricing and boundaries were the hardest lessons.",
  ],
  "Freya Lindholm": [
    "Wrote the final approval from the chat thread into the project doc myself. Clients keep asking where the doc went.",
    "A packaging round survived on one signed email while everything else lived in chat. Never again.",
    "Independent brand designers: do your clients know which channel counts as the decision?",
  ],
  "Rafael Ortiz": [
    "Numbered every revision request this week, whatever channel it arrived in. The list finally matches the invoice.",
    "A chat change skipped my tracker and shipped late. Rebuilding the client's trust cost more than the fix.",
    "Freelance web designers: how do you make one client's feedback from three apps look like one list?",
  ],
  "Aoife Byrne": [
    "Started attaching the decision trail to each handoff. Founders read the trail before the screens.",
    "Two approval emails for one screen this week. Neither matched the Slack thread.",
    "Dashboard clients approve in Slack and revise by email. I need the two conversations in one place.",
  ],
  "Karim Mansour": [
    "A clinic signed off in chat on Tuesday and emailed changes on Wednesday. I printed both to compare.",
    "Keeping one chat thread per restaurant project now. Compliance is still optional on their side.",
    "Menu page live. The approval trail took longer to reconstruct than the page took to build.",
  ],
  "Ginevra Moretti": [
    "Delivery-day audit found version four approved in email and version three in chat. The deck agreed with neither.",
    "I now record the final call in a one-line summary the client confirms. It has already saved two rounds.",
    "Solo brand studio question: where does the final decision live in your process?",
  ],
  "Petr Novotny": [
    "The agency's account manager approves in email; their client comments in the file. I reconcile the two every Friday.",
    "Started numbering comments beside the screen they changed. Agency review time dropped by half.",
    "One ordered trail of decisions is worth more to me than another design tool.",
  ],
  "Ines Cardoso": [
    "A client approved Tuesday's flow in email, then requested the old version in chat on Friday. The spreadsheet caught it.",
    "Kept the decision log in the project doc this sprint. The client's team actually updated it twice.",
    "Product design peers: how do you attach the reason for a decision to the screen it changed?",
  ],
  "Amélie Roussel": [
    "Two inboxes, one client, and a homepage revision nobody can find. The hand-written approval log starts today.",
    "A boutique client approved version two by email while the chat said version three. I shipped version three; both were right somewhere.",
    "Boutique clients mean personal service, but the approval trail should not live in my memory.",
  ],
  "Andrés Ramos": [
    "The shop owner approved in chat; the change list arrived by email the same afternoon. Monday went to reconciling them.",
    "Trying one approval message per milestone, confirmed by reply. Small habit, fewer surprises.",
    "Independent designers: how do you protect a launch date when approvals move between apps?",
  ],
  "Zainab Haddad": [
    "The wordmark was approved by email; the founder's son sent different notes in chat the same evening.",
    "Wrote a one-page approval summary for the family business. The summary is now the only thing everybody reads.",
    "Family businesses teach you fast: the decision is wherever the loudest message is, unless you record it.",
  ],
  "Anton Lindgren": [
    "Approvals in email, requests in chat, tracker in an abandoned sheet. Rebuilding the sheet inside the project this week.",
    "A revision arrived in chat after sign-off. Numbering requests from now on, whatever the channel.",
    "Freelance web designers: what do you send a client so approvals are clear without another login?",
  ],
  "Yuki Tanabe": [
    "Assembled this week's review from file comments, email decisions, and a call nobody wrote down.",
    "Sending a three-line recap after every client call now. The recap has become the approval record.",
    "Small teams mean fast decisions and faster scattering. One place for both would be enough.",
  ],
  "Owen Hartley": [
    "Sign-off for the booking page happened in chat; the change requests keep arriving by email.",
    "Told my trade clients the rule: approvals in writing, anywhere, as long as I can find them later.",
    "Two sources of truth and a launch date that will not move. Rebuilding the tracker tonight.",
  ],
  "Camille Aubert": [
    "Version two approved by email, version three mentioned in chat by the manager. The retailer noticed before I did.",
    "One approval trail per project from now on, with names and dates attached to each decision.",
    "Independent retailers move fast. The approval record has to move with them.",
  ],
  "Arjun Mehta": [
    "Founder sends UI feedback in chat at midnight; the approved scope arrives by email two days later. Sprint one of reconciling them.",
    "Started posting a scope summary in the chat thread itself. The email still wins, but the gap is closing.",
    "Freelance UI designers: how do you make chat feedback and emailed scope agree without policing your client?",
  ],
  "Elif Demir": [
    "Saved screenshots of every approval this sprint. The album is now the most honest project document I have.",
    "A client approved the onboarding flow by email; their developer sent contradictory notes in chat the same week.",
    "Recording the decision beside the screen it changed. Everything else is archaeology.",
  ],
  "Lucas Girard": [
    "Three restaurant clients, three approval trails: paper, email, and chat. None of them searchable.",
    "Photographed the paper sign-off and filed it beside the email thread. Progress, of a kind.",
    "Freelancers with local clients: how do you keep approvals straight when your clients cannot agree on an app?",
  ],
  "Mariana Vega": [
    "The delivery audit: approval email, WhatsApp thread, and deck comments. Two of three disagreed last week.",
    "Recording the final call in a delivery note the client confirms. It has already prevented one reprint.",
    "Solo identity studio question: where does the final decision live in your process?",
  ],
  "Mateus Silva": [
    "Rebuilt the decision trail from screenshots before a handoff. The trail should have built itself.",
    "Client decisions live in chat, email, and file comments. Numbering them beside each screen this sprint.",
    "One ordered record of what was approved is the deliverable clients actually ask about.",
  ],
  "Elsa Lindqvist": [
    "A client signed off in chat, then emailed changes the same afternoon. The project document caught the conflict.",
    "One document per project now, but approvals still arrive everywhere else. Closing the gap this month.",
    "Small business clients: what does your sign-off flow look like when the owner answers from three apps?",
  ],
  "Felix Braun": [
    "Startup clients approve in chat; their ops lead emails a different change list. The landing page was wrong for two days.",
    "One approval trail per project from today, with the chat decision exported beside the email.",
    "Fast clients do not read process docs. The record has to happen where they already talk.",
  ],
  "Ayesha Karim": [
    "The first hour of every review goes to reconnecting chat, email, and the shared drive. That hour is the product now.",
    "Trialling a weekly feedback digest: three sources in, one ordered summary out.",
    "Independent studios: how do you centralise client feedback without asking clients to change tools?",
  ],
  "Maren Vogel": [
    "Preparing a workshop exercise where two stakeholders request opposite changes and the group must pick one decision owner.",
    "My teaching examples now start from real approval emails. Fiction is never this contradictory.",
    "Educators: how do you simulate conflicting client feedback without confusing the room?",
  ],
  "Idris Sanogo": [
    "Our members asked for a session on approvals that arrive in three different apps.",
    "Collecting real revision stories from freelancers for next month's community meetup.",
    "A practical exercise beats a lecture. Building one about scattered client feedback.",
  ],
  "Selin Aydin": [
    "A client approved the homepage in chat, then the partner agency emailed a different direction. Both are clients of mine now.",
    "Keeping one approval line per project, confirmed by whoever owns the decision.",
    "Freelance designers: how do you handle two stakeholders with two approval trails?",
  ],
  "Bruno Ferreira": [
    "Revision requests after sign-off used to restart the project. A numbered change list finally stopped that.",
    "The client's approval email now gets quoted back in chat. One trail, two apps, still searchable.",
    "Product design freelancers: what does your post-approval process look like?",
  ],
  "Astrid Nilsson": [
    "Taught a revision-boundary exercise to twelve freelancers. The approval-email example landed hardest.",
    "Members keep asking who owns the decision when the client's team disagrees. Building a lesson around that.",
    "A clear approval owner changed more projects for my students than any new tool.",
  ],
  "Malik Johnson": [
    "Two clients, two time zones, three feedback channels. The tracker is now the only thing I trust.",
    "Started asking clients to reply 'approved' in one thread per milestone. Recovery rate: two of three.",
    "Solo designers: how do you make approvals easy for clients who will not change their habits?",
  ],
  "Paloma Reyes": [
    "The client approved the identity in email; their marketing lead sent new notes in chat a week later.",
    "Recording approvals with names, dates, and the exact words used. Disputes end at the record.",
    "Brand designers: how do you protect a deadline when approval arrives in two places?",
  ],
  "Viktor Bak": [
    "Client feedback arrives in chat; the signed scope lives in email. I mirror both into one project note.",
    "A revision arrived after approval for the third week running. The numbered list is earning its keep.",
    "Freelance designers: what is your rule for feedback that arrives after sign-off?",
  ],
  "Noor Hammoud": [
    "Members keep asking how to handle feedback scattered across email and chat. Collecting examples for a session.",
    "The workshop exercise about conflicting approvals got the best response of the year.",
    "Communities work when the examples are real. Sharing my own messy approval trail first.",
  ],
  "Emil Vidal": [
    "One client, three approval channels, zero searchable records. The project doc is now the single trail.",
    "A chat approval contradicted the email from the same morning. The client admitted the chat one was a mistake.",
    "Independent designers: do you export chat decisions, or ask clients to repeat them in email?",
  ],
  "Karen Whitfield": [
    "The approvals folder now holds one confirmed message per milestone. Clients actually cooperate.",
    "A revision round was lost between two inboxes last month. The numbered change list prevents a repeat.",
    "Boutique web design clients approve fast and forget faster. The record has to do the remembering.",
  ],
  "Dario Conti": [
    "The client's team approved in three chats and one email. I asked them to pick a single channel; they picked all four.",
    "Reconciling approvals before every delivery now takes minutes, not evenings. The trail lives in the project.",
    "Product designers: how do you keep the decision trail when the client's team will not consolidate?",
  ],
  "Lucy Hammond": [
    "A client approved version two by email and version three in chat. I now restate the decision before building.",
    "The approval summary takes five minutes to write and saves the whole revision round.",
    "Freelance designers: what is the smallest habit that made approvals stick for you?",
  ],
  "Oscar Mendez": [
    "Chat feedback, email approvals, and a shared drive nobody curates. The weekly digest is my only defence.",
    "Three sources in, one ordered summary out. Clients reply to the summary; the summary becomes the record.",
    "How do other designers keep client feedback in one place without asking clients to move?",
  ],
  "Ida Svensson": [
    "Members asked for a practical session on approvals that scatter across apps. Building it from real examples.",
    "The best workshop moments come from actual approval emails. Keep yours; they teach better than slides.",
    "Teaching freelancers to name the decision owner changed more projects than any template.",
  ],
  "Teo Markovic": [
    "The client approved in chat at midnight and emailed a different direction at nine. The project doc settled it.",
    "One thread per project, one approval message per milestone. Clients cooperate when the ask is small.",
    "Freelance product designers: how do you record the final call without slowing the client down?",
  ],
  "Hana Novak": [
    "I keep an approval line in the project doc now. Two clients have copied the format for their own teams.",
    "The chat decision and the email approval disagreed. The doc version won because it had a date and a name.",
    "Solo designers: the approval record is the deliverable. Treat it like one.",
  ],
  "Ruben Costa": [
    "Sign-off happened in chat; the change requests arrive in a shared document. Two sources of truth, one launch.",
    "Quoting the approval back to the client in writing has ended every dispute before it started.",
    "Independent designers: how do you protect a launch date when approvals keep moving?",
  ],
  "Anouk Peeters": [
    "Three stakeholders, three feedback channels, one screen. The decision log finally made the review short.",
    "Clients approve faster when the ask is one message in one place. Designing that ask is my job now.",
    "Freelance designers: what is your one-message approval ritual?",
  ],
  "Sami Kettani": [
    "The restaurant approved the menu page in chat; the change requests keep arriving in a shared document.",
    "Photographed the paper approvals too. The project folder is now the only complete record.",
    "Local clients will not change tools. The record has to come to them.",
  ],
  "Vilma Lind": [
    "A client approved the wrong logo version from an old email thread. The approval summary now ships with every round.",
    "One ordered trail of feedback and decisions per project. Clients started trusting delivery days again.",
    "Independent brand designers: how do you keep approvals in order across email and chat?",
  ],
  "Jonas Krause": [
    "Chat approvals, email revisions, and a deadline that will not move. The numbered change list is doing the work.",
    "The client's ops lead and I agreed on one approval thread. Cooperation lasted two weeks; the trail survived.",
    "Freelance web designers: what is your rule for feedback that arrives after sign-off?",
  ],
  "Priya Bose": [
    "The founder approves in chat; the ops lead revises by email. My project doc is the only place both exist together.",
    "Restating each approval in one line before building has saved two revision rounds this month.",
    "Designers working with founders: how do you keep the midnight chat and the morning email aligned?",
  ],
  "Marc Tolentino": [
    "Three clients, three approval habits, one project doc. The doc wins because it is the only thing everyone can find.",
    "A revision arrived after sign-off for the second time this month. Numbering requests from now on.",
    "Solo designers: what is the lightest process that still records every approval?",
  ],
};

export function additionalDemoPosts(person: Doc<"prospects">) {
  const first = person.evidencePosts?.[0];
  if (!first) return [];
  // Background examples keep their own role and matched topics, even when names recur.
  const texts =
    (person.displayName === "Isabelle Fontaine"
      ? /designer/i.test(person.title ?? "")
        ? [
            "Mapped a complex settings flow before drawing the new screens. Removing two unnecessary choices made the biggest difference.",
            "Tested the revised defaults with keyboard-only navigation today. Clear focus states belong in the design review too.",
            "I'd like to own product design at a small team where I can follow a problem from research through implementation.",
          ]
        : [
            "Added keyboard navigation tests for our settings dialog. Escape now closes the active layer and returns focus to the trigger.",
            "Refactored a large React form into smaller sections without losing unsaved values when switching tabs.",
            "Exploring senior frontend roles at small teams. Accessibility and careful interaction design are the parts of product work I enjoy most.",
          ]
      : activity[person.displayName ?? ""]) ??
    (person.matchedKeywords ?? [])
      .slice(0, 3)
      .map(
        (topic) =>
          `Notes from my work as a ${person.title?.toLowerCase() ?? "professional"}: ${topic} keeps coming up in the projects I review. I'm comparing practical approaches with peers.`
      );
  return texts.map((text, index) => {
    const post = structuredClone(first);
    if (person.platform === "twitter") {
      post.id_str = `${getStringProperty(first, "id_str")}_activity_${index + 1}`;
      post.full_text = text;
    } else {
      post.postID = `${getStringProperty(first, "postID")}_activity_${index + 1}`;
      post.text = text;
    }
    return post;
  });
}
