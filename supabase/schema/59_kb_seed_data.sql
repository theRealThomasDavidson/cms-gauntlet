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