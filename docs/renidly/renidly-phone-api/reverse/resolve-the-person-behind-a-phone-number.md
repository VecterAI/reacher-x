# Resolve any B2B identity in milliseconds

GET

https://renidly.com/api/phones/v1/reverse

5Defaultreacher-x-search-engine-development-previewreacher-x-search-engine-productionSend⌘↵

Resolve the person behind a phone number

Give a phone number and get the professional profile behind it — name, role, LinkedIn, and work history. A number shared by a few people (e.g. a household line) returns up to **3 candidates**; a switchboard listed for many people returns none.

**Billing** (by outcome):

- One or more people returned → the endpoint's credit cost, **once per call** however many candidates come back.
- The number matched but none of its people could be returned → **1 credit**.
- Number unknown to us → **free**.
- Invalid number or `country` (`400`), or an error → **free**.

Your balance must cover the endpoint's full credit cost for the call to be accepted.

Show more

Request

phone\*stringquery

The phone number, in any common format: `+1 (941) 4484013`, `650.253.0000`, `00 44 20 7946 0958`. Digits, spaces and `+ ( ) - .` only.

countrystringquery

Two-letter ISO 3166-1 country code used for a number written without a country code (`+` or `00`) — e.g. `GB` for `020 7946 0958`. Ignored when the number carries its own. Defaults to `US`.

Responses

200400401402403429500503

200OK

HTTP `200`. The lookup ran — read `data.found`:

- **Found** — `found: true`, `candidates` holds the person (or up to 3 people when the number is shared). Billed the endpoint's credit cost, once per call.
- **Matched, nothing returned** — `found: false`, `candidates` empty: the number is known but none of its people could be returned (e.g. their profiles no longer exist). Billed **1 credit**.
- **Unknown number** — `found: false`, `candidates` empty: we have no one for this number, or it is a shared switchboard line. **Free**.

Schema

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

ResponseHeadersCode examples

No response yet

Hit **Send** to fire a live request against the endpoint.
