# Resolve any B2B identity in milliseconds

GET

https://renidly.com/api/emails/v1/find/batch

0Defaultreacher-x-search-engine-development-previewreacher-x-search-engine-productionSend⌘↵

Track a bulk find job

Poll a job from **Submit a bulk find job** to stream results as they land. `after` is a cursor — start at `0`, then pass back `next_cursor` (up to 100 items per page). This endpoint is **free** and always returns live progress (never cached).

Show more

Request

job_id\*stringquery

The opaque token returned at submit.

afterintegerquery

Result cursor — start at 0, then pass back `next_cursor`.

Responses

200400401403404429503

200OK

Current job state plus the next page of results. Poll repeatedly, advancing `after` to `next_cursor` (up to **100** items per page). This endpoint is **free** — you were charged per item at submit time.

`data.results` is an array; each entry echoes the `query` you submitted and gives `found` plus the discovered `email` (present only when `found` is true).

Schema

successbooleanrequired

statusCodeintegerrequired

messagestringrequired

errorsobject?required

dataobjectrequired

statusenumrequiredprocessing · completed · error

errorstring

totalintegerrequired

Unique people in the job.

resolvedintegerrequired

People for whom an email was found.

errorsintegerrequired

People where no email could be confirmed.

next_cursorintegerrequired

resultsobject\[\]required

ResponseHeadersCode examples

No response yet

Hit **Send** to fire a live request against the endpoint.
