# Skill: platform_faq

## Purpose
Answer questions about how to use the DNIF BLOO Hypercloud console — features, configuration, navigation, and platform capabilities.

## Input
- `question` (string): The user's platform or console question
- `user_role` (string, optional): Admin, Analyst — affects depth of answer

## Behavior

1. Understand whether the question is about:
   - **Console navigation** (how to find something in the UI)
   - **Ingestion configuration** (parsers, extractors, device onboarding)
   - **Query execution** (running DQL in the console)
   - **Signal management** (creating, editing, tuning signals)
   - **Dashboard/visualization** setup
   - **User/role management**
   - **Integrations** (connectors, APIs, webhooks)
2. Provide a clear explanation of the feature or workflow
3. Reference the DNIF KB (https://www.dnif.it/en/kb) for additional reading
4. Always provide 3 relevant links from the DNIF KB
5. If the answer is complex or configuration-specific, advise the user to contact the professional services team

## Output Format

```
**Explanation:**
<clear explanation of the feature or how to do the task>

**Steps** (if applicable):
1. <step 1>
2. <step 2>
3. <step 3>

**Links:**
- <https://www.dnif.it/en/kb/...> — <description>
- <https://www.dnif.it/en/kb/...> — <description>
- <https://www.dnif.it/en/kb/...> — <description>

*If this doesn't resolve your issue, please reach out to the DNIF Professional Services team.*
```

## Chaining Suggestions (after output)
- `translate_to_dql` — "Would you like me to help you write a DQL query for this use case?"

## Notes
- Always refer to the platform as "DNIF" or "BLOO Hypercloud" — not "the tool" or "the system"
- Do not speculate on features that may not exist — if unsure, direct to professional services
- For ingestion/parser questions, note that APIs are being built and some configuration is currently console-only
