-- Create junction table for stage-article relationships if it doesn't exist
CREATE TABLE IF NOT EXISTS workflow_stage_articles (
  id uuid primary key default uuid_generate_v4(),
  stage_id uuid references workflow_stages(id) on delete cascade,
  article_id uuid references kb_articles(id) on delete cascade,
  created_at timestamptz default now(),
  unique(stage_id, article_id)
);

-- Seed data for knowledge base articles
insert into kb_articles (
  org_id,
  title,
  content,
  status,
  is_public,
  created_by,
  updated_by
) values (
  -- Replace this with your org_id from the profiles table
  (select org_id from profiles limit 1),
  'Canoe Pricing Guide',
  $md$# Comprehensive Canoe Pricing Guide

## Base Pricing By Material (Length-Based)
### Aluminum ($30/ft)
- 10ft: $300 base
- 14ft: $420 base
- 18ft: $540 base
- 20ft: $600 base

### Fiberglass ($25/ft)
- 10ft: $250 base
- 14ft: $350 base
- 18ft: $450 base
(Not available in 20ft)

### Wood ($70/ft)
- 10ft: $700 base
- 14ft: $980 base
- 18ft: $1,260 base
- 20ft: $1,400 base

## Seating Configuration
- 10ft: Single seat configuration
- 14ft: Two seat configuration
- 18ft-20ft: Three seat configuration

## Per-Seat Accessories (One accessory per seat)
- Live Well: $150 (Not available for wood canoes)
- Outrigger Stabilizer: $350
- Swivel Fishing Seat: $125
- Rod Holder Station: $75
- Storage Box: $95

## Additional Accessories
- Padded Gunwale Covers: $120
- Canoe Dolly System: $175
- Spray Cover: $200
- Electric Motor Mount: $250
- Solar Charging Panel: $300 (pairs with Live Well)
- Anchor System: $85
- Custom Paint/Finish: $300-600

## Package Deals
### Fishing Package
- Includes: 2 Swivel Seats + 2 Rod Holders + Anchor System
- Package Discount: 15% off accessories

### Family Package
- Includes: Padded Gunwales + Storage Boxes + Spray Cover
- Package Discount: 15% off accessories

## Warranty Information
- Aluminum: 5-year structural, 2-year parts
- Fiberglass: 3-year structural, 2-year parts
- Wood: 2-year structural, 1-year parts
- Extended warranty available: +$200/year

## Trolling Motor Options
### Electric Trolling Motors
- Basic Motor (30lb thrust): $599
  * Perfect for 10-14ft canoes
  * 12V system
  * 2 speed settings
  
- Standard Motor (45lb thrust): $799
  * Ideal for 14-18ft canoes
  * 12V system
  * 5 speed settings
  * Battery meter included
  
- Premium Motor (55lb thrust): $1,099
  * Recommended for 18-20ft canoes
  * 24V system
  * Variable speed control
  * GPS anchor feature
  * Wireless remote

### Required Accessories for Motors
- 12V Deep Cycle Battery: $175
- 24V Dual Battery System: $399
- Battery Box: $45
- Quick-Release Mount: $89
- Wiring Kit: $35

### Motor Packages
- Basic Package: Motor + Battery + Box + Mount = 10% off
- Premium Package: Motor + Dual Battery + Box + Mount + Remote = 15% off$md$,
  'published',
  true,
  -- Replace these with your user_id from the profiles table
  (select id from profiles limit 1),
  (select id from profiles limit 1)
);

