import type { BenchmarkTask, Criterion } from "../../core/types";
import { peopleSearchPlan } from "./plan";

// Proposal 2.1 and 3.4: what each prompt requires, written down before any
// run and frozen with the reference date. Agreed by the project lead on
// 16 Nov 2026 as drafted; the freeze step refuses a draft.
export type CriteriaStatus = "draft" | "agreed";
export const criteriaStatus: CriteriaStatus = "agreed";

type PromptId = (typeof peopleSearchPlan.prompts)[number]["id"];
type PromptCriteria = Readonly<{
  criteria: readonly Criterion[];
  definitionNotes: readonly string[];
}>;

const required = (id: string, requirement: string): Criterion => ({
  id,
  requirement,
  required: true,
});

// Shared wording, so the same idea is judged the same way in every prompt.
const EUROPE =
  "Europe means the EU, EFTA countries, the United Kingdom and the rest of geographic Europe; Russia and Turkey do not count.";
const NORTH_AMERICA =
  "North America means the United States, Canada and Mexico.";
const CURRENT =
  "Roles, employers and job postings are judged as of the reference date; past roles do not count.";
const SIZE =
  "Company size uses the best available public headcount (company page, LinkedIn or a data provider). A count within 10% of a bound is partly met.";
const HQ =
  "Headquarters is the company's stated main office; a branch or a remote employee in the place does not count.";
const WINDOW =
  "A time window ends on the reference date. The evidence must show a date inside it; undated evidence is partly met at best.";
const UNTIMED =
  "No age limit applies; the judge records the evidence date for freshness reporting.";

