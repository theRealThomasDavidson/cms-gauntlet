-- Insert Repair workflow stages
WITH repair_stages AS (
  INSERT INTO workflow_stages (workflow_id, name, description, is_start, is_end, is_other) 
  VALUES
    (
      (SELECT id FROM workflows WHERE name = 'Canoe Repair' LIMIT 1),
      'New Ticket',
      'Initial repair request received:
      1. Customer name and contact info
      2. Canoe model/serial number
      3. Brief description of issue',
      true,
      false,
      false
    )
  RETURNING id
),
triage AS (
  INSERT INTO workflow_stages (workflow_id, name, description, is_start, is_end, is_other) 
  VALUES
    (
      (SELECT id FROM workflows WHERE name = 'Canoe Repair' LIMIT 1),
      'Triage Damage',
      'Evaluate damage severity and choose ONE repair path:
      1. Small holes (< 2 inches) → Choose "Software Patch"
         - Clean edges, no structural damage
         - Accessible location
         - Customer comfortable with DIY repair

      2. Medium damage → Choose "On-Site Repair"
         - Hull cracks or dents
         - Seat or gunwale damage
         - Requires professional tools

      3. Severe damage → Choose "Process Replacement"
         - Multiple damage points
         - Structural compromise
         - Cost of repair near replacement',
      false,
      false,
      false
    )
  RETURNING id
),
complete AS (
  INSERT INTO workflow_stages (workflow_id, name, description, is_start, is_end, is_other) 
  VALUES
    (
      (SELECT id FROM workflows WHERE name = 'Canoe Repair' LIMIT 1),
      'Complete',
      'Finalize repair process...',
      false,
      true,
      false
    )
  RETURNING id
)
UPDATE workflow_stages 
SET next_stage_id = CASE 
  WHEN id IN (SELECT id FROM repair_stages) THEN (SELECT id FROM triage)
  WHEN id IN (SELECT id FROM triage) THEN (SELECT id FROM complete)
END
WHERE id IN (SELECT id FROM repair_stages) 
   OR id IN (SELECT id FROM triage);

-- Insert Activities workflow stages in order
WITH interest AS (
  INSERT INTO workflow_stages (workflow_id, name, description, is_start, is_end, is_other) 
  VALUES
    (
      (SELECT id FROM workflows WHERE name = 'Canoe Activities' LIMIT 1),
      'Initial Interest',
      'Understand customer''s primary interest:
      1. Fishing & Angling
      2. Camping & Expeditions
      3. Adventure & Tourism
      4. General Recreation
      Ask about their experience level with canoes',
      true,
      false,
      false
    )
  RETURNING id
),
activities AS (
  INSERT INTO workflow_stages (workflow_id, name, description, is_start, is_end, is_other) 
  VALUES
    (
      (SELECT id FROM workflows WHERE name = 'Canoe Activities' LIMIT 1),
      'Equipment Selection',
      'Help match needs to equipment:
      1. Canoe size and material
      2. Required accessories
      3. Safety equipment
      4. Storage solutions',
      false,
      false,
      false
    ),
    (
      (SELECT id FROM workflows WHERE name = 'Canoe Activities' LIMIT 1),
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
      false,
      false
    ),
    (
      (SELECT id FROM workflows WHERE name = 'Canoe Activities' LIMIT 1),
      'Camping Guide',
      'Information for expedition planning:
      - Cargo capacity needs
      - Gear storage solutions
      - Weather protection options
      - Multi-day trip considerations
      - Portage requirements',
      false,
      false,
      false
    ),
    (
      (SELECT id FROM workflows WHERE name = 'Canoe Activities' LIMIT 1),
      'Adventure Planning',
      'Exotic locations and guided trips:
      - Popular destinations
      - Tour packages
      - Local regulations
      - Skill requirements
      - Safety considerations',
      false,
      false,
      false
    )
  RETURNING id
),
demo AS (
  INSERT INTO workflow_stages (workflow_id, name, description, is_start, is_end, is_other) 
  VALUES
    (
      (SELECT id FROM workflows WHERE name = 'Canoe Activities' LIMIT 1),
      'Schedule Demo',
      'Arrange product demonstration:
      1. Set demo date/time
      2. Choose location
      3. Prepare equipment
      4. Safety briefing scheduling',
      false,
      true,
      false
    )
  RETURNING id
)
UPDATE workflow_stages 
SET next_stage_id = CASE 
  WHEN id IN (SELECT id FROM interest) THEN (SELECT id FROM activities)
  WHEN id IN (SELECT id FROM activities) THEN (SELECT id FROM demo)
END
WHERE id IN (SELECT id FROM interest) 
   OR id IN (SELECT id FROM activities); 