# Resolve any B2B identity in milliseconds

GET

https://renidly.com/api/data/v1/people/search

1Defaultreacher-x-search-engine-development-previewreacher-x-search-engine-productionSend⌘↵

Search people

Multi-filter people search across the professional graph. Combine filters freely to shape an audience — identity, role, company, education, skills, experience, and more.

### Required input

At least one filter must be supplied.

A set of **refinement filters** — `follower_count_min`, `company_size_min` / `company_size_max`, `industry`, `experience_min_years`, `function`, `description`, and the `exclude_*` filters — sharpen an existing search rather than stand on their own. Pair each with at least one other filter (for example a `title`, `skills`, `geo_country_code`, or `organization_slugs`); a request built from refinement filters alone is rejected with `400`.

### Smart text matching (typeahead + typo-tolerant)

Text filters (`first_name`, `last_name`, `headline`, `summary`, `geo_city`, `title`) are forgiving by design:

- **Partial input works** — `joh` finds John, Johnny, Johanna; `data scien` finds Data Science and Data Scientist. Great for typeahead.
- **Typos still match** — `jhon` finds John, `enginer` finds Engineer.

Each text filter requires **at least 3 characters**.

### Pagination — cursor

This endpoint uses **cursor pagination**, not page numbers. The response `pagination` block carries `next_cursor`; pass it back as the `cursor` parameter to fetch the next page. On the last page `has_more` is `false` and `next_cursor` is empty. Deep pages are as fast as the first.

Returns lightweight profile data (no nested relations). Use **Get Profile** for full details.

Show more

Request

first_namestringquery

Filters by first name. Case-insensitive; matches partial input (`joh` → John, Johnny) and tolerates typos (`jhon` → John). Min 3 chars.

**Use it for:** typeahead and human-entered name lookups — pair with `last_name` to pin down a specific person.

last_namestringquery

Filters by last name. Case-insensitive, partial + typo-tolerant, same as `first_name`. Min 3 chars.

**Use it for:** combine with `first_name` to identify a specific individual.

headlinestringquery

Searches the profile headline (the one-line title under the name). Case-insensitive, partial + typo-tolerant (`data scien` → "Data Scientist"). Min 3 chars.

**Use it for:** role/seniority targeting in the person's own words ("VP Marketing", "founder") — often richer and more current than a formal title.

summarystringquery

Searches the free-text "About"/summary section. Case-insensitive, partial + typo-tolerant. Min 3 chars.

**Use it for:** intent/interest signals people only put in their bio — "angel investor", "open to advising", "ex-founder".

geo_citystringquery

Filters by the person's current city. Case-insensitive, partial + typo-tolerant. Min 3 chars.

**Use it for:** hyper-local sourcing; for country scope use `geo_country_code` (faster, exact).

geo_country_codestringquery

Filters by current country as a 2-letter ISO code (`us`, `gb`, `de`, `fr`, `in`, `ca`). Case-insensitive, exact match.

**Use it for:** the fastest way to scope a search to a market/region — combine with any other filter to localize an audience.

is_creatorbooleanqueryDon’t includetruefalse

Boolean. When `true`, returns only profiles flagged as content creators.

**Use it for:** influencer / thought-leader outreach and partnerships.

is_premiumbooleanqueryDon’t includetruefalse

Boolean. When `true`, returns only profiles flagged as premium subscribers.

**Use it for:** a light engagement/spend signal — people who invest in their professional presence.

primary_languagestringquery

Filters by the person's primary profile language (`English`, `Spanish`, `Arabic`, …). Case-insensitive, exact match.

**Use it for:** primary-language targeting; to match _any_ language a person speaks, use `speaks_language`.

skillsstringquery

Comma-separated normalized skill names — lowercase, hyphenated (e.g. `python`, `machine-learning`, `amazon-web-services`). Matches ANY by default; set `skills_match=all` to require every skill.

**Use it for:** capability-based sourcing — find exact expertise, then layer on company, location, or seniority.

skills_matchstringqueryDon’t includeallany

Enum controlling how multiple `skills` combine: `any` (default — has at least one) or `all` (must have every listed skill).

**Use it for:** `any` = broad reach; `all` = precise, higher-fit shortlists.

organization_slugsstringquery

Comma-separated organization handles — the short slug from a company's public page (e.g. `google`, `microsoft`, `openai`). Exact match. Honors `current_only` (current employees vs everyone who ever worked there).

