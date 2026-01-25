-- Seed Test Data for PressClipper
-- Run this in Supabase SQL Editor after creating a client

-- First, get your client and org IDs
-- Replace the VALUES below with your actual IDs from:
-- SELECT c.id as client_id, c.org_id, c.name FROM clients c;

DO $$
DECLARE
  v_client_id UUID;
  v_org_id UUID;
BEGIN
  -- Get the first client (modify if you have multiple)
  SELECT id, org_id INTO v_client_id, v_org_id FROM clients LIMIT 1;
  
  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'No clients found. Create a client first.';
  END IF;

  -- Insert sample articles
  INSERT INTO articles (org_id, client_id, canonical_url, url, title, outlet, published_at, snippet, summary, relevance_score, importance_score, labels)
  VALUES
    (v_org_id, v_client_id, 
     'https://techcrunch.com/2024/01/15/startup-raises-50m',
     'https://techcrunch.com/2024/01/15/startup-raises-50m',
     'Tech Startup Raises $50M in Series B Funding Round',
     'TechCrunch',
     NOW() - INTERVAL '2 hours',
     'The company announced today that it has secured $50 million in Series B funding, led by prominent venture capital firms...',
     'Major funding announcement positions the startup for rapid expansion into new markets.',
     85, 90,
     '["funding", "series b", "venture capital"]'::jsonb),
     
    (v_org_id, v_client_id,
     'https://reuters.com/business/company-expansion-europe',
     'https://reuters.com/business/company-expansion-europe',
     'Company Announces Major European Expansion Plans',
     'Reuters',
     NOW() - INTERVAL '5 hours',
     'In a strategic move to capture the European market, the company revealed plans to open offices in London, Berlin, and Paris...',
     'International expansion strategy targets key European markets with new regional headquarters.',
     78, 85,
     '["expansion", "europe", "international"]'::jsonb),
     
    (v_org_id, v_client_id,
     'https://forbes.com/innovation-award-winner',
     'https://forbes.com/innovation-award-winner',
     'Forbes Names Company as Top Innovator of 2024',
     'Forbes',
     NOW() - INTERVAL '1 day',
     'The prestigious recognition highlights the company''s breakthrough technology and market disruption...',
     'Award recognition boosts brand visibility and validates technology leadership position.',
     92, 75,
     '["award", "innovation", "recognition"]'::jsonb),
     
    (v_org_id, v_client_id,
     'https://wsj.com/tech-partnership-announcement',
     'https://wsj.com/tech-partnership-announcement',
     'Strategic Partnership Formed with Industry Giant',
     'Wall Street Journal',
     NOW() - INTERVAL '2 days',
     'The partnership will combine resources and expertise to accelerate product development and market reach...',
     'Strategic alliance opens new distribution channels and technology collaboration opportunities.',
     88, 82,
     '["partnership", "strategy", "collaboration"]'::jsonb),
     
    (v_org_id, v_client_id,
     'https://bloomberg.com/quarterly-earnings-beat',
     'https://bloomberg.com/quarterly-earnings-beat',
     'Company Beats Q4 Earnings Expectations by 15%',
     'Bloomberg',
     NOW() - INTERVAL '3 days',
     'Revenue growth exceeded analyst predictions, driven by strong demand in core markets and successful product launches...',
     'Strong financial performance signals healthy business momentum and investor confidence.',
     95, 88,
     '["earnings", "financial", "growth"]'::jsonb),
     
    (v_org_id, v_client_id,
     'https://theverge.com/new-product-launch',
     'https://theverge.com/new-product-launch',
     'Exclusive: First Look at the Revolutionary New Product',
     'The Verge',
     NOW() - INTERVAL '4 days',
     'Our hands-on review reveals a game-changing device that could reshape the industry...',
     'Product launch generates significant media buzz and positive early reviews.',
     72, 68,
     '["product launch", "review", "technology"]'::jsonb),
     
    (v_org_id, v_client_id,
     'https://cnbc.com/ceo-interview-vision',
     'https://cnbc.com/ceo-interview-vision',
     'CEO Shares Bold Vision for Company''s Future',
     'CNBC',
     NOW() - INTERVAL '5 days',
     'In an exclusive interview, the CEO outlined ambitious plans for the next decade, including AI integration and sustainability initiatives...',
     'Leadership visibility reinforces company narrative and future growth strategy.',
     65, 70,
     '["ceo", "interview", "leadership"]'::jsonb),
     
    (v_org_id, v_client_id,
     'https://wired.com/sustainability-commitment',
     'https://wired.com/sustainability-commitment',
     'Company Pledges Carbon Neutrality by 2030',
     'Wired',
     NOW() - INTERVAL '6 days',
     'The ambitious environmental commitment includes transitioning to renewable energy and offsetting remaining emissions...',
     'Sustainability initiative aligns with ESG trends and stakeholder expectations.',
     58, 55,
     '["sustainability", "esg", "environment"]'::jsonb),
     
    (v_org_id, v_client_id,
     'https://ft.com/market-analysis-growth',
     'https://ft.com/market-analysis-growth',
     'Analysts Predict Strong Growth Trajectory',
     'Financial Times',
     NOW() - INTERVAL '7 days',
     'Market analysts have upgraded their outlook, citing strong fundamentals and favorable market conditions...',
     'Positive analyst coverage supports stock performance and investor sentiment.',
     82, 78,
     '["analysis", "market", "growth"]'::jsonb),
     
    (v_org_id, v_client_id,
     'https://nytimes.com/industry-disruption',
     'https://nytimes.com/industry-disruption',
     'How One Company is Reshaping an Entire Industry',
     'New York Times',
     NOW() - INTERVAL '10 days',
     'A deep dive into the strategies and innovations driving unprecedented change in a traditional sector...',
     'Feature coverage positions company as industry thought leader and innovator.',
     75, 80,
     '["feature", "disruption", "industry"]'::jsonb);

  RAISE NOTICE 'Successfully inserted 10 test articles for client %', v_client_id;
END $$;
