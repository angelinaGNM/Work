# Bloo Security — Comprehensive Knowledge Base

## Overview — What is Bloo / Bloo Hypercloud?

Bloo (operating as **Bloo Systems Inc**, sometimes referred to as **Bloo Security**) is an enterprise cybersecurity platform founded in 2024 and headquartered in the United States. The company's tagline is **"The Future of Enterprise Logging"**, and its core proposition is: *"Capture everything. Retain it for years. Search it instantly. No ingestion penalties. No cold storage. No loss of control."*

Bloo is purpose-built for organizations overwhelmed by log volume and cost. It positions itself as a next-generation Managed Detection and Response (MDR) + SIEM platform that owns its own logging and detection infrastructure rather than wrapping third-party tools. The platform rests on three integrated security pillars:

1. **Enterprise Logging** — unlimited ingestion with 98%+ compression
2. **SIEM with Detection Engineering** — custom, validated detections mapped to real-world adversary TTPs
3. **AI CyberOps** — automated triage, campaign correlation, and incident response

**Founding story (per CEO Shomiron Das Gupta):** Bloo was launched on June 16, 2025, to address a gap he identified: "threat detection still fails when it matters most" despite decades of security investment. Traditional MDRs act as service wrappers around third-party tools without owning the telemetry stack. Bloo deploys its own proprietary logging and detection infrastructure directly in customer environments, with flat-rate pricing independent of log volume.

**Company name origin:** "Bloo" draws from *Blue Teams* (cybersecurity defenders) and *Blue Ocean Strategy* (creating new market space rather than competing in saturated ones). The company logo uses an infinity symbol representing the continuous, evolving nature of cybersecurity work.

**Scale claimed:**
- 100+ enterprise customers worldwide
- 1M+ events per second processed
- 99.99% uptime SLA
- 500+ team members across 5 continents

---

## Platform Modules

### 1. Logging & Telemetry
The foundation of the platform, enabling unlimited log ingestion from cloud, on-premise, and hybrid environments.

- **Compression:** 98.4% compression ratio via columnar storage and advanced deserialization, cutting storage footprint by 70%
- **Retention:** Default 365-day hot retention; customizable up to 5+ years with no performance degradation or rehydration delays
- **Query Performance:** Sub-2-second response times across up to 5 years of historical data
- **Processing:** Sub-second latency, real-time processing, pattern-based parsing with automatic field extraction
- **Formats supported:** JSON, XML, CSV, syslog, HTTP endpoints, SaaS connectors; custom parser development available
- **Compliance-ready retention:** SOX (7 years), HIPAA (6 years), CJIS (7 years)
- **Security:** End-to-end encryption, role-based access control, audit logging

### 2. Threat Detection (SIEM with Detection Engineering)
An advanced SIEM layer built around behaviorally-grounded, continuously-validated detection logic.

- **Detection workbooks:** Jupyter-style modular blocks supporting statistical analysis, pattern recognition, and outlier detection
- **Execution modes:** On-demand, scheduled, real-time streaming, parallel
- **Behavioral analytics:** Establishes baselines and detects anomalies beyond signature-based approaches
- **Threat intelligence:** Real-time, continuously updated feed integrated directly into detection logic
- **Campaign detection:** ML-based automatic correlation of related signals using pattern grouping, temporal analysis, and confidence scoring
- **MITRE ATT&CK mapped:** All detections aligned to the ATT&CK framework
- **Response triggers:** Activate within milliseconds of detection
- **Performance:** 99.9% detection rate for known threats; <1 second response for critical threats

### 3. Response Automation
Playbook-driven automated incident response with human-expert validation.

- **Playbook management:** Create, manage, and optimize response playbooks via a no-code interface
- **Automated actions:** Pre-defined responses execute based on threat classification and severity
- **Conditional workflows:** Complex branching logic to handle diverse threat scenarios
- **Integration hub:** REST APIs and SDKs for custom integrations with third-party tools
- **Scale:** Distributed architecture handles thousands of automated responses per second
- **Stated accuracy:** 99.9% for automated actions; <1 second response for critical incidents
- **24/7 operation:** Fully autonomous execution without human intervention required

### 4. Threat Research
The internal Threat Research & Intelligence (TRI) team continuously generates detection-ready intelligence.

