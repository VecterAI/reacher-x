# Resolve any B2B identity in milliseconds

GET

https://renidly.com/api/phones/v1/find

5Defaultreacher-x-search-engine-development-previewreacher-x-search-engine-productionSend⌘↵

Find a person's phone numbers

Give a LinkedIn profile URL or username and get the person's known phone numbers, best first — personal lines before shared ones (e.g. a company switchboard), mobiles first — together with their profile.

**Billing** (by outcome):

- Numbers returned → the endpoint's credit cost.
- The profile doesn't exist, or we hold no numbers for it → **1 credit**.
- Malformed `url` (`400`), opted-out profile (`403`), or an error → **free**.

Your balance must cover the endpoint's full credit cost for the call to be accepted.

Show more

Request

url\*stringquery

The person's LinkedIn profile URL, or just the username at its end — for `https://www.linkedin.com/in/ryanroslansky`, pass either.

Responses

200400401402403429500503

200OK

HTTP `200`. The lookup ran — read `data.found`:

- **Found** — `found: true`, `person` is the profile and `phones` lists its numbers. Billed the endpoint's credit cost.
- **Not found** — `found: false`, `person` null, `phones` empty: the profile doesn't exist, or we hold no numbers for it. Billed **1 credit**.

Schema

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

ResponseHeadersCode examples

No response yet

Hit **Send** to fire a live request against the endpoint.
