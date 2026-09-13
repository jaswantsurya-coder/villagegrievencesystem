-- ============================================================================
-- GramSeva â€” Seed & Fixture Data for Development & Staging
-- All coordinates use standard WGS84 GeoJSON / SRID 4326 PostGIS geometries
-- ============================================================================

-- 1. Insert Core Test Villages (Idempotent)
INSERT INTO public.villages (id, village_name, district, state, pin_code)
VALUES
  (101, 'Kothaguda', 'Rangareddy', 'Telangana', '500084'),
  (102, 'Madhapur', 'Rangareddy', 'Telangana', '500081'),
  (103, 'Gachibowli', 'Rangareddy', 'Telangana', '500032')
ON CONFLICT (id) DO UPDATE 
SET 
  village_name = EXCLUDED.village_name,
  district = EXCLUDED.district,
  state = EXCLUDED.state,
  pin_code = EXCLUDED.pin_code;

-- 2. Insert Village Boundaries (SRID 4326 Polygon Geometry)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'village_boundaries'
  ) THEN
    -- Kothaguda Boundary
    INSERT INTO public.village_boundaries (village_id, boundary)
    VALUES (
      101,
      ST_SetSRID(
        ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[78.360,17.450],[78.380,17.450],[78.380,17.470],[78.360,17.470],[78.360,17.450]]]}'),
        4326
      )
    )
    ON CONFLICT (village_id) DO NOTHING;

    -- Madhapur Boundary
    INSERT INTO public.village_boundaries (village_id, boundary)
    VALUES (
      102,
      ST_SetSRID(
        ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[78.380,17.430],[78.400,17.430],[78.400,17.450],[78.380,17.450],[78.380,17.430]]]}'),
        4326
      )
    )
    ON CONFLICT (village_id) DO NOTHING;

    -- Gachibowli Boundary
    INSERT INTO public.village_boundaries (village_id, boundary)
    VALUES (
      103,
      ST_SetSRID(
        ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[78.340,17.430],[78.360,17.430],[78.360,17.450],[78.340,17.450],[78.340,17.430]]]}'),
        4326
      )
    )
    ON CONFLICT (village_id) DO NOTHING;
  END IF;
END $$;

-- 3. Default Platform Settings (Idempotent)
INSERT INTO public.platform_settings (key, value, description)
VALUES 
  ('maintenance_mode', 'false'::jsonb, 'Global platform maintenance toggle'),
  ('max_photos_per_complaint', '3'::jsonb, 'Maximum photo evidence attachments allowed per complaint'),
  ('complaint_sla_days', '7'::jsonb, 'Default SLA target days before automatic stale complaint escalation')
ON CONFLICT (key) DO NOTHING;
