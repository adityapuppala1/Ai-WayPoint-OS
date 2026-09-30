# How far Waypoint reaches into a life

Waypoint's aim is to be one companion for the big changes in a life, not twelve separate
tools. This page says, domain by domain, what it does today, what is still missing, and
what would close the gap. It is written to be checked against the code, so it names only
what exists.

The grid is the OECD Better Life Index (housing, income, jobs, community, education,
environment, civic engagement, health, life satisfaction, safety, work-life balance),
cross-checked against the WHO quality-of-life domains, then read by stage of life.

## How the parts work together

**One next step, from every module.** Today's sign is chosen by a fixed ladder in
`packages/core/src/next-step`: a safety note first, then getting started, then anything
with a deadline (a reminder that is due, a checklist item for now or this week), then money
under pressure, then the plan, then the weekly review or a check-in, then something to
explore. It uses only what the person has told Waypoint, it never invents a task, and it
needs no AI. Each step says in one line why it is shown, and "Not now" moves to the next one
with no guilt wording. Someone who lost their job sees the first item of the job-loss
checklist; someone caring for a relative is asked how they are, not offered a career plan.

**Every module is one tap away, and they point to each other.** Today lists all modules
with their live state (plan progress, checklist progress, money runway, weather), ordered by
the person's situation. At the foot of Shield, Money, Mind, Path, Services and Goals,
"Also on Waypoint" offers at most three related modules. The phone's "More" sheet is a
described directory, and Ctrl/Cmd+K (or search in "More") goes anywhere.

**Safety sits under everything.** Crisis detection runs before any AI, in every channel,
offline in the phone app, and on free text people write in Mind, Health and Goals. Help
lines come only from checked sources.

## By domain

| Domain | What Waypoint does now | What is missing | What would close the gap |
| --- | --- | --- | --- |
| **Safety** — strong | Crisis protocol with a calm support card and follow-up; help lines for 47 countries and emergency numbers for 48; Scam Shield in 7 languages (with an optional second opinion that can only add caution); quick exit; a one-tap button to text, call or email a trusted contact from the support card | A personal safety plan in the person's own words; elder-abuse and labour-exploitation lines; a "what now" path after being scammed | A safety plan (needs clinical review of the wording); sourcing and checking the missing lines per country |
| **Jobs** — strong | Role suggestions with reasons and honest AI-exposure notes, week-by-week plans, a job-loss checklist | Proof of work (the tables and signing exist, the pages do not); help with applications | Finish proof of work: project, peer review, signed credential |
| **Income** — partial | Money runway on a cautious income, pressure level, plain next steps, scam-safe habits; money pressure can become the next step on Today | A directory of free, independent debt and money advice | A sourced, dated directory per country, shown when money is tight |
| **Health** — partial | A private daily log, reminders that reach Today, emergency signs, checked non-emergency lines for six countries | More countries; a way to prepare for an appointment | An appointment-preparation sheet in the person's words (needs clinical review) |
| **Life satisfaction** — partial | Mood check-ins, a private journal, breathing and grounding, goals with a weekly review that can become the next step | Mood tags lead nowhere; nothing on grief, loneliness or sleep | Tag-aware pointers (money → Money, lonely → Circles), with the personalisation consent |
| **Community** — partial | Circles of up to 12, checked before anyone sees a post | Circles for carers, parents, grief, disability and later life in every language | A hosts programme per language |
| **Civic services** — partial | 11 life-event checklists with urgency, 37 official portals, progress that feeds Today | Long guidance is English only; country links for few countries; no checklists for caring, housing loss, separation, study or lost documents | Human translation of the checklists; new checklists written from official sources |
| **Environment** — partial | Weather, air and UV turned into plain advice, fetched by the device so location never reaches Waypoint | Official hazard alerts; preparing before extreme weather | A preparation checklist; alert feeds need a checked source per country |
| **Education** — thin | 33 learning resources inside plans | No checklist for leaving school or returning to study; most resources are English | Study checklists and resources in the other six languages |
| **Housing** — almost nothing | One rental-scam pattern | No help for rent arrears, eviction or homelessness | An "at risk of losing your home" checklist and checked housing lines |
| **Work-life balance** — thin | An attention budget, quiet hours, no streaks; caring is recognised on Today | No carers' checklist | A "caring for someone" checklist and route |

## By stage of life

| Who | What works | Biggest gap |
| --- | --- | --- |
| Working adults | Path, Money, Services, Shield | Proof of work |
| Carers and parents | Today no longer pushes a career plan; a new-baby checklist; a caring circle in three languages | A carers' checklist |
| Migrants and refugees | Seven interface languages; a moving-country checklist; new-country circles in all seven | Country-specific arrival steps; refugee services |
| People in crisis | Every channel, offline, trusted contact in one tap | A personal safety plan |
| People offline or with low literacy | SMS, WhatsApp, USSD; help numbers offline | Voice (IVR); read-aloud |
| People with disabilities | Automated accessibility checks in five browsers, 44px targets, lite mode, reduced motion | Testing with people who use assistive technology; read-aloud |
| Older people | A retirement checklist; voice-clone and family-emergency scam patterns | Elder-abuse lines; later-life circles |
| Teenagers | Child help lines; the minimum age is 13 | A safeguarding review before any teen content |

## What only people can add

Much of what is missing is not code. It needs translators and native-speaker reviewers,
clinicians for the crisis and health wording, lawyers for housing and money wording, and
people to find and check help lines and services in each country. Waypoint's rules say
nothing is invented, so these gaps stay visible here until someone has done that work.
