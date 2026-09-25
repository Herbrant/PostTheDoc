# Security policy

PostTheDoc handles subscribers' email addresses and preferences, and every email it sends carries
signed links to a subscription. Reports that help keep them safe are very welcome.

## Reporting a vulnerability

Please **do not open a public issue**. Instead, either:

- use [GitHub's private vulnerability reporting](https://github.com/Herbrant/PostTheDoc/security/advisories/new), or
- write to **herbrant@protonmail.com**.

Describe the problem, how to reproduce it and what an attacker could do with it. You will get an
answer within a few days; once it is fixed, you are credited in the advisory unless you prefer
otherwise.

Never include working links from your own emails (confirm, manage preferences, unsubscribe): they
give access to your subscription. If you shared one by mistake, request a new manage link from the
site and write to the address above.

## Scope

The code in this repository and the instance at [postthedoc.it](https://postthedoc.it): the web
app, the Worker API and the daily job. Please do not run automated scans or load tests against the
live instance, and do not subscribe addresses you do not own.
