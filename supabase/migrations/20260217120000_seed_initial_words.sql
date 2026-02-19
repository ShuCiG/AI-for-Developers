-- Seed initial words for phrase generator and words game (only if table is empty)
insert into public.words (word)
select w from (values
  ('hello'), ('world'), ('water'), ('sun'), ('moon'), ('book'), ('house'), ('friend'), ('time'), ('day'),
  ('night'), ('light'), ('dark'), ('good'), ('bad'), ('big'), ('small'), ('new'), ('old'), ('first'),
  ('last'), ('right'), ('left'), ('high'), ('low'), ('hot'), ('cold'), ('fast'), ('slow'), ('open'),
  ('close'), ('start'), ('end'), ('begin'), ('work'), ('play'), ('read'), ('write'), ('speak'), ('listen'),
  ('think'), ('know'), ('want'), ('need'), ('like'), ('love'), ('live'), ('come'), ('go'), ('see'),
  ('look'), ('find'), ('give'), ('take'), ('make'), ('use'), ('try'), ('ask'), ('answer'), ('help'),
  ('walk'), ('run'), ('sit'), ('stand'), ('eat'), ('drink'), ('sleep'), ('wake'), ('learn'), ('teach'),
  ('rain'), ('snow'), ('wind'), ('tree'), ('flower'), ('bird'), ('dog'), ('cat'), ('fish'), ('food'),
  ('door'), ('window'), ('table'), ('chair'), ('room'), ('city'), ('country'), ('people'), ('child'), ('family')
) as t(w)
where not exists (select 1 from public.words limit 1);