insert into kb_articles (
  org_id,
  title,
  content,
  status,
  is_public,
  created_by,
  updated_by
) values (
  (select org_id from profiles limit 1),
  'Canoe Specifications',
  $md$# Detailed Canoe Specifications

## Material Characteristics

### Aluminum
- Hull thickness: 0.080 inches
- Marine-grade aluminum alloy
- Maintenance: Low
- Durability: High
- Weight: Medium (65-85 lbs)
- Best for: Durability, low maintenance

### Fiberglass
- Hull thickness: 0.25 inches
- UV-resistant gelcoat
- Maintenance: Medium
- Durability: Medium
- Weight: Light (50-70 lbs)
- Best for: Performance, speed

### Wood
- Hull thickness: 0.5 inches
- Cedar strip or marine plywood
- Maintenance: High
- Durability: Medium
- Weight: Heavy (75-95 lbs)
- Best for: Aesthetics, traditional feel

## Size Specifications
### 10ft Model
- Beam width: 33 inches
- Weight capacity: 400 lbs
- Single seat configuration
- Ideal for: Solo paddling, small waters

### 14ft Model
- Beam width: 36 inches
- Weight capacity: 700 lbs
- Two seat configuration
- Ideal for: Tandem paddling, day trips

### 18ft Model
- Beam width: 38 inches
- Weight capacity: 1000 lbs
- Three seat configuration
- Ideal for: Family trips, extended journeys

### 20ft Model (Aluminum/Wood only)
- Beam width: 40 inches
- Weight capacity: 1200 lbs
- Three seat configuration
- Ideal for: Expedition, heavy cargo

## Accessory Specifications

### Live Well System
- Capacity: 15-20 gallons
- 12V pump system
- Aeration system
- Drain plug
- Not available for wood models

### Outrigger Stabilizer
- Extension: 30 inches
- Buoyancy: 30 lbs per side
- Quick-release mounting
- Adjustable angle

### Storage Solutions
- Waterproof compartments
- Capacity: 2.5 cubic feet per box
- Weather-resistant seals
- Quick-access latches

## Trolling Motor Specifications

### Basic Motor (30lb thrust)
- Power: 12V
- Amp Draw: 30A max
- Shaft Length: 30"
- Control: Tiller handle
- Runtime: ~2-3 hours continuous
- Weight: 15 lbs

### Standard Motor (45lb thrust)
- Power: 12V
- Amp Draw: 42A max
- Shaft Length: 36"
- Control: Telescoping tiller
- Runtime: ~2-4 hours continuous
- Weight: 19 lbs

### Premium Motor (55lb thrust)
- Power: 24V
- Amp Draw: 52A max
- Shaft Length: 42" adjustable
- Control: Wireless + tiller
- Runtime: ~6-8 hours continuous
- Weight: 23 lbs

### Battery Specifications
- 12V System: 100Ah Deep Cycle Marine Battery
- 24V System: Dual 100Ah Batteries
- Charging Time: 8-10 hours
- Battery Life: 2-3 years with proper maintenance
- Weight: 45 lbs per battery$md$,
  'published',
  true,
  (select id from profiles limit 1),
  (select id from profiles limit 1)
);

-- Make sure the articles are public and published
update kb_articles 
set 
  is_public = true,
  status = 'published'
where title in ('Canoe Pricing Guide', 'Canoe Specifications');

-- 1. WORKFLOW CREATION
-- Add unique constraint to workflows table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'workflows_name_key'
  ) THEN
    ALTER TABLE workflows ADD CONSTRAINT workflows_name_key UNIQUE (name);
  END IF;
END $$;

-- Create base workflows
WITH default_org AS (
  SELECT org_id as default_org_id, id as user_id 
  FROM profiles 
  WHERE auth_id = auth.uid() 
  LIMIT 1
)
INSERT INTO workflows (name, description, created_by, org_id) 
SELECT DISTINCT ON (v.name)
  v.name,
  COALESCE(w.description, v.description) as description,
  COALESCE(w.created_by, default_org.user_id) as created_by,
  COALESCE(w.org_id, default_org.default_org_id) as org_id
FROM (
  VALUES 
    ('Sales', 'Workflow for handling canoe sales inquiries and orders'),
    ('Canoe Repair', 'Workflow for handling repair or replacement requests for damaged canoes'),
    ('Canoe Activities', 'Workflow for helping customers learn about different canoe activities and uses')
) as v(name, description)
CROSS JOIN default_org
LEFT JOIN workflows w ON w.name = v.name
WHERE NOT EXISTS (
  SELECT 1 FROM workflows w2 
  WHERE w2.name = v.name
);

-- Then insert repair workflow stages
WITH repair_workflow AS (
  SELECT id FROM workflows WHERE name = 'Canoe Repair'
)
INSERT INTO workflow_stages (workflow_id, name, description, is_start, is_end, is_other) 
SELECT 
  (SELECT id FROM repair_workflow),
  name,
  description,
  is_start,
  is_end,
  false as is_other