- **TTPs catalogued:** 5,000+
- **Threat actors tracked and analyzed:** 200+
- **Campaigns documented and attributed:** 1,000+
- **Attribution accuracy:** 99.9% for major campaigns
- **Methodology:** Threat actor cataloging → threat classification → controlled-environment simulation → detection engineering → validation
- **Malware database:** 16 malware families fully analyzed
- **Research outputs:** Blog posts, malware analysis reports, IOC lists, MITRE ATT&CK mappings, GitHub-published detection code

### 5. Integrations
100+ pre-built integrations across four categories:

**Security Tools:** Akamai Security Events, Cisco Secure Endpoint, CloudSEK, Sophos, Tenable Security Center

**Cloud Platforms:** Amazon Inspector, AWS CloudTrail, AWS CloudWatch, AWS GuardDuty, AWS Kinesis, Azure Blob Storage, Azure Event Hub, Cloudflare, GCP Activity Logs, GCP Pub/Sub

**SaaS Applications:** Google Workspace, Jumpcloud, Microsoft Exchange Online, RediffMail Pro, Trend Micro Vision One

**Infrastructure / SIEM:** Microsoft Sentinel

**Custom:** REST APIs with full documentation, webhooks for real-time event notifications, language-specific SDKs, unlimited custom integrations supported

**Performance:** <100ms sync latency, 99.99% API uptime

### 6. Analytics & Reporting
- Custom dashboards for security and compliance reporting
- Forensic analysis capabilities
- Compliance reports: SOX, HIPAA, PCI DSS, GLBA, GDPR, SOC 2, ISO 27001
- Timeline analysis and correlation engines for incident investigation

---

## Key Features & Capabilities

### Core Differentiators
- **No cold storage, no rehydration:** All retained data is instantly queryable regardless of age
- **Flat-rate pricing:** Not metered by log volume — eliminates the "log tax" that makes traditional SIEMs force customers to reduce ingestion
- **Own-stack MDR:** Bloo deploys its own telemetry infrastructure rather than wrapping third-party SIEMs
- **Validated detections:** Every detection rule is tested against real adversary simulations before deployment
- **Campaign-level correlation:** Signals are automatically grouped into attack campaigns rather than presented as isolated alerts
- **AI-human collaboration:** AI handles triage and validation at machine speed; human analysts provide strategic oversight

### Performance Benchmarks
| Metric | Value |
|--------|-------|
| Data compression ratio | 98%+ (98.4% stated) |
| Hot data query response | <2 seconds across 5 years |
| Detection rate (known threats) | 99.9% |
| Critical threat response time | <1 second (automated); 15 minutes (human expert) |
| Uptime SLA | 99.99% |
| Event processing throughput | 1M+ events/second |
| Cost reduction vs. traditional SOC | 60% |
| False positive reduction | 60% |
| Incident response improvement | 75% faster |
| Storage cost reduction | 40% |

### DETR: Detection. Engineering. Triage. Response.
Bloo's full-spectrum detection and response offering:
- **StealthPack:** Continuously updated detection packs tuned to real-world campaigns, pre-tested via red team simulations
- **Remote Admin:** Centralized rule deployment with non-invasive control
- **AI-Powered Triage:** Alert assessment linking events to known campaigns and threat actors, with context-specific countermeasure execution

### SpecterForce
Bloo's internal elite cybersecurity research and response team:
- 100+ security researchers worldwide
- 24/7 threat monitoring
- 50+ countries monitored
- 1,000+ threats evaluated daily
- Services: threat intelligence, incident response, security research, training & education

### Bloo Platform Components (full stack)
- **SIEM** — Centralized logging, correlation, and alerting
- **UEBA** — User and Entity Behavior Analytics
- **NBAD** — Network Behavior Anomaly Detection
- **EPM** — Endpoint Performance Monitoring (lightweight, fully integrated)

---

## Use Cases

### By Industry

**Financial Services / FinTech**
- PCI DSS, SOX, GLBA, PSD2, GDPR compliance automation
- Real-time AI-powered fraud detection
- Transaction monitoring for suspicious activity, account takeovers, unauthorized access
- Claims: 500+ financial institutions protected, 1M+ fraud attempts prevented, <1 minute average response

**Healthcare**
- HIPAA compliance (6-year retention)
- Ransomware prevention and detection
- Data integrity monitoring

**Manufacturing / OT-IT Security**
- ICS and industrial IoT device protection
- Anomaly detection for equipment failure and production irregularities
- Predictive maintenance via real-time data analysis
- Supply chain security across production lifecycle
- Legacy system compatibility
- Claims: 1,000+ facilities protected, 60% faster OT threat detection, 99.9% system uptime

