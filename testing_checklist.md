# Canoe CRM AI Testing Checklist

## Metrics Implementation
- [ ] Success Rate at Identifying Correct Action
  - [ ] Set up 90% accuracy tracking
  - [ ] Implement stage transition logging
  - [ ] Create calculation system
  - [ ] Test with sample transitions:
    - [ ] New Ticket → Triage
    - [ ] Triage → Repair Path
    - [ ] Activity Selection → Demo

- [ ] Field Update Accuracy
  - [ ] Set up 95% accuracy tracking
  - [ ] Implement field validation
  - [ ] Create accuracy calculator
  - [ ] Test with key fields:
    - [ ] stage_id updates
    - [ ] next_stage_id links
    - [ ] KB article connections

## Test Cases
- [ ] Repair Workflow
  - Simple Cases:
    - [ ] New ticket to triage movement
    - [ ] Patch completion process
    - [ ] Guide linking system
  - Complex Cases:
    - [ ] Damage analysis routing
    - [ ] History-based transitions
    - [ ] Dynamic KB linking

- [ ] Activities Workflow
  - Simple Cases:
    - [ ] New consultation setup
    - [ ] Equipment selection process
    - [ ] Demo scheduling
  - Complex Cases:
    - [ ] Preference-based recommendations
    - [ ] Guide matching system
    - [ ] Complete workflow navigation

## Database Validation
- [ ] Workflow Stages Table
  - [ ] Stage ID integrity
  - [ ] Next stage linking
  - [ ] Start/End flag accuracy

- [ ] Stage-Article Links
  - [ ] Connection validity
  - [ ] Link consistency
  - [ ] Relationship integrity

- [ ] Knowledge Base
  - [ ] Content relevance
  - [ ] Access control
  - [ ] Link validation

## Monitoring Setup
- [ ] LangSmith Integration
  - [ ] Decision tracking
  - [ ] Update logging
  - [ ] Response timing

- [ ] Testing Framework
  - [ ] Path verification
  - [ ] Input variation
  - [ ] Link validation

## Implementation Steps
1. [ ] LangSmith Configuration
   - [ ] API setup
   - [ ] Logging system
   - [ ] Dashboard creation

2. [ ] Test Data Preparation
   - [ ] Sample workflows
   - [ ] Test tickets
   - [ ] KB articles

3. [ ] Test Runner Development
   - [ ] Automation scripts
   - [ ] Validation checks
   - [ ] Report generation

4. [ ] Metrics Collection
   - [ ] Data gathering
   - [ ] Analysis tools
   - [ ] Report formatting 