FROM (VALUES
  ('New Ticket', 'Initial repair request...', true, false),
  ('Triage Damage', 'Evaluate damage severity...', false, false)
  -- ... other stages
) AS v(name, description, is_start, is_end)
WHERE EXISTS (SELECT 1 FROM repair_workflow)  -- Only insert if workflow exists
AND NOT EXISTS (
  SELECT 1 FROM workflow_stages ws 
  WHERE ws.workflow_id = (SELECT id FROM repair_workflow)
  AND (ws.name = v.name OR (ws.is_start = true AND v.is_start = true))
);

-- Set up stage connections for Sales workflow
WITH sales_stages AS (
  SELECT id, name, 
    lead(id) OVER (ORDER BY CASE 
      WHEN name = 'New Ticket' THEN 1
      WHEN name = 'get estimate' THEN 2
      WHEN name = 'get delivery information' THEN 3
      WHEN name = 'put in work order for Canoe' THEN 4
      WHEN name = 'Complete' THEN 5
    END) as next_id
  FROM workflow_stages
  WHERE workflow_id = (SELECT id FROM workflows WHERE name = 'Sales')
)
UPDATE workflow_stages ws1
SET next_stage_id = ss.next_id
FROM sales_stages ss
WHERE ws1.id = ss.id;

-- Update stage connections for Sales workflow
WITH sales_stages AS (
  SELECT ws.id, ws.name 
  FROM workflow_stages ws
  JOIN workflows w ON w.id = ws.workflow_id
  WHERE w.name = 'Sales'
),
articles AS (
  SELECT ka.id, ka.title 
  FROM kb_articles ka
)
INSERT INTO workflow_stage_articles (stage_id, article_id)
SELECT ss.id, a.id
FROM sales_stages ss
CROSS JOIN articles a
WHERE 
  ((ss.name = 'get estimate' AND a.title IN ('Canoe Pricing Guide', 'Canoe Specifications'))
  OR (ss.name = 'put in work order for Canoe' AND a.title = 'Canoe Specifications'))
  AND NOT EXISTS (
    SELECT 1 FROM workflow_stage_articles wsa 
    WHERE wsa.stage_id = ss.id 
    AND wsa.article_id = a.id
  );

-- Link articles to specific stages
WITH repair_stages AS (
  SELECT ws.id, ws.name 
  FROM workflow_stages ws
  JOIN workflows w ON w.id = ws.workflow_id
  WHERE w.name = 'Canoe Repair'
),
articles AS (
  SELECT ka.id, ka.title 
  FROM kb_articles ka
)
INSERT INTO workflow_stage_articles (stage_id, article_id)
SELECT rs.id, a.id
FROM repair_stages rs
CROSS JOIN articles a
WHERE 
  (rs.name = 'Triage Damage' AND a.title = 'Canoe Repair Guide')
  OR (rs.name = 'Software Patch' AND a.title = 'Canoe Repair Guide')
  OR (rs.name = 'Process Replacement' AND a.title = 'Canoe Specifications');

-- Add privacy guide article
INSERT INTO kb_articles (
  org_id,
  title,
  content,
  status,
  is_public,
  created_by,
  updated_by
) VALUES (
  (select org_id from profiles limit 1),
  'Delivery Information Guidelines',
  $md$# Delivery Information Guidelines

## When Customers Ask About Personal Information

When customers inquire about providing delivery details:

1. Reassure them about our privacy commitment:
   - Information used only for delivery purposes
   - Data deleted after order completion (upon request)
   - Never shared with third parties
   - Secure storage with limited access

2. Explain necessity for delivery:
   - Required for successful delivery
   - Helps prevent delivery issues
   - Enables delivery status updates
   - Allows direct communication if needed

3. Customer controls:
   - Can request data deletion after delivery
   - Can opt out of future communications
   - Access to their stored information
   - Can update details anytime

Note: Only discuss privacy policies if customers express concerns. Focus first on completing the order and moving the workflow forward.$md$,
  'published',
  true,
  (select id from profiles limit 1),
  (select id from profiles limit 1)
);

-- Link article to delivery information stage
WITH delivery_stage AS (
  SELECT ws.id 
  FROM workflow_stages ws
  JOIN workflows w ON w.id = ws.workflow_id
  WHERE w.name = 'Sales' AND ws.name = 'get delivery information'
),
privacy_article AS (
  SELECT id FROM kb_articles WHERE title = 'Delivery Information Guidelines'
)
INSERT INTO workflow_stage_articles (stage_id, article_id)
SELECT delivery_stage.id, privacy_article.id
FROM delivery_stage, privacy_article;