**Technology / Cloud-Native**
- Cloud-native security for modern applications
- DevSecOps integration
- Distributed environment visibility

**Retail**
- PCI DSS compliance
- Transaction fraud monitoring

**Startups**
- Quick deployment ("minutes, not months")
- SOC 2, ISO 27001 compliance built in
- Scalable pricing matching startup budgets

### By Functional Need
- Organizations replacing legacy SIEMs that cannot scale with modern data volumes
- Security teams suffering alert fatigue from unvalidated generic detections
- Enterprises needing long-term hot data retention for compliance (7+ year requirements)
- Teams seeking to reduce SOC operational costs by ~60%
- Organizations wanting campaign-level threat visibility rather than isolated alert views

---

## Pricing

**No public pricing is available.** Bloo does not publish pricing tiers, per-seat costs, or rate cards on any public page. Key pricing principles:

- **Flat-rate model:** Pricing is independent of log volume — a deliberate differentiator from traditional SIEM vendors who charge per GB ingested
- **60% cost reduction** claimed vs. traditional SOC operations
- **80% AWS data lake cost reduction** documented internally
- All pricing inquiries: bloo.io/contact/sales or bloo.io/contact/demo

---

## Blog Insights

The Bloo blog publishes content across three themes: (1) threat research and malware analysis, (2) detection engineering methodology, and (3) company/product thought leadership. Primary authors: Siddhant (Threat Researcher), Shomiron Das Gupta (CEO), Shailendra Singh Sachan (Security Expert), Aniket Bhirud (Product Evangelist), Siddharth Singh (Security Expert), Rakshit Shetty.

### Company Announcements

#### Launch Day — Bloo Systems Inc (June 16, 2025)
CEO Shomiron Das Gupta announced Bloo's public launch. Traditional MDRs function as "service wrappers around third-party tools" without owning the telemetry stack. Bloo's differentiation: proprietary logging infrastructure deployed in customer environments, pre-validated detections, automatic campaign grouping, flat-rate pricing, and AI-driven triage.

#### What's in the Name? (June 10, 2025)
"Bloo" derives from Blue Teams (defenders) and Blue Ocean Strategy (creating new market space). The infinity symbol in the logo represents that cybersecurity is continuous and has no end state.

