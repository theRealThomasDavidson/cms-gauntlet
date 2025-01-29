-- Insert core knowledge base articles
INSERT INTO kb_articles (
  org_id,
  title,
  content,
  status,
  is_public,
  created_by,
  updated_by
) VALUES (
  (SELECT id FROM organizations WHERE name = 'Default Organization' LIMIT 1),
  'Canoe Repair Guide',
  $md$# Canoe Repair Process Guide

## Common Repairs
1. Small Holes (< 2 inches)
   - Clean edges required
   - Patch kit application
   - Surface preparation steps
   - Drying time requirements

2. Medium Damage
   - Hull cracks
   - Gunwale damage
   - Seat repairs
   - Keel repairs

3. Structural Issues
   - Frame reinforcement
   - Hull integrity checks
   - Support beam replacement
   - Stress point analysis

## Customer Preparation
- Remove personal items
- Clear access path
- Secure workspace
- Weather considerations$md$,
  'published',
  true,
  (SELECT id FROM profiles LIMIT 1),
  (SELECT id FROM profiles LIMIT 1)
);

-- Add Canoe Activities Guide
INSERT INTO kb_articles (
  org_id,
  title,
  content,
  status,
  is_public,
  created_by,
  updated_by
) VALUES (
  (SELECT id FROM organizations WHERE name = 'Default Organization' LIMIT 1),
  'Canoe Activities Guide',
  $md$# Canoe Activities and Uses

## Fishing
- Best models for stability
- Equipment mounting options
- Quiet approach techniques
- Storage solutions

## Camping
- Cargo capacity guidelines
- Weather protection
- Multi-day trip essentials
- Portage techniques

## Adventure
- Skill level requirements
- Safety equipment
- Navigation basics
- Emergency procedures$md$,
  'published',
  true,
  (SELECT id FROM profiles LIMIT 1),
  (SELECT id FROM profiles LIMIT 1)
); 