-- Add On-Site Repair Guide
WITH default_user AS (
  SELECT id as user_id, org_id
  FROM profiles 
  WHERE auth_id = auth.uid()
  LIMIT 1
)
INSERT INTO kb_articles (
  org_id, title, content, status, is_public, created_by, updated_by
) 
SELECT
  org_id,
  'On-Site Repair Guide',
  $md$# On-Site Repair Process Guide

## Preparation
- Schedule 3-4 hour window
- Clear workspace around canoe
- Power source needed
- Good lighting required

## Common Repairs
- Hull cracks
- Gunwale damage
- Seat repairs
- Keel repairs

## Customer Preparation
- Remove personal items
- Clear access path
- Secure pets
- Weather considerations

## What to Expect
- Initial inspection
- Repair process explanation
- Testing and validation
- Final inspection with customer$md$,
  'published',
  true,
  user_id,
  user_id
FROM default_user;

-- Link privacy article to repair workflow's contact stage
WITH contact_stage AS (
  SELECT ws.id 
  FROM workflow_stages ws
  JOIN workflows w ON w.id = ws.workflow_id
  WHERE w.name = 'Canoe Repair' AND ws.name = 'Gather Contact Info'
),
privacy_article AS (
  SELECT id FROM kb_articles WHERE title = 'Delivery Information Guidelines'
)
INSERT INTO workflow_stage_articles (stage_id, article_id)
SELECT contact_stage.id, privacy_article.id
FROM contact_stage, privacy_article;

-- Link on-site repair guide
WITH repair_stage AS (
  SELECT ws.id 
  FROM workflow_stages ws
  JOIN workflows w ON w.id = ws.workflow_id
  WHERE w.name = 'Canoe Repair' AND ws.name = 'On-Site Repair'
),
repair_article AS (
  SELECT id FROM kb_articles WHERE title = 'On-Site Repair Guide'
)
INSERT INTO workflow_stage_articles (stage_id, article_id)
SELECT repair_stage.id, repair_article.id
FROM repair_stage, repair_article;

-- Insert Activity Information workflow stages
WITH info_workflow AS (
  SELECT id FROM workflows WHERE name = 'Canoe Activities' LIMIT 1
)
INSERT INTO workflow_stages (workflow_id, name, description, is_start, is_end, is_other) 
SELECT 
  (SELECT id FROM info_workflow),
  name,
  description,
  is_start,
  is_end,
  false as is_other
FROM (VALUES
  (
    'Initial Interest',
    'Understand customer''s primary interest:
    1. Fishing & Angling
    2. Camping & Expeditions
    3. Adventure & Tourism
    4. General Recreation
    Ask about their experience level with canoes',
    true,
    false
  ),
  (
    'Fishing Setup',
    'Guide for fishing enthusiasts:
    - Discuss stability requirements
    - Explain storage options
    - Cover fishing-specific accessories:
      * Live wells
      * Rod holders
      * Anchor systems
    - Share fishing technique tips',
    false,
    false
  ),
  (
    'Camping Guide',
    'Information for expedition planning:
    - Cargo capacity needs
    - Gear storage solutions
    - Weather protection options
    - Multi-day trip considerations
    - Portage requirements',
    false,
    false
  ),
  (
    'Adventure Planning',
    'Exotic locations and guided trips:
    - Popular destinations
    - Tour packages
    - Local regulations
    - Skill requirements
    - Safety considerations',
    false,
    false
  ),
  (
    'Equipment Selection',
    'Help match needs to equipment:
    1. Canoe size and material
    2. Required accessories
    3. Safety equipment
    4. Storage solutions',
    false,
    false
  ),
  (
    'Schedule Demo',
    'Arrange product demonstration:
    1. Set demo date/time
    2. Choose location
    3. Prepare equipment
    4. Safety briefing scheduling',
    false,
    true
  )
) AS v(name, description, is_start, is_end)
WHERE EXISTS (SELECT 1 FROM info_workflow)  -- Only insert if workflow exists
AND NOT EXISTS (
  SELECT 1 FROM workflow_stages ws 
  WHERE ws.workflow_id = (SELECT id FROM info_workflow)
  AND (ws.name = v.name OR (ws.is_start = true AND v.is_start = true))
);

