-- ---------------------------------------------------------------------------
-- More saved searches: every kind of job, not only engineering.
--
-- The first ten queries were all tech, which is a fine place to start and a
-- bad place to stop — the site's audience includes designers, analysts, sales,
-- HR and finance, and none of them were being served.
--
-- Read the budget before adding more. Each query costs one request; the free
-- tier is 200 a month, and the run spends JSEARCH_QUERIES_PER_RUN per night
-- (six by default). With 30 queries at six a night, each one runs every five
-- days. That is the trade: more queries buy breadth and cost freshness, until
-- the plan is raised.
-- ---------------------------------------------------------------------------

insert into public.job_sources (provider, token, company_name, search_query, search_country) values
  -- engineering, wider
  ('jsearch', 'q-fullstack-in',  'Full stack · India',      'full stack developer in India',              'in'),
  ('jsearch', 'q-mobile-in',     'Mobile · India',          'android ios developer in India',             'in'),
  ('jsearch', 'q-devops-in',     'DevOps · India',          'devops engineer in India',                   'in'),
  ('jsearch', 'q-qa-in',         'QA · India',              'qa automation engineer in India',            'in'),
  ('jsearch', 'q-ml-in',         'ML · India',              'machine learning engineer in India',         'in'),

  -- data and product
  ('jsearch', 'q-datasci-in',    'Data science · India',    'data scientist in India',                    'in'),
  ('jsearch', 'q-analyst-in',    'Business analyst · India','business analyst in India',                  'in'),
  ('jsearch', 'q-pm-blr',        'Product · Bengaluru',     'product manager in Bengaluru India',         'in'),

  -- design and content
  ('jsearch', 'q-uiux-in',       'UI/UX · India',           'ui ux designer in India',                    'in'),
  ('jsearch', 'q-graphic-in',    'Graphic design · India',  'graphic designer in India',                  'in'),
  ('jsearch', 'q-content-in',    'Content · India',         'content writer in India',                    'in'),

  -- go to market
  ('jsearch', 'q-sales-in',      'Sales · India',           'business development sales executive in India','in'),
  ('jsearch', 'q-marketing-in',  'Marketing · India',       'digital marketing manager in India',         'in'),
  ('jsearch', 'q-success-in',    'Customer success · India','customer success manager in India',          'in'),

  -- operations and back office
  ('jsearch', 'q-hr-in',         'HR · India',              'human resources recruiter in India',         'in'),
  ('jsearch', 'q-finance-in',    'Finance · India',         'financial analyst accountant in India',      'in'),
  ('jsearch', 'q-ops-in',        'Operations · India',      'operations manager in India',                'in'),
  ('jsearch', 'q-support-in',    'Support · India',         'customer support executive in India',        'in'),

  -- entry level and remote, which cut across every function
  ('jsearch', 'q-intern-in',     'Internships · India',     'internship in India',                        'in'),
  ('jsearch', 'q-remote-in',     'Remote · India',          'remote jobs in India',                       'in')
on conflict (provider, token) do nothing;
