# Resolve any B2B identity in milliseconds

GET

https://renidly.com/api/v2/discover/opportunities

2Defaultreacher-x-search-engine-development-previewreacher-x-search-engine-productionSend⌘↵

Discover opportunities (jobs)

Search the jobs graph with a keyword and a rich set of filters (experience, type, workplace, salary, benefits, and more). Multi-value filters accept comma-separated values. Page with `start` (0–999) and `count` (max 50, default 25).

Show more

Request

keywordstringquery

Free-text job query.

**Use it for:** the primary search term (role, skill, technology).

sortBystringqueryDon’t includerelevancedate_posted

`relevance` (default) or `date_posted` (newest first).

**Use it for:** `date_posted` to catch fresh postings first.

datePostedstringqueryDon’t include24h1week1month

Restrict to jobs posted in the last `24h`, `1week`, or `1month`.

**Use it for:** high-intent, recently-opened roles.

experiencestringquery

Experience level(s), comma-separated: `internship`, `entry_level`, `associate`, `mid_senior`, `director`, `executive`.

**Use it for:** seniority targeting.

jobTypesstringquery

Employment type(s), comma-separated: `full_time`, `part_time`, `contract`, `temporary`, `internship`, `volunteer`, `other`.

**Use it for:** filtering by engagement type.

workplaceTypesstringquery

Workplace type(s), comma-separated: `onsite`, `remote`, `hybrid`.

**Use it for:** remote/hybrid-only searches.

salarystringqueryDon’t include20k30k40k50k60k70k80k90k100k

Minimum salary bucket (USD).

**Use it for:** filtering to a compensation floor.

companiesstringquery

Organization id(s), comma-separated.

**Use it for:** jobs at specific target companies.

industriesstringquery

Industry id(s), comma-separated.

locationsstringquery

Location/geo id(s), comma-separated.

**Use it for:** geographic scoping of a job search.

functionsstringquery

Job-function code(s), comma-separated.

titlesstringquery

Title id(s), comma-separated.

benefitsstringquery

Benefit(s), comma-separated: `medical_ins`, `dental_ins`, `vision_ins`, `401k`, `pension`, `paid_maternity`, `paid_paternity`, `commuter`, `student_loan`, `tuition`, `disability_ins`.

**Use it for:** filtering for specific perks.

commitmentsstringquery

Company commitment(s), comma-separated: `dei`, `environmental`, `work_life`, `social_impact`, `career_growth`.

**Use it for:** values-aligned job search.

easyApplystringqueryDon’t includetruefalse

`true` to return only Easy Apply jobs.

verifiedJobstringqueryDon’t includetruefalse

`true` to return only verified postings.

under10ApplicantsstringqueryDon’t includetruefalse

`true` to return only jobs with fewer than 10 applicants (less competition).

fairChancestringqueryDon’t includetruefalse

`true` to return only fair-chance employers.

countintegerquery

Results per page (max 50, default 25).

startintegerquery

Zero-based offset (0–999).

Responses

200400401

200OK

Successful response. `data` carries the endpoint-specific payload.

Schema

successbooleanrequired

statusCodeintegerrequired

messagestring

errorsany?

dataany?required

Endpoint-specific payload (object or array).

ResponseHeadersCode examples

No response yet

Hit **Send** to fire a live request against the endpoint.
