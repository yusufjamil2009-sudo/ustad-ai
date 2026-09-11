INSERT INTO public.ustad_shop_items (item_id, name, category, price_coins, description, asset_reference, status, availability, ownership_type, sort_order) VALUES
-- Avatar frames
('frame_bronze','Bronze Ring','avatar_frames',25000,'A simple bronze ring around your avatar.','frame/bronze','active','permanent','permanent',10),
('frame_silver','Silver Ring','avatar_frames',75000,'A polished silver ring around your avatar.','frame/silver','active','permanent','permanent',20),
('frame_gold','Golden Ring','avatar_frames',250000,'A shining golden ring around your avatar.','frame/gold','active','permanent','permanent',30),
('frame_neon','Neon Pulse','avatar_frames',500000,'A glowing neon ring around your avatar.','frame/neon','active','permanent','permanent',40),
('frame_royal','Royal Crown Frame','avatar_frames',1500000,'A royal crowned frame for champions.','frame/royal','active','permanent','permanent',50),
('frame_diamond','Diamond Aura','avatar_frames',5000000,'A brilliant diamond aura around your avatar.','frame/diamond','active','permanent','permanent',60),
-- Profile frames
('pframe_classic','Classic Border','profile_frames',30000,'A clean classic border for your profile card.','pframe/classic','active','permanent','permanent',10),
('pframe_wave','Wave Border','profile_frames',90000,'A soft wave border for your profile card.','pframe/wave','active','permanent','permanent',20),
('pframe_gold','Gold Border','profile_frames',400000,'A luxurious gold border for your profile card.','pframe/gold','active','permanent','permanent',30),
('pframe_legend','Legend Border','profile_frames',2000000,'A legendary animated-look border.','pframe/legend','active','permanent','permanent',40),
-- Profile themes
('ptheme_midnight','Midnight','profile_themes',50000,'A deep midnight background for your profile.','ptheme/midnight','active','permanent','permanent',10),
('ptheme_sunrise','Sunrise','profile_themes',120000,'A warm sunrise gradient background.','ptheme/sunrise','active','permanent','permanent',20),
('ptheme_forest','Forest','profile_themes',200000,'A calm green forest background.','ptheme/forest','active','permanent','permanent',30),
('ptheme_galaxy','Galaxy','profile_themes',800000,'A starry galaxy background.','ptheme/galaxy','active','permanent','permanent',40),
('ptheme_royal','Royal Velvet','profile_themes',2500000,'A rich royal velvet background.','ptheme/royal','active','permanent','permanent',50),
-- Name styles
('name_classic','Classic Name','name_styles',20000,'A classic serif treatment for your name.','name/classic','active','permanent','permanent',10),
('name_bold','Bold Name','name_styles',40000,'A strong bold treatment for your name.','name/bold','active','permanent','permanent',20),
('name_premium','Premium Name','name_styles',150000,'A premium italic treatment for your name.','name/premium','active','permanent','permanent',30),
('name_neon','Neon Name','name_styles',350000,'A glowing neon treatment for your name.','name/neon','active','permanent','permanent',40),
('name_gold','Gold Name','name_styles',900000,'A golden gradient treatment for your name.','name/gold','active','permanent','permanent',50),
('name_diamond','Diamond Name','name_styles',2000000,'An icy diamond gradient for your name.','name/diamond','active','permanent','permanent',60),
('name_legend','Legend Name','name_styles',5000000,'A legendary violet gradient for your name.','name/legend','active','permanent','permanent',70),
-- Badges
('badge_star','Learning Star','badges',15000,'A decorative star badge on your profile.','badge/star','active','permanent','permanent',10),
('badge_quiz','Quiz Master Badge','badges',60000,'A decorative quiz badge. Purely cosmetic.','badge/quiz','active','permanent','permanent',20),
('badge_knowledge','Knowledge Pro Badge','badges',120000,'A decorative books badge.','badge/knowledge','active','permanent','permanent',30),
('badge_top','Top Learner Badge','badges',400000,'A decorative cup badge. Not a tournament award.','badge/top','active','permanent','permanent',40),
('badge_champion','Champion Badge','badges',1200000,'A decorative crown badge.','badge/champion','active','permanent','permanent',50),
('badge_legend','Legend Badge','badges',4000000,'A decorative glowing star badge.','badge/legend','active','permanent','permanent',60),
-- Classroom themes
('ctheme_chalk','Chalk Classroom','classroom_themes',80000,'A traditional chalkboard classroom look.','ctheme/chalk','active','permanent','permanent',10),
('ctheme_modern','Modern Classroom','classroom_themes',200000,'A bright modern classroom look.','ctheme/modern','active','permanent','permanent',20),
('ctheme_night','Night Study','classroom_themes',450000,'A calm dark classroom for night study.','ctheme/night','active','permanent','permanent',30),
('ctheme_space','Space Lab','classroom_themes',1500000,'A space laboratory classroom look.','ctheme/space','active','permanent','permanent',40),
-- Board themes
('btheme_green','Green Board','board_themes',40000,'A classic green board surface.','btheme/green','active','permanent','permanent',10),
('btheme_white','White Board','board_themes',60000,'A clean white board surface.','btheme/white','active','permanent','permanent',20),
('btheme_dark','Dark Slate','board_themes',180000,'A dark slate board surface.','btheme/dark','active','permanent','permanent',30),
('btheme_paper','Notebook Paper','board_themes',300000,'A ruled notebook paper surface.','btheme/paper','active','permanent','permanent',40),
('btheme_glass','Glass Board','board_themes',1000000,'A translucent glass board surface.','btheme/glass','active','permanent','permanent',50),
-- Teacher presentation themes
('ttheme_formal','Formal Ustad','teacher_themes',150000,'A formal presentation look for your teacher. Visual only.','ttheme/formal','active','permanent','permanent',10),
('ttheme_friendly','Friendly Ustad','teacher_themes',300000,'A friendly presentation look. Visual only.','ttheme/friendly','active','permanent','permanent',20),
('ttheme_scholar','Scholar Ustad','teacher_themes',900000,'A scholarly presentation look. Visual only.','ttheme/scholar','active','permanent','permanent',30),
-- Tournament cosmetics
('tcos_confetti','Victory Confetti','tournament_cosmetics',250000,'Decorative confetti on your result screen.','tcos/confetti','active','permanent','permanent',10),
('tcos_flame','Flame Trail','tournament_cosmetics',700000,'A decorative flame trail on your leaderboard row.','tcos/flame','active','permanent','permanent',20),
('tcos_crownfx','Crown Effect','tournament_cosmetics',2000000,'A decorative crown effect on your result screen.','tcos/crownfx','active','permanent','permanent',30),
-- Feature unlocks (customization only)
('unlock_profile_banner','Profile Banner','feature_unlocks',350000,'Unlock a custom banner image on your profile.','unlock/profile_banner','active','permanent','permanent',10),
('unlock_custom_title','Custom Title','feature_unlocks',600000,'Unlock a personal title line under your name.','unlock/custom_title','active','permanent','permanent',20),
('unlock_theme_studio','Theme Studio','feature_unlocks',1500000,'Unlock free mixing of your profile colours.','unlock/theme_studio','active','permanent','permanent',30)
ON CONFLICT (item_id) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  price_coins = EXCLUDED.price_coins,
  description = EXCLUDED.description,
  asset_reference = EXCLUDED.asset_reference,
  status = 'active',
  sort_order = EXCLUDED.sort_order,
  updated_at = now();