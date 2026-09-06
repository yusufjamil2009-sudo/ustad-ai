UPDATE public.crorepati_events
SET open_hour = 3,
    open_minute = 0,
    window_minutes = 1200,
    schedule_weekdays = '[0,2,5]'::jsonb
WHERE code = 'kbc-default';

DELETE FROM public.crorepati_event_occurrences o
USING public.crorepati_events e
WHERE o.event_id = e.id
  AND e.code = 'kbc-default'
  AND o.closed_at > now()
  AND EXTRACT(HOUR FROM (o.opened_at AT TIME ZONE 'Asia/Kolkata')) <> 3;

DELETE FROM public.crorepati_rewards r
USING public.crorepati_events e
WHERE r.event_id = e.id AND e.code = 'kbc-default';

INSERT INTO public.crorepati_rewards (event_id, question_number, coins)
SELECT e.id, v.qn, v.coins
FROM public.crorepati_events e,
     (VALUES
       (1,20000),(2,40000),(3,60000),(4,80000),(5,100000),
       (6,200000),(7,300000),(8,500000),(9,750000),(10,1000000),
       (11,1500000),(12,2500000),(13,5000000),(14,7500000),(15,10000000),
       (16,15000000),(17,25000000),(18,50000000),(19,75000000),(20,100000000)
     ) AS v(qn, coins)
WHERE e.code = 'kbc-default';