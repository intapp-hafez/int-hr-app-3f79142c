
ALTER TABLE public.cities ADD CONSTRAINT cities_name_en_unique UNIQUE (name_en);
ALTER TABLE public.districts ADD CONSTRAINT districts_city_name_en_unique UNIQUE (city_id, name_en);