**Use it for:** competitor talent mapping, account-based prospecting, and alumni sourcing. Combine with `tenure_max_years` for fresh hires, or `geo_country_code` to localize.

current_onlybooleanqueryDon’t includetruefalse

Boolean (default `false`). Scopes the position-based filters — `organization_slugs`, `title`, `company_size_min` / `company_size_max`, `industry`, `description`, and the `exclude_*` filters — to current roles only (`true`) or the person's entire history (`false`).

**Use it for:** `true` = current employees / current title holders; `false` = include past roles (alumni, ex-employees).

titlestringquery

Searches job titles across a person's positions. Case-insensitive, partial + typo-tolerant. Honors `current_only`. Min 3 chars.

**Use it for:** role targeting ("account executive", "cto"); combine with `organization_slugs` + `current_only=true` for a role at a specific company.

institution_idsstringquery

Comma-separated institution ids — our opaque `inst_…` ids (**max 20**), as returned by the Search Institutions endpoint. Exact match.

**Use it for:** alumni sourcing — combine with `organization_slugs` to find "alumni of University X now at Company Y".

certificationsstringquery

Comma-separated certification names (e.g. `AWS`, `PMP`, `CISSP`). Partial match; each entry min 3 chars.

**Use it for:** credential-based targeting where a formal certification beats a self-reported skill.

certification_authoritystringquery

Filters by the issuing body of a certification (e.g. `Amazon Web Services`, `Microsoft`, `PMI`). Partial match; min 3 chars.

**Use it for:** finding holders of any credential from a specific vendor or standards body in one shot.

last_change_within_daysintegerquery

Integer (1–3650). Returns people whose most recent career move — a new role, a departure, or a title change — was detected within the last N days.

**Use it for:** highest-intent sales/recruiting timing; combine with `last_change_type` and `organization_slugs` (e.g. joined a target account in the last 30 days).

last_change_typestringqueryDon’t includejoinedlefttitle_change

Enum narrowing recent changes: `joined` (new role), `left` (departed), or `title_change` (promoted/retitled at the same employer). Use with `last_change_within_days`.

**Use it for:** isolate new hires (`joined`) vs churn (`left`).

tenure_min_yearsintegerquery

Integer (0–60). Matches people at their current company for **at least** N years.

**Use it for:** reaching deeply-tenured, senior insiders (e.g. `5`).

tenure_max_yearsintegerquery

Integer (0–60). Matches people at their current company for **at most** N years (`1` = joined within the last year).

**Use it for:** new-joiner outreach; pair with `organization_slugs` to catch recent hires at a target account.

company_count_minintegerquery

Integer (1–100). Matches people who have worked at **N or more** companies.

**Use it for:** serial movers, broadly-experienced operators, flight-risk signals (e.g. `6`).

company_count_maxintegerquery

Integer (1–100). Matches people who have worked at **N or fewer** companies (`1` = only ever one employer).

**Use it for:** loyalty / culture-fit signals.

current_company_count_minintegerquery

Integer (1–50). Matches people currently holding **N or more** concurrent roles.

**Use it for:** advisors, board members, fractional execs, moonlighters (`2`).

is_boomerangbooleanqueryDon’t includetruefalse

Boolean. When `true`, returns people who left a company and later returned to it.

**Use it for:** loyalty/culture signals and re-hiring or employer-brand campaigns.

education_levelstringqueryDon’t includephdmasterbachelorassociate

Enum: `phd`, `master`, `bachelor`, or `associate` — the person's highest education level.

**Use it for:** advanced-degree audiences (e.g. `phd` for R&D/deep-tech).

degreestringquery

Free-text search within people's degrees (e.g. `MBA`, `Computer Science`). Partial + typo-tolerant. Min 3 chars.

**Use it for:** precise academic targeting alongside `education_level`.

field_of_studystringquery

Free-text search of what people studied (e.g. `machine learning`, `law`). Partial + typo-tolerant. Min 3 chars.

**Use it for:** finding domain experts by academic background even when their job title doesn't say it.

skill_count_minintegerquery

Integer (0–500). Matches profiles listing **N or more** skills.

**Use it for:** rich, multi-skilled power profiles (e.g. `20`) — often more senior and engaged.

skill_count_maxintegerquery

Integer (0–500). Matches profiles listing **N or fewer** skills.

**Use it for:** sparse or newer profiles, or excluding over-stuffed ones.

speaks_languagestringquery

