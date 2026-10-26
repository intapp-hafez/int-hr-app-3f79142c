-- Migration: Renumber department codes sequentially starting from 100
-- This ensures clean, sequential codes: 100, 101, 102, ... 134

UPDATE public.departments SET code = '100' WHERE id = '89766705-b007-40ea-b2e9-121d0425f3ef'; -- Executive Management
UPDATE public.departments SET code = '101' WHERE id = '39b16f78-900d-4514-a110-3da8e33d4cb6'; -- Executive Office
UPDATE public.departments SET code = '102' WHERE id = 'c92e9a6e-11cc-46dc-b0ac-51c8d54d7636'; -- Human Resources
UPDATE public.departments SET code = '103' WHERE id = '2f868d2e-333b-4fda-acf2-449970dded46'; -- Administrative
UPDATE public.departments SET code = '104' WHERE id = '764b9da4-9f0b-4651-86a7-bbc53c24ca72'; -- Finance
UPDATE public.departments SET code = '105' WHERE id = 'fcd811e0-6f55-4248-a059-598b2782147a'; -- Logistic & Supply Chain
UPDATE public.departments SET code = '106' WHERE id = 'cbe92301-277a-4d51-8366-bb2b7a9004b1'; -- Sales
UPDATE public.departments SET code = '107' WHERE id = '72f8b347-f0e5-4617-a192-83588782bf65'; -- Technical
UPDATE public.departments SET code = '108' WHERE id = 'f8489813-6a48-45c0-81c2-7c8650086f7c'; -- Engineering
UPDATE public.departments SET code = '109' WHERE id = 'ed7149db-9dd7-45fa-9891-ed6eef9a5d9b'; -- Implementation & Maintenance
UPDATE public.departments SET code = '110' WHERE id = '6a4c44bc-9434-4924-8dd1-499317d1593c'; -- Pre-Sales
UPDATE public.departments SET code = '111' WHERE id = 'e575dda1-fbba-4ce1-8790-b07e56151330'; -- Project Management
UPDATE public.departments SET code = '112' WHERE id = '748b365c-b033-402e-9aee-23f207f436f8'; -- Infrastructure (IT)
UPDATE public.departments SET code = '113' WHERE id = 'c8aeb37b-b03c-4e13-9064-01e3cee366d9'; -- FM
UPDATE public.departments SET code = '114' WHERE id = '2c325cb4-e040-4d15-945a-d2f96df56e80'; -- Odoo
UPDATE public.departments SET code = '115' WHERE id = 'aaa56322-dfa7-4bdf-9c90-54c5743b91ee'; -- Network & Cyber Security
UPDATE public.departments SET code = '116' WHERE id = '16bc1d0b-d215-4b1a-8263-f9316f3aa301'; -- Business Development
UPDATE public.departments SET code = '117' WHERE id = '23bdbca2-afa5-41d8-b30e-4da115f3d730'; -- Warehouse
UPDATE public.departments SET code = '118' WHERE id = '9e205f4f-ee0e-4125-b498-c83144a18128'; -- Maintenance Management
UPDATE public.departments SET code = '119' WHERE id = '3eb4dc00-3230-4bc4-a7c0-2a28ce4272b6'; -- X-Ray
UPDATE public.departments SET code = '120' WHERE id = '4f0260c9-6638-4cbb-aa8c-51cfec1157c2'; -- AV
UPDATE public.departments SET code = '121' WHERE id = '67ae0ecd-30ff-40a2-b778-3fc74753c4f9'; -- Project Management
UPDATE public.departments SET code = '122' WHERE id = '6a463483-68f4-482e-85a2-1025c0022595'; -- Administration
UPDATE public.departments SET code = '123' WHERE id = 'dd2c87a7-07a6-4dab-ae1c-e4c6b844c479'; -- 0.05
UPDATE public.departments SET code = '124' WHERE id = 'ed34072d-9c39-4509-a3dd-d84ff303a7dd'; -- Catering Management
UPDATE public.departments SET code = '125' WHERE id = 'bd395de3-8007-4aa9-bcf7-805054e7f78a'; -- Fleet
UPDATE public.departments SET code = '126' WHERE id = 'c52ba746-6bd4-43b5-ba7c-2f097a0aa758'; -- Pre-Sales Light Current
UPDATE public.departments SET code = '127' WHERE id = '9438cf12-a94e-45e2-8710-61c960f28b28'; -- HR
UPDATE public.departments SET code = '128' WHERE id = 'c6e93288-e374-4257-8aa5-3b413b86fd97'; -- ذوي الاحتياجات
UPDATE public.departments SET code = '129' WHERE id = 'e9ab1381-86be-47a7-af2b-586435712246'; -- Transmission department
UPDATE public.departments SET code = '130' WHERE id = '45d074c6-95a2-4f45-9b03-53dcab0efaf2'; -- procurement
UPDATE public.departments SET code = '131' WHERE id = '32e7f9b4-fd0b-4a00-bdb6-876f47d152ed'; -- pre-Sales Light Current
UPDATE public.departments SET code = '132' WHERE id = '8075e9e4-c79b-4d0e-8e50-c7f56b396488'; -- pre-Sales Light Current
UPDATE public.departments SET code = '133' WHERE id = 'a0ef874d-f1b3-46cb-9b92-aab17f14a8bd'; -- Pre-Sales Light Current
UPDATE public.departments SET code = '134' WHERE id = '1807db73-52bd-4876-921d-06b5048fc2b3'; -- logistics