-- Add knowledge base articles for activities
WITH default_user AS (
  SELECT id as user_id, org_id
  FROM profiles 
  WHERE auth_id = auth.uid()
  LIMIT 1
)
INSERT INTO kb_articles (
  org_id, title, content, status, is_public, created_by, updated_by
) 
SELECT
  org_id,
  'Canoe Fishing Guide',
  $md$# Canoe Fishing Guide...$md$,
  'published',
  true,
  user_id,
  user_id
FROM default_user
WHERE NOT EXISTS (
  SELECT 1 FROM kb_articles ka 
  WHERE ka.title = 'Canoe Fishing Guide'
);

-- Separate CTE for each insert
WITH default_user AS (
  SELECT id as user_id, org_id
  FROM profiles 
  WHERE auth_id = auth.uid()
  LIMIT 1
)
INSERT INTO kb_articles (
  org_id, title, content, status, is_public, created_by, updated_by
) 
SELECT
  org_id,
  'Canoe Camping Guide',
  $md$# Canoe Camping Guide...$md$,
  'published',
  true,
  user_id,
  user_id
FROM default_user
WHERE NOT EXISTS (
  SELECT 1 FROM kb_articles ka 
  WHERE ka.title = 'Canoe Camping Guide'
);

-- Add Adventure Canoeing Guide with CTE
WITH default_user AS (
  SELECT id as user_id, org_id
  FROM profiles 
  WHERE auth_id = auth.uid()
  LIMIT 1
)
INSERT INTO kb_articles (
  org_id, title, content, status, is_public, created_by, updated_by
) 
SELECT
  org_id,
  'Adventure Canoeing Guide',
  $md$# Adventure Canoeing Guide

## Types of Adventures
1. Whitewater Exploration
   - Rapid classifications
   - Safety equipment
   - Technique basics

2. Wilderness Tours
   - Guided options
   - Self-guided planning
   - Group expeditions

3. Nature Photography
   - Best locations
   - Stable platforms
   - Equipment protection

## Popular Destinations
- National Parks
- Remote Lakes
- River Systems
- Coastal Waters

## Safety Considerations
- Skill requirements
- Weather awareness
- Communication devices
- Emergency protocols$md$,
  'published',
  true,
  user_id,
  user_id
FROM default_user
WHERE NOT EXISTS (
  SELECT 1 FROM kb_articles ka 
  WHERE ka.title = 'Adventure Canoeing Guide'
);

-- Update stage connections for Activities workflow
WITH activity_stages AS (
  SELECT id, name, 
    lead(id) OVER (ORDER BY CASE 
      WHEN name = 'Initial Interest' THEN 1
      WHEN name = 'Fishing Setup' THEN 2
      WHEN name = 'Camping Guide' THEN 3
      WHEN name = 'Adventure Planning' THEN 4
      WHEN name = 'Equipment Selection' THEN 5
      WHEN name = 'Schedule Demo' THEN 6
    END) as next_id
  FROM workflow_stages
  WHERE workflow_id = (SELECT id FROM workflows WHERE name = 'Canoe Activities')
)
UPDATE workflow_stages ws1
SET next_stage_id = as1.next_id
FROM activity_stages as1
WHERE ws1.id = as1.id;

-- Link knowledge base articles to stages
WITH activity_stages AS (
  SELECT ws.id, ws.name 
  FROM workflow_stages ws
  JOIN workflows w ON w.id = ws.workflow_id
  WHERE w.name = 'Canoe Activities'
),
articles AS (
  SELECT ka.id, ka.title 
  FROM kb_articles ka
)
INSERT INTO workflow_stage_articles (stage_id, article_id)
SELECT ws.id, a.id
FROM activity_stages ws
CROSS JOIN articles a
WHERE 
  ((ws.name = 'Fishing Setup' AND a.title = 'Canoe Fishing Guide')
  OR (ws.name = 'Camping Guide' AND a.title = 'Canoe Camping Guide')
  OR (ws.name = 'Adventure Planning' AND a.title = 'Adventure Canoeing Guide')
  OR (ws.name = 'Equipment Selection' AND a.title IN ('Canoe Specifications', 'Canoe Pricing Guide')))
  AND NOT EXISTS (
    SELECT 1 FROM workflow_stage_articles wsa 
    WHERE wsa.stage_id = ws.id 
    AND wsa.article_id = a.id
  ); 