Comma-separated language names. Matches anyone who speaks **at least one** — any language on their profile, not just their primary.

**Use it for:** multilingual market expansion, localized hiring, regional sales (e.g. `spanish,portuguese`). Combine with `geo_country_code`.

follower_count_minintegerquery

Integer. Matches people with **at least** N followers on their public profile — a floor on audience size and visibility.

**Use it for:** screening out low-presence profiles before you spend on outreach or enrichment (e.g. `2000`). A refinement filter — pair with at least one other filter.

company_size_minintegerquery

Integer. Matches people who have worked at a company with **at least** N employees — across current or past roles (honors `current_only`).

**Use it for:** enterprise-scale experience targeting (e.g. `1000`). A refinement filter — pair with at least one other filter.

company_size_maxintegerquery

Integer. Matches people who have worked at a company with **at most** N employees — across current or past roles (honors `current_only`).

**Use it for:** startup / small-company experience targeting (e.g. `200`). Pair with `company_size_min` for a size band. A refinement filter — pair with at least one other filter.

industrystringquery

Comma-separated industries (e.g. `marketing,media`, `financial services`). Matches anyone who has worked in **any** of them, across current or past roles (honors `current_only`). Partial match; up to 20 values, each min 3 chars.

**Use it for:** sector targeting that follows a person across job changes, not just their current employer. A refinement filter — pair with at least one other filter.

experience_min_yearsintegerquery

Integer (1–60). Matches people whose **total** professional experience, summed across every position, is at least N years.

**Use it for:** seniority targeting by real career length rather than a job title. A refinement filter — pair with at least one other filter.

functionstringquery

Comma-separated role keywords defining a job function (e.g. `bdr,business development`, `product manager`). Used **together with** `function_min_years` to match by years of experience _within that function_, grouping differently-worded titles for the same role. Up to 20 values, each min 3 chars. **Requires `function_min_years`.**

**Use it for:** "X+ years doing a specific job" — e.g. 4+ years in business development however the titles were phrased. A refinement filter — pair with at least one other filter.

function_min_yearsintegerquery

Integer (1–60). The minimum years of experience within the function defined by `function`, summed across all matching positions. **Required whenever `function` is supplied.**

**Use it for:** setting the experience bar of a `function` search (e.g. `function=bdr,business development` with `function_min_years=4`).

descriptionstringquery

Free-text search of what people actually did in their roles — the responsibilities and detail described in their positions (honors `current_only`). Min 3 chars.

**Use it for:** surfacing hands-on experience that job titles miss — "outbound prospecting", "go-to-market", "series A fundraising". A refinement filter — pair with at least one other filter.

exclude_titlesstringquery

Comma-separated job-title keywords to **exclude** — drops anyone whose positions match (honors `current_only`). Up to 20 values, each min 3 chars.

**Use it for:** removing off-target roles from a broad search (e.g. exclude `intern,assistant`). A refinement filter — pair with at least one other filter.

exclude_organization_slugsstringquery

Comma-separated organization handles to **exclude** — drops anyone who has worked there (honors `current_only`). Up to 20 values.

**Use it for:** carving out your own company, current customers, or competitors you don't want surfaced. A refinement filter — pair with at least one other filter.

exclude_industriesstringquery

Comma-separated industries to **exclude** — drops anyone who has worked in them (honors `current_only`). Up to 20 values, each min 3 chars.

**Use it for:** removing sectors that don't fit (e.g. exclude `staffing,recruiting`). A refinement filter — pair with at least one other filter.

cursorstringquery

Opaque pagination cursor. Omit for the first page; for each subsequent page pass the `next_cursor` value from the previous response's `pagination` block. Treat it as a black box.

limitintegerquery

Number of results per page.

Responses

200400401403429500504

200OK

Successful cursor-paginated list response. `message` is always `"Data retrieved successfully"`; `data` is the array of results; `pagination.next_cursor` is the token for the next page (empty string once `has_more` is false).

Schema

successbooleanrequired

statusCodeintegerrequired

messagestringrequired

Fixed value for every cursor-paginated list response.

errorsobject?required

dataany\[\]required

paginationobjectrequired

limitintegerrequired

has_morebooleanrequired

next_cursorstringrequired

Opaque cursor token for the next page (looks like `cur_…`). Pass it back as the `cursor` query parameter. Empty string when `has_more` is false (no more results).

ResponseHeadersCode examples

No response yet

Hit **Send** to fire a live request against the endpoint.
