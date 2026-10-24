# Decisions

Every decision made during the build is recorded here and reported by email.

## Decision 1: Composer model requested for all work
The owner asked that the Composer model be used for all planning, coding, review and orchestration. Model selection cannot be forced from inside the bots (a bot cannot pick or switch the model it runs on), so this was flagged to the owner. If Composer is unavailable, work retries with backoff and the issue is mentioned in the next email; no silent model switch.

## Decision 2: Repo under Mukesh-RM, public, MIT
The repository is `Mukesh-RM/pagenest`: public, MIT licensed.