#### Scaling with Purpose: Welcoming Sharad Sanghi (August 18, 2025)
Sharad Sanghi (founder of Netmagic Solutions, India's first data center; acquired by NTT in 2012; now CEO of Neysa, an AI-native hyperscale cloud company) joined Bloo's Strategic Advisory Board.

#### Accelerating Cyber Defense with Dr. Gaurav Raina (July 24, 2025)
Dr. Gaurav Raina (Professor of Electrical Engineering, IIT Madras; contributor to India's UPI digital payments infrastructure; chair of India's Ayushman Bharat Digital Mission) joined Bloo's Strategic Advisory Board. Expertise in anomaly detection via deep learning and large-scale systems design.

---

### Detection Engineering Methodology

#### Why Detection Engineering Needs to Evolve Beyond the Basics (April 24, 2025)
Author: Siddhant. Telemetry (e.g., Sysmon logs) should function as a "real-time storyteller" rather than forensic artifact. Organizations must shift to behavior-centric thinking — hunting credential theft mechanisms, lateral movement signatures, and post-exploitation traces regardless of malware presence. Adversarial simulation tools (Atomic Red Team, Metasploit) should be used to identify detection gaps.

#### How Running Adversarial Simulations Reshaped Detection Engineering (April 15, 2025)
Author: Siddhant. Simulated attackers bypassed signature-based logic by chaining methods and using trusted system binaries. Behavioral pattern detection — suspicious process chains, anomalous token impersonation, unusual registry changes — proved far more resilient. Detections must be regularly pressure-tested.

#### Re-imagining Threat Intelligence (April 23, 2025)
Author: Siddhant. Raw IOC volume is not the measure of success — contextual enrichment and actionable use is. The team uses n8n to automate enrichment workflows connecting diverse data sources. TI should be a strategic function shaping detection priorities, not a passive data feed.

#### Beyond the Hype: Battle-Tested Detections for MDR (April 25, 2025)
Author: Aniket Bhirud. Cites Verizon 2023 DBIR: median attacker dwell time of 16 days before detection. SANS 2023: organizations prioritizing detection validation reduce incident response time by 30%. Bloo's six-stage methodology: threat research + MITRE ATT&CK mapping → detection development → rigorous testing + false positive analysis → continuous tuning → staged deployment → adversary tracking.

#### Threat Detection Engineering: Building Rules That Matter (March 25, 2024)
Author: Shomiron Das Gupta. Four-phase detection lifecycle: Research → Development → Deployment → Maintenance. Common mistakes: overly broad rules, inadequate testing, poor documentation, neglecting maintenance.

---

### AI in Security Operations

#### The Explainability Gap: Why AI in Your SIEM Needs to Show Its Work (February 23, 2026)
Author: Siddhant. AI should be treated as a "Junior Analyst requiring structured hierarchical oversight." SOC teams report AI trading 1,000 low-level alerts for 10 hallucinations creates "Alert Fatigue 2.0." Proposes a maturity model matching AI complexity to asset type: deterministic for predictable systems, statistical for noisy data, probabilistic AI for massive-scale cloud.

#### Why Your MDR Needs AI (April 16, 2025)
Author: Shomiron Das Gupta. AI advantages for MDR: analyzing vast data volumes in seconds, ML from historical incidents reduces false positives, predictive defense by forecasting emerging attack vectors, human-AI collaboration where skilled analysts remain essential.

#### The Future of Security Operations: AI and Human Collaboration (March 25, 2024)
Author: Shomiron Das Gupta. AI excels at pattern recognition, anomaly detection, threat hunting, alert triage. Humans provide context understanding, strategic thinking, creative problem-solving, decision-making. Framework: establish AI boundaries → create workflows → train teams → measure results.

---

### Threat Research & Technical Posts

#### Nullcon 2026: Detection Engineering Signals (March 6, 2026)
Author: Siddhant. Key takeaways: Zero-day exploits are now business decisions — detection teams must function as "risk translation layers." Move from CVE compliance checklists to telemetry observing exploit primitives. Supply chain becomes a primary attack vector requiring vendor behavior monitoring.

#### Detecting Covert Exfiltration Through Kernel Signature Analysis (February 4, 2026)
Author: Siddhant. Methodology for detecting "low-and-slow exfiltration" by examining TCP behavior at the kernel level. Four detection metrics: Inter-arrival Time variance, packet size distribution, throughput patterns, window size evolution irregularity. Implementation code published on GitHub.

#### Radar Vision for the SOC: Micro-Doppler Physics for C2 Beaconing Detection (January 6, 2026)
Author: Siddhant. Adapts radar micro-Doppler signature analysis to detect low-volume periodic C2 beaconing. Applies Fast Fourier Transform (FFT) to Sysmon event time-series data. A beacon checking in every 5 minutes (288 events/day) bypasses threshold-based rules but is visible in frequency space.

#### Project MSFDefender (January 28, 2026)
Author: Shailendra Singh Sachan. Defensive research generating Windows Metasploit payload telemetry for detection engineering. Used Sysmon + NXLog to capture process creation, command-line execution, network activity, image loads, thread injection, registry changes, file operations.

#### Shai Hulud 2.0: npm Supply Chain Attack Analysis (December 2, 2025)
Author: Siddhant. Blue team analysis of a rapid-spreading npm supply chain attack. Scale: 569 repositories compromised, 115+ unique victims, 10 active GitHub tokens, 2 AWS accounts compromised. Attack uses npm "preinstall" script auto-execution to harvest GitHub PATs, npm tokens, AWS/GCP/Azure credentials.

#### Lumma Stealer: Threat Landscape 2024–2025 (August 22, 2025)
Author: Siddhant. 369% increase in Lumma Stealer infections from early to late 2024. Five delivery vectors: phishing emails, malvertising/SEO poisoning (ClickFix fake CAPTCHA), compromised websites, trojanized software, legitimate platform abuse (GitHub, Discord CDN). Operates as Malware-as-a-Service.

#### Dark-Kill: How Custom Callbacks Disable EDRs (July 10, 2025)
Author: Shailendra Singh Sachan. EDRs rely on the `nt!PspCallProcessNotifyRoutines` kernel callback array. Attackers register malicious kernel callbacks that intercept and block EDR process creation. Recommended defenses: Secure Boot + driver signing enforcement, kernel structure memory protection, behavioral detection of suspicious callback registrations.

#### Domain Generation Algorithms: Detection via Shannon Entropy (July 3, 2025)
Author: Siddharth Singh. DGAs create rapid, disposable C2 domains with measurably higher Shannon entropy than legitimate domains. Detection workflow: analyze DNS/firewall logs in 5-minute windows, calculate entropy per domain, flag those exceeding a calibrated threshold.

#### From Headlines to Slack: Automating Threat Intelligence Delivery (June 30, 2025)
Author: Shailendra Singh Sachan. n8n-based workflow aggregating RSS feeds from The Hacker News, BleepingComputer, Palo Alto Unit42, Splunk, ThreatPost; summarizes via OpenAI; distributes via Slack and Gmail. Delivers a 5–10 minute daily cybersecurity bulletin.

#### Reducing AWS Data Lake Costs by 80% (June 27, 2025)
Author: Ashish Panda. Three-pronged cost reduction: (1) Caching layer — 28% savings, 58% I/O improvement; (2) Kubernetes migration from fixed VMs to autoscaling pods — 20% savings; (3) Spot + on-demand instance mix via Karpenter — 33% savings. Total: 80% cost reduction.

#### The Evolution of Enterprise Logging: Beyond Basic SIEM (March 25, 2024)
Author: Shomiron Das Gupta. Traditional SIEM limitations: cannot scale with modern data volumes, high storage costs, rigid query languages. Measurable outcomes from modernization: 60% false positive reduction, 75% faster incident response, 40% storage cost decrease, 3x threat detection accuracy improvement.

---

## Integrations & Ecosystem

### Pre-Built Integrations (100+)

| Category | Tools |
|----------|-------|
| Security | Akamai, Cisco Secure Endpoint, CloudSEK, Sophos, Tenable |
| Cloud | AWS CloudTrail, CloudWatch, GuardDuty, Inspector, Kinesis; Azure Blob, Event Hub; Cloudflare; GCP Activity Logs, Pub/Sub |
| SaaS | Google Workspace, Jumpcloud, Microsoft Exchange Online, RediffMail Pro, Trend Micro Vision One |
| SIEM/Infrastructure | Microsoft Sentinel |

### Custom Integration Methods
- REST APIs with full documentation
- Webhooks for real-time event notifications
- Language-specific SDKs
- Unlimited custom integration development supported

### Deployment Options
- SaaS (cloud-hosted)
- On-premises (self-hosted)
- Hybrid environments

### Malware Research Catalog (16 Families Fully Analyzed)
| Malware | Type | Threat Level |
|---------|------|-------------|
| GhostSocks | Proxy Malware | HIGH |
| SmokeLoader | Modular Loader | HIGH |
| Remcos | Remote Access Trojan | HIGH |
| RedLine Stealer | Information Stealer | HIGH |
| DRATzarus | Remote Access Trojan | HIGH |
| GolangGhost | RAT/Backdoor | HIGH |
| DarkGate | RAT/Loader | HIGH |
| Supper | Remote Access Trojan | CRITICAL |
| Lumma Stealer | Information Stealer | HIGH |
| Mimikatz | Credential Tool | HIGH |
| Cobalt Strike | Post-Exploitation | HIGH |
| Ghost RAT | Remote Access Trojan | HIGH |
| InvisibleFerret | Backdoor/RAT | HIGH |
| Quasar RAT | Remote Access Trojan | HIGH |
| SystemBC | Remote Access Trojan | CRITICAL |
| Volgmer | Backdoor Trojan | HIGH |

### Events
- **Bloofocus Mumbai 2025** — December 16, 2025 at JIO World Convention Center, Mumbai. Live detection workshop covering APT36, SideCopy, and APT41 targeting India.

---

## Leadership & Advisory Board

**Management Team:**
- **Shomiron Das Gupta** — Founder & CEO. Intrusion analyst and cybersecurity leader.
- **Santosh Vishwanath** — CTO. 17+ years building secure, scalable systems. Previously led Managed Security Services at Symantec.
- **Aniket Bhirud** — Director of Channel Sales. Decade of strategic partnership experience in cybersecurity.

**Strategic Advisory Board:**
- **Sharad Sanghi** — Founder of Netmagic Solutions (India's first data center, acquired by NTT 2012); Co-founder & CEO of Neysa (AI-native hyperscale cloud / HPC for model training)
- **Dr. Gaurav Raina** — Professor of Electrical Engineering, IIT Madras; contributor to India's UPI; chair of Ayushman Bharat Digital Mission; specializes in anomaly detection via deep learning

---

*Compiled from bloo.io on 2026-03-17. Pricing not publicly available — contact bloo.io/contact/sales.*
