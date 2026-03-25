# B Copilot — Skills ↔ PRD Mapping

---

## 1. In-Scope Capabilities (PRD §2.1)

| PRD In-Scope Capability | Mapped Skills |
| :--- | :--- |
| Natural Language Querying | `translate_to_dql`, `explore_detections`, `explore_logs` |
| Log Ingestion & Parsing | `extractor_builder`, `stream_health`, `source_health` |
| Data Pipeline Routing | `stream_health`, `source_health`, `usage_analytics` |
| Alert & Detection Insights | `explore_detections`, `translate_to_dql`, `explain_signal` *(suggested)* |
| Signals & Anomalies | `correlate_signals`, `triage_user`, `triage_entity`, `triage_host`, `triage_ip` |
| Incident Context | `correlate_signals`, `incident_response`, `executive_summary` |
| IOC Analysis | `enrich_ioc`, `mitre_lookup`, `cve_lookup` |
| Entity Investigations | `triage_user`, `triage_entity`, `triage_host`, `triage_ip` |
| UEBA Insights | `triage_user`, `triage_entity`, `model_advisor`, `peer_comparison` *(suggested)* |
| Detection Rule Creation | `workbook_builder` |
| Endpoint Security Insights | `triage_host` |
| Network Behavior Analysis | `triage_ip` |
| Investigation Assistance | `incident_response`, `page_context_advisor`, `executive_summary` |
| SOAR Integration | `incident_response`, `playbook_builder` |

---

## 2. Functional Requirements — Log Management (PRD §1.3)

| Functional Requirement | Mapped Skill(s) | Notes |
| :--- | :--- | :--- |
| Log Query Generation | `translate_to_dql` | |
| Pipeline Error Diagnosis | `stream_health`, `source_health` | |
| Pipeline Health Monitoring | `stream_health`, `source_health`, `usage_analytics` | |
| AI-Generated Log Parsers | `extractor_builder` | |
| Log Search | `translate_to_dql`, `explore_logs` | |
| Log Summarization | `translate_to_dql` + LLM summary step | |
| Log Pattern Detection | `time_series_analysis`, `field_distribution` | |
| Log Aggregation | `translate_to_dql` | groupby / timeslice DQL |
| Report Generation | `compliance_report`, `executive_summary` | |
| Report / Workbook Scheduling | `workbook_builder` | Creation only — scheduling TBD |
| Reports / Dashboard Query Inspection | `product_guide`, `translate_to_dql` | |
| Dashboard Creation | `suggest_visualization` | |
| Workbook Creation | `workbook_builder` | |
| Query Suggestions / Autocomplete / Optimization | `translate_to_dql`, `product_guide` | Partial coverage |
| Slow Query Analysis | — | **Gap — no skill** |
| Search Result Analysis | `translate_to_dql` + inline LLM reasoning | |
| Time Range Analysis | `time_series_analysis`, `translate_to_dql` | |
| Service Log Exploration | `explore_logs`, `translate_to_dql` | |
| Environment Filtering | `translate_to_dql` | Filter via DQL parameters |

---

## 3. Functional Requirements — Signals Page (PRD §1.3 Signals)

| Functional Requirement | Mapped Skill(s) | Notes |
| :--- | :--- | :--- |
| Entity-Centric Analysis | `triage_user`, `triage_entity`, `triage_host`, `triage_ip` | |
| Detection Event Analysis | `explore_detections`, `translate_to_dql` | |
| Signal Correlation | `correlate_signals` | |
| Signal Raw Log Analysis | `translate_to_dql` | |
| Signal Trend Analysis | `time_series_analysis` | |
| Historical Signal Lookup | `explore_detections`, `translate_to_dql` | |

---

## 4. Functional Requirements — UEBA (PRD §2.3)

| Functional Requirement | Mapped Skill(s) | Notes |
| :--- | :--- | :--- |
| Entity Investigation | `triage_user`, `triage_entity` | |
| Baseline Behavior Analysis | `model_advisor`, `triage_user`, `triage_entity` | |
| Rare Behavior Detection | `triage_user`, `triage_entity` | |
| Behavioral Drift Detection | `triage_user`, `triage_entity` | |
| Peer Group Comparison | `peer_comparison` | Suggested skill — not yet confirmed |
| Cross-Department Comparison | `peer_comparison` | Suggested skill — not yet confirmed |
| Anomaly Peer Group Analysis | `peer_comparison` | Suggested skill — not yet confirmed |
| Cloud Service Behavioral Insights | — | **Gap — no skill** |

---

## 5. Functional Requirements — EPM (PRD §3.3)

| Functional Requirement | Mapped Skill(s) | Notes |
| :--- | :--- | :--- |
| Resource Utilization Monitoring | `triage_host` | |
| Vulnerable Software Detection | `triage_host`, `cve_lookup` | |
| Agent Health Monitoring | `triage_host`, `source_health` | |
| Suspicious Process Detection | `triage_host` | |
| Malware Activity Detection | `triage_host`, `enrich_ioc` | |
| Dormant Endpoint Detection | `triage_host` | |
| EOL Compliance Monitoring | `triage_host`, `compliance_report` | |

---

## 6. Functional Requirements — NBAD (PRD §4.3)

| Functional Requirement | Mapped Skill(s) | Notes |
| :--- | :--- | :--- |
| Lateral Movement Detection | `triage_ip`, `correlate_signals` | |
| Network Traffic Anomaly Detection | `triage_ip` | |
| Geographic Traffic Analysis | `triage_ip` | |
| Reconnaissance Detection | `triage_ip` | |
| Network Operational Insights | `triage_ip`, `usage_analytics` | |

---

## 7. Functional Requirements — SOAR (PRD §5.2)

| Functional Requirement | Mapped Skill(s) | Notes |
| :--- | :--- | :--- |
| Mitigation Guidance | `incident_response` | |
| Playbook Generation | `playbook_builder` | |
| Playbook Validation | `playbook_builder` | Partial — validation step TBD |
| Log Source Guidance | `product_guide`, `page_context_advisor` | |
| Action Execution | `incident_response` | Guidance only — execution not yet in plan |
| Automated Remediation | extends `incident_response`| **Gap — no skill** |
| Threat Intelligence Mapping | `mitre_lookup`, `enrich_ioc` | |
| Guided Investigation Workflow | `incident_response`, `page_context_advisor` | |

---

## 8. Gaps Summary

| Gap | PRD Section |
| :--- | :--- |
| Slow Query Analysis | Log Management §1.3 |
| Cloud Service Behavioral Insights | UEBA §2.3 |
| Peer Group Comparison (confirmed skill needed) | UEBA §2.3 |
| Automated Remediation (execution) | SOAR §5.2 |
| Playbook Validation (verify integrations) | SOAR §5.2 |
