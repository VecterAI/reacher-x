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