export const promptCriteria: Readonly<Record<PromptId, PromptCriteria>> = {
  1: {
    criteria: [
      required(
        "role",
        "Currently works as a software engineer in a hands-on engineering role (developer, software engineer, or a senior, staff, principal or lead engineer)."
      ),
      required("location", "Is based in London, United Kingdom."),
      required(
        "experience",
        "Has at least 5 years of professional software engineering experience."
      ),
    ],
    definitionNotes: [
      CURRENT,
      "Experience counts from the first professional engineering role; internships and study do not count.",
      "Engineering managers and executives who no longer write code do not meet the role requirement.",
    ],
  },
  2: {
    criteria: [
      required(
        "role",
        "Currently works as a backend or full-stack engineer (server-side software development)."
      ),
      required(
        "seniority",
        "Is senior: a senior, staff, principal or lead engineering title, or at least 5 years of backend experience."
      ),
      required(
        "location",
        "Is based in Amsterdam or within commuting distance of it in the Netherlands."
      ),
    ],
    definitionNotes: [
      CURRENT,
      "The person does not need to be looking for a job. Recruiters and hiring managers who do not do engineering work do not count.",
    ],
  },
  3: {
    criteria: [
      required(
        "role",
        "Currently works as a product manager (including senior, group or principal product manager)."
      ),
      required(
        "industry",
        "The current employer is a health-tech company: software or technology for healthcare, patients, clinicians or health services."
      ),
      required(
        "startup",
        "The current employer is a startup: privately held, founded in the last 10 years, with fewer than 500 employees."
      ),
      required("location", "Is based in the United Kingdom."),
    ],
    definitionNotes: [
      CURRENT,
      "Hospitals, insurers and large pharmaceutical companies are not health-tech startups.",
    ],
  },
  4: {
    criteria: [
      required(
        "role",
        "Currently works as a data scientist (including senior, lead or principal data scientist)."
      ),
      required(
        "industry",
        "The current employer is in banking or finance: a bank, asset or wealth manager, trading firm, insurer, payments company or fintech."
      ),
      required(
        "location",
        "Is based in New York City or its metropolitan area."
      ),
    ],
    definitionNotes: [
      CURRENT,
      "Data analysts, data engineers and machine learning engineers count only when their title or work is described as data science.",
    ],
  },
  5: {
    criteria: [
      required(
        "role",
        "Is a marketing leader: head of marketing, or director, VP or chief of marketing, growth or demand generation."
      ),
      required(
        "company-type",
        "The current employer sells software as a service to businesses (B2B SaaS)."
      ),
      required("size", "The current employer has 50 to 500 employees."),
      required(
        "location",
        "The current employer is headquartered in the United States."
      ),
    ],
    definitionNotes: [CURRENT, SIZE, HQ],
  },
  6: {
    criteria: [
      required(
        "role",
        "Works as a software developer or engineer, or builds software as their main work."
      ),
      required("location", "Is based in Germany."),
      required(
        "signal",
        "Publicly posted about React (on X, LinkedIn, a blog or similar) within the 90 days before the reference date."
      ),
    ],
    definitionNotes: [
      WINDOW,
      "Posts about React Native and React frameworks such as Next.js count. A job ad or a profile skill list is not a post.",
    ],
  },
  7: {
    criteria: [
      required("role", "Currently works as a software engineer."),
      required("location", "Is based in the United States."),
      required(
        "signal",
        "Started at their current employer within the 90 days before the reference date."
      ),
    ],
    definitionNotes: [
      WINDOW,
      "A promotion or move inside the same company is not a new employer. Internships do not count.",
    ],
  },
  8: {
    criteria: [
      required(
        "role",
        "Is a founder or co-founder of the company named in the evidence."
      ),
      required("location", "Is based in India."),
      required(
        "signal",
        "The company publicly announced an equity or debt funding round from investors within the 6 months before the reference date."
      ),
    ],
    definitionNotes: [
      WINDOW,
      "Grants, prizes and accelerator places without an investment do not count.",
    ],
  },
  9: {
    criteria: [
      required(
        "role",
        "Is currently the CEO (including founder and CEO) of the company."
      ),
      required(
        "company-type",
        "The company's main business is building and selling software."
      ),
      required(
        "location",
        "The company is headquartered in the United Kingdom."
      ),
    ],
    definitionNotes: [
      CURRENT,
      HQ,
      "IT services and outsourcing firms count only when they sell their own software products.",
    ],
  },
  10: {
    criteria: [
      required(
        "role",
        "Is the company's most senior product leader: head of product, director or VP of product, or chief product officer."
      ),
      required(
        "company-type",
        "The company is a fintech: technology for payments, banking, lending, investing, insurance or other financial services."
      ),
      required(
        "location",
        "The company is headquartered in the United States."
      ),
    ],
    definitionNotes: [
      CURRENT,
      HQ,
      "At a large company, the head of product for a fintech business unit counts.",
    ],
  },
  11: {
    criteria: [
      required(
        "indie",
        "Is an independent developer: builds their own products alone or in a small self-funded team, or freelances, rather than working as an employee."
      ),
      required(
        "signal",
        "Public evidence (posts, projects, repositories or a portfolio) shows they build with Next.js."
      ),
    ],
    definitionNotes: [
      UNTIMED,
      "Someone with a full-time job who also ships side projects counts as partly met on the indie requirement.",
    ],
  },
  12: {
    criteria: [
      required(
        "role",
        "Works in marketing (any level, in-house, agency or freelance)."
      ),
      required(
        "signal",
        "Publicly mentions using HubSpot in their own work (a post, profile, case study or talk)."
      ),
    ],
    definitionNotes: [
      UNTIMED,
      "A HubSpot certification or skill listed without any mention of using it is partly met.",
    ],
  },
  13: {
    criteria: [
      required(
        "industry",
        "Is a fintech: technology for payments, banking, lending, investing, insurance or other financial services."
      ),
      required("location", "Is headquartered in Europe."),
      required("stage", "Raised a Series A round."),
      required(
        "signal",
        "That Series A was publicly announced within the 12 months before the reference date."
      ),
    ],
    definitionNotes: [EUROPE, HQ, WINDOW],
  },
  14: {
    criteria: [
      required(
        "industry",
        "Is an AI company: its main product is built on artificial intelligence or machine learning."
      ),
      required(
        "stage",
        "Is early-stage: pre-seed, seed or Series A, or founded in the last 5 years with no later round."
      ),
      required("location", "Is headquartered in North America."),
    ],
    definitionNotes: [
      NORTH_AMERICA,
      HQ,
      "A company that only uses AI tools internally is not an AI company.",
    ],
  },
  15: {
    criteria: [
      required(
        "industry",
        "Works in healthcare: care providers, health insurers, health technology, medical devices, pharmaceuticals or biotech."
      ),
      required("location", "Is headquartered in the United States."),
      required("size", "Has 200 to 1,000 employees."),
    ],
    definitionNotes: [HQ, SIZE],
  },
  16: {
    criteria: [
      required(
        "company-type",
        "Is a marketing or digital agency that provides marketing services to clients."
      ),
      required("location", "Is based in Brazil."),
      required(
        "service",
        "Offers search engine optimisation (SEO) as a client service."
      ),
    ],
    definitionNotes: [
      HQ,
      "The company's own website or listing must show SEO as a service it sells.",
    ],
  },
  17: {
    criteria: [
      required(
        "company-type",
        "Sells software as a service to businesses (B2B SaaS)."
      ),
      required("location", "Is headquartered in Europe."),
      required("size", "Has 50 to 200 employees."),
    ],
    definitionNotes: [EUROPE, HQ, SIZE],
  },
  18: {
    criteria: [
      required(
        "company-type",
        "Is a technology company: its main business is software, internet services or technology products."
      ),
      required("location", "Is headquartered in the United States."),
      required("size", "Has 100 to 1,000 employees."),
      required(
        "signal",
        "Has an open job posting for a backend engineer (or a backend-heavy full-stack role) on the reference date."
      ),
    ],
    definitionNotes: [
      HQ,
      SIZE,
      "A posting counts as open when it is listed on the company's careers page or a job board and was posted or confirmed within the 60 days before the reference date.",
    ],
  },
  19: {
    criteria: [
      required(
        "industry",
        "Is a climate-tech company: its main product reduces emissions, adapts to climate change or supports the energy transition."
      ),
      required("location", "Is headquartered in Europe."),
      required(
        "signal",
        "Has an open job posting for a data scientist on the reference date."
      ),
    ],
    definitionNotes: [
      EUROPE,
      HQ,
      "A posting counts as open when it is listed on the company's careers page or a job board and was posted or confirmed within the 60 days before the reference date.",
    ],
  },
  20: {
    criteria: [
      required(
        "company-type",
        "Is an e-commerce brand: sells its own branded products to consumers, mainly online."
      ),
      required("location", "Is headquartered in the United Kingdom."),
    ],
    definitionNotes: [
      HQ,
      "Marketplaces, retailers of other brands' products, agencies and e-commerce software companies are not e-commerce brands.",
    ],
  },
};

export const taskId = (promptId: PromptId) =>
  `p${String(promptId).padStart(2, "0")}`;

/** The benchmark tasks for a reference date, in prompt order. */
export function buildTasks(referenceDate: string): BenchmarkTask[] {
  const { prompts, categories } = peopleSearchPlan;
  return prompts.map((prompt) => ({
    id: taskId(prompt.id),
    prompt: prompt.text,
    entityType: categories[prompt.category].entityType,
    referenceDate,
    criteria: promptCriteria[prompt.id].criteria,
    definitionNotes: promptCriteria[prompt.id].definitionNotes,
  }));
}
