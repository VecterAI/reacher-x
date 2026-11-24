# Resolve any B2B identity in milliseconds

Renidly Phone API · v1.0.0

# Overview

Find a professional's phone numbers from their LinkedIn profile, and find the professional behind a phone number.

- **Find** — you give a LinkedIn profile URL or username; we return the person's known phone numbers, best first.
- **Reverse** — you give a phone number; we return the professional profile behind it (up to 3 candidates when the number is shared, e.g. a household line).

## Authentication

Every endpoint requires an API key sent in the `X-renidly-apikey` request header:

```
X-renidly-apikey: <your-api-key>
```

A missing key returns `401`; an invalid or unauthorized key returns `403`.

## Response envelope

Every response shares the same head: `success`, `statusCode` (mirrors the HTTP status), `message`, `errors`, and `data`. On success your result is in `data`:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "ok",
  "errors": null,
  "data": {}
}
```

On an error, `data` is `null` and `message` explains what happened; handler-level errors also carry a machine-readable `error_code`.

## Billing

You pay by **outcome**, never for our own failures:

Endpoint

Result returned

Looked up, nothing returned

Free

`GET /find`

The endpoint's credit cost

**1 credit** — the profile doesn't exist, or it has no known numbers

Validation errors (`400`), opted-out contacts, errors (`500`/`503`)

`GET /reverse`

The endpoint's credit cost — **once per call**, however many candidates come back

**1 credit** — the number matched, but none of its people could be returned (e.g. their profiles no longer exist)

Numbers we don't know, validation errors (`400`), errors (`500`/`503`)

The endpoint's credit cost is shown on your dashboard.

**Balance check.** A call is only accepted when your balance covers the endpoint's full credit cost — otherwise it is rejected with `403` before any work and nothing is charged. If your balance drops below the outcome's cost while the call runs, you get `402`, nothing is charged, and no data is returned.

Authentication failures and rate-limit rejections are never charged.

## Phone numbers

Numbers are accepted in any common format — `+1 (650) 253-0000`, `650.253.0000`, `00 44 20 7946 0958`, `011 44 20 7946 0958` — and always returned in international **E.164** form (`+16502530000`).

- A number starting with `+` or `00` (or `011`, the US/Canada international prefix, when `country` is US or CA) carries its own country code.
- A number without one is read in the `country` you pass (two-letter ISO 3166-1 code, e.g. `GB`), or as a **US** number when you pass none.
- Rejected with `400` (free): letters, extensions (`x123`), free text, numbers that don't exist in their country's numbering plan, and toll-free, premium-rate and other service numbers, which never belong to one person.

Phone data is **not verified** against carriers: a number may be outdated. In the US and Canada mobile and landline numbers can't be told apart, so their `line_type` is `fixed_line_or_mobile`.

## Privacy

People who have opted out are never returned. **Find** answers `403` (`OPTED_OUT`) for an opted-out profile; **Reverse** leaves them out of the candidates.

## Error codes

Returned in the `error_code` field:

Code

Meaning

`VALIDATION_ERROR`

A parameter is missing or malformed (not charged)

`OPTED_OUT`

The contact opted out of our data (not charged)

`1000`

An unexpected server error — retry (not charged)

`1072`

Temporarily unavailable — retry (not charged)

`1080`

Insufficient balance for the outcome (not charged)

## Schemas

Shared models referenced across endpoints — response envelopes, the error shape, pagination, and request bodies.

PhoneNumber

One of a person's phone numbers.

phonestringrequired

The number in international E.164 form.

typeenumrequiredmobile · personal · direct

How the number relates to the person:

- `mobile` — their mobile number.
- `personal` — a personal number (mobile or landline).
- `direct` — a direct work line.

line_typestringrequired

The kind of line, from the number's numbering plan: `mobile`, `fixed_line`, `fixed_line_or_mobile` (always the case in the US and Canada), `voip`, `personal_number`, or empty when unknown.

countrystringrequired

Two-letter ISO 3166-1 code of the number's country (empty when unknown).

is_sharedbooleanrequired

The number is also listed for several other people — typically a company switchboard rather than a personal line. Shared numbers are listed last.

Experience

One role from the person's work history.

companystringrequired

titlestringrequired

company_urlstring

The company's LinkedIn page, when known (omitted otherwise).

logostring

The company's logo URL, when known (omitted otherwise).

start_yearinteger

Year the role started (omitted when unknown).

end_yearinteger

Year the role ended — omitted for the current role.

Education

One school from the person's education.

schoolstringrequired

degreestringrequired

fieldstring

Field of study (omitted when unknown).

Person

A professional profile.

full_namestringrequired

first_namestringrequired

last_namestringrequired

headlinestringrequired

summarystringrequired

The profile's about section (may be empty).

titlestringrequired

Current job title (empty when unknown).

linkedin_urlstringrequired

profile_picturestringrequired

Profile picture URL (may be empty).

locationstringrequired

industrystringrequired

follower_countintegerrequired

is_premiumbooleanrequired

is_open_to_workbooleanrequired

experienceobject\[\]required

Work history, current role first (null when none).

companystringrequired

titlestringrequired

company_urlstring

The company's LinkedIn page, when known (omitted otherwise).

logostring

The company's logo URL, when known (omitted otherwise).

start_yearinteger

Year the role started (omitted when unknown).

end_yearinteger

Year the role ended — omitted for the current role.

educationobject\[\]required

Education history (null when none).

schoolstringrequired

degreestringrequired

fieldstring

Field of study (omitted when unknown).

FindData

The `data` of a **Find** response.

foundbooleanrequired

True when at least one number is returned.

personobjectrequired

The profile the numbers belong to — null when `found` is false.

full_namestringrequired

first_namestringrequired

last_namestringrequired

headlinestringrequired

summarystringrequired

The profile's about section (may be empty).

titlestringrequired

Current job title (empty when unknown).

linkedin_urlstringrequired

profile_picturestringrequired

Profile picture URL (may be empty).

locationstringrequired

industrystringrequired

follower_countintegerrequired

is_premiumbooleanrequired

is_open_to_workbooleanrequired

experienceobject\[\]required

Work history, current role first (null when none).

educationobject\[\]required

Education history (null when none).

phonesobject\[\]required

The person's numbers, best first: personal lines before shared ones, mobiles first. Empty when `found` is false.

phonestringrequired

The number in international E.164 form.

typeenumrequiredmobile · personal · direct

How the number relates to the person:

- `mobile` — their mobile number.
- `personal` — a personal number (mobile or landline).
- `direct` — a direct work line.

line_typestringrequired

The kind of line, from the number's numbering plan: `mobile`, `fixed_line`, `fixed_line_or_mobile` (always the case in the US and Canada), `voip`, `personal_number`, or empty when unknown.

countrystringrequired

Two-letter ISO 3166-1 code of the number's country (empty when unknown).

is_sharedbooleanrequired

The number is also listed for several other people — typically a company switchboard rather than a personal line. Shared numbers are listed last.

ReverseData

The `data` of a **Reverse** response.

phonestringrequired

The number you sent, in international E.164 form.

foundbooleanrequired

True when at least one person is returned.

candidatesobject\[\]required

The people behind the number. Usually one; up to 3 when the number is shared (e.g. a household line). Empty when `found` is false.

full_namestringrequired

first_namestringrequired

last_namestringrequired

headlinestringrequired

summarystringrequired

The profile's about section (may be empty).

titlestringrequired

Current job title (empty when unknown).

linkedin_urlstringrequired

profile_picturestringrequired

Profile picture URL (may be empty).

locationstringrequired

industrystringrequired

follower_countintegerrequired

is_premiumbooleanrequired

is_open_to_workbooleanrequired

experienceobject\[\]required

Work history, current role first (null when none).

educationobject\[\]required

Education history (null when none).

FindResponse

Successful **Find** response.

successbooleanrequired

statusCodeintegerrequired

Mirrors the HTTP status code.

messagestringrequired

errorsobject?required

Always null on success.

dataobjectrequired

The `data` of a **Find** response.

foundbooleanrequired

True when at least one number is returned.

personobjectrequired

The profile the numbers belong to — null when `found` is false.

phonesobject\[\]required

The person's numbers, best first: personal lines before shared ones, mobiles first. Empty when `found` is false.

ReverseResponse

Successful **Reverse** response.

successbooleanrequired

statusCodeintegerrequired

Mirrors the HTTP status code.

messagestringrequired

errorsobject?required

Always null on success.

dataobjectrequired

The `data` of a **Reverse** response.

phonestringrequired

The number you sent, in international E.164 form.

foundbooleanrequired

True when at least one person is returned.

candidatesobject\[\]required

The people behind the number. Usually one; up to 3 when the number is shared (e.g. a household line). Empty when `found` is false.

ErrorResponse

successbooleanrequired

statusCodeintegerrequired

Mirrors the HTTP status code.

messagestringrequired

error_codestringrequired

Stable machine-readable code (see **Error codes**).

errorsobject?required

dataany?required

ValidationErrorResponse

successbooleanrequired

statusCodeintegerrequired

messagestringrequired

error_codestringrequired

errorsobjectrequired

dataany?required

AuthErrorResponse

successbooleanrequired

statusCodeintegerrequired

messagestringrequired

errorsobject?required

dataany?required
