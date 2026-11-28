/* Editorial Weekly Rescue editions kept in the repository.
 *
 * The weekly publisher Worker stores its reports in Cloudflare KV. This file is
 * the reviewed, version-controlled layer on top of it:
 *  - an entry with the same date as a Worker report REPLACES it (editorial fix);
 *  - an entry for a date the Worker missed is ADDED as a labeled backfill.
 * The Pages Functions merge both sources (see weekly-rescue-archive.js), so every
 * report is listed in /rescues even if KV is unavailable.
 *
 * Every card fact below was checked against Scryfall's API (name, Oracle text,
 * color identity, Commander legality) before publication (Abigale on 2026-11-27,
 * the others on 2026-11-21, Central time).
 */
const sf=(set,num,slug)=>`https://scryfall.com/card/${set}/${num}/${slug}`;

const KRUPHIX={
 version:2,date:'2026-11-20',createdAt:'2026-11-20T16:16:01.897Z',revisedAt:'2026-11-22T03:30:00.000Z',
 commander:{name:'Kruphix, God of Horizons',identity:['G','U'],
  oracle:"Indestructible As long as your devotion to green and blue is less than seven, Kruphix isn't a creature. You have no maximum hand size. If you would lose unspent mana, that mana becomes colorless instead.",
  scryfall:sf('jou',152,'kruphix-god-of-horizons'),edhrecCardUseRank:4919,
  imageUrl:'https://cards.scryfall.io/normal/front/2/7/27427233-da58-45af-ade8-e0727929efaa.jpg?1783939404'},
 theme:'Mana Bank Eldrazi',
 usualBuild:'Approximate: Simic ramp and big-hand card draw',
 hook:"Kruphix lets unspent mana roll over as colorless. Bank it across turns, then cash it in for Eldrazi with colorless costs and X spells nobody saw coming.",
 selectionReason:"Most Kruphix decks treat the god as a hand-size enchantment with a ramp package. Its last line is rarer: mana you would lose becomes colorless and stays, which is exactly what {C}-cost Eldrazi want.",
 sections:{
  headline:"Kruphix saves every mana you don't spend. Spend it on Eldrazi.",
  diagnosis:"Kruphix, God of Horizons usually gets built as a ramp deck that happens to have no maximum hand size. That undersells its last line: if you would lose unspent mana, it becomes colorless instead. Mana normally empties at the end of every step and phase. With Kruphix out, it turns colorless and stays in your pool, turn after turn. The god is a savings account, and colorless is the currency.",
  prescription:"Build around payoffs that want a lot of colorless mana. Kozilek, the Great Distortion needs {C}{C} specifically, and banked Kruphix mana pays it. Ulamog, the Ceaseless Hunger is ten generic mana you can save over two or three turns. Thought-Knot Seer is an early {C} payoff. Nykthos, Shrine to Nyx, Mana Reflection and Zendikar Resurgent make big piles of mana to bank, while Stroke of Genius and Hydroid Krasis turn whatever is left over into cards.",
  earlyGame:"Ramp toward Kruphix's five mana, favoring permanents with green and blue pips: they count toward Nykthos and toward Kruphix's devotion. Once Kruphix lands, stop wasting mana. Tap your lands at the end of the turn right before yours. The mana banks as colorless, your lands untap as normal, and you start your turn with extra mana.",
  midGame:"Use the bank to make big plays look small. Thought-Knot Seer can come down early with mana to spare. Nykthos turns devotion into a burst of green or blue mana that becomes colorless and waits for Kozilek. Cast Stroke of Genius at the end of an opponent's turn with whatever you don't need.",
  lateGame:"Cash out. Ulamog exiles two permanents when you cast it, and Kozilek refills your hand to seven when cast, giving it cards to discard for its counter ability. Mana Reflection doubles every deposit. Once your devotion to green and blue reaches seven, Kruphix becomes an indestructible 4/7 creature and joins the attack.",
  risks:"A big stash of colorless mana is visible to everyone and tells the table when you are about to strike. Colorless mana can't pay colored costs, so keep green and blue sources available for your colored spells. Kruphix is indestructible but can still be exiled or bounced, and losing it mid-save empties the bank at the end of the next step. Eldrazi and Mana Reflection are expensive to get started.",
  verdict:"A real alternative to the usual Kruphix ramp pile: same colors, very different play pattern. Banking mana between turns rewards patience, and colorless Eldrazi give the deck a clear finish. It needs testing before we'd call it a list, but it's a strategy only Kruphix can run."
 },
 synergies:[
  {name:'Kozilek, the Great Distortion',url:sf('cmm',2,'kozilek-the-great-distortion'),why:"Its cost includes {C}{C}, which banked Kruphix mana pays every time. The cast trigger refills your hand to seven, giving Kozilek plenty of cards to discard for its counter ability."},
  {name:'Ulamog, the Ceaseless Hunger',url:sf('cmm',5,'ulamog-the-ceaseless-hunger'),why:"Ten generic mana is a lot for one turn but easy to save over two or three. The cast trigger exiles two permanents even if Ulamog is answered afterward."},
  {name:'Nykthos, Shrine to Nyx',url:sf('ths',223,'nykthos-shrine-to-nyx'),why:"Turns your green or blue devotion (Kruphix itself counts for one of each) into a burst of mana. Whatever you don't spend becomes colorless and stays banked."},
  {name:'Mana Reflection',url:sf('2xm',175,'mana-reflection'),why:"Doubles the mana from every permanent you tap for mana, so each deposit into the Kruphix bank is twice as large."},
  {name:'Zendikar Resurgent',url:sf('c17',160,'zendikar-resurgent'),why:"Adds an extra mana whenever you tap a land for mana and draws a card for each creature spell you cast, keeping both the bank and your hand full."},
  {name:'Thought-Knot Seer',url:sf('ogw',9,'thought-knot-seer'),why:"An early {C} payoff. Leftover banked mana becomes a look at an opponent's hand and exile of their best nonland card."},
  {name:'Stroke of Genius',url:sf('soc',203,'stroke-of-genius'),why:"An instant X draw spell. At the end of the turn before yours, pour the bank into X, and Kruphix's no maximum hand size lets you keep every card."},
  {name:'Hydroid Krasis',url:sf('soc',315,'hydroid-krasis'),why:"Banked colorless mana can pay X. A big Krasis draws half X, gains half X life, and its {G}{U} pips add to Kruphix's devotion."}
 ],
 methodology:'Editorially revised on November 21, 2026. The original automated draft misdescribed several cards, so the strategy and card notes were rewritten and every card was rechecked against Scryfall (Oracle text, color identity and Commander legality). Strategy interactions are editorial hypotheses, not playtested or judge-certified.',
 status:'AI-assisted, source-checked and editorially revised; not independently playtested'
};

const ABIGALE={
 version:2,date:'2026-11-27',createdAt:'2026-11-27T16:46:00.000Z',revisedAt:'2026-11-27T18:00:00.000Z',
 commander:{name:'Abigale, Eloquent First-Year',identity:['B','W'],
  oracle:'Flying, first strike, lifelink When Abigale enters, up to one other target creature loses all abilities. Put a flying counter, a first strike counter, and a lifelink counter on that creature.',
  scryfall:sf('ecl',204,'abigale-eloquent-first-year'),edhrecCardUseRank:8003,
  imageUrl:'https://cards.scryfall.io/normal/front/b/f/bf708169-a307-494b-b8d8-baae53b2e2f2.jpg?1783904418'},
 theme:'Drawback Surgery',
 usualBuild:'Approximate: Orzhov lifelink and keyword counters',
 hook:"Abigale's enter trigger erases every ability a creature has, including its drawbacks. Point it at your own oversized monsters with terrible downsides and keep the body.",
 selectionReason:"Most Abigale lists treat the trigger as removal or a small buff. Pointed at your own creatures, it deletes upkeep costs and sacrifice clauses, and Black has plenty of huge bodies held back only by their drawbacks.",
 sections:{
  headline:'Abigale cuts the drawbacks off your biggest monsters',
  diagnosis:"When Abigale, Eloquent First-Year enters, up to one other target creature loses all abilities, then gets a flying, a first strike and a lifelink counter. People usually aim that at an opponent's best creature. Aimed at your own creature, it is surgery. A creature built with a painful drawback loses the drawback, keeps its stats, and gains three keywords. Abigale costs two mana, so you can recast her from the command zone again and again.",
  prescription:"Fill the deck with creatures that are far too big for their mana cost because of a drawback. Phyrexian Negator is a 5/5 for three that makes you sacrifice permanents when it takes damage. Grinning Demon is a 6/6 for four that drains you every upkeep. Lord of the Pit is a 7/7 that eats a creature every upkeep. Colossus of Sardia is a 9/9 that never untaps on its own. Ephemerate and Restoration Angel flicker Abigale for another operation, and The Ozolith saves the keyword counters when a patient dies.",
  earlyGame:"Play a drawback creature first and Abigale second: her trigger only hits creatures already on the battlefield. Phyrexian Negator on turn three, then Abigale on turn four, gives you a 5/5 flying, first strike, lifelink attacker that no longer forces sacrifices. Ajani's Pridemate is a fine early play that grows with every lifelink hit.",
  midGame:"Line up one surgery per turn. Grinning Demon and Lord of the Pit should be operated on before your next upkeep, so hold Abigale or a flicker spell for the turn they land. Ephemerate on Abigale gives you a trigger now and another from rebound next upkeep. Restoration Angel does the same at instant speed, and it blocks as a 3/4 flyer.",
  lateGame:"Colossus of Sardia is the big finish: a 9/9 that, after surgery, untaps normally and attacks in the air with first strike and lifelink. If an opponent kills one of your patients, The Ozolith collects its counters and moves them onto another creature at the beginning of combat on your turn. That creature keeps its own abilities and gains the three keywords.",
  risks:"Every patient is dangerous until Abigale reaches it. An unoperated Lord of the Pit can eat your board, and Phyrexian Negator can cost you lands if it takes damage first. Flickering a patient resets it: it comes back with its drawback and without its counters. Board wipes and exile hit hard, and Abigale herself is a 1/1 that removal handles easily.",
  verdict:"A real alternative to a generic Orzhov lifelink deck. It plays big, cheap, flying lifelinkers that no other commander can safely run, and the sequencing puzzle is fun. It's untested, and the deck is fragile when Abigale is answered early, but the ceiling is high for a two-mana commander."
 },
 synergies:[
  {name:'Phyrexian Negator',url:sf('dde',1,'phyrexian-negator'),why:"A 5/5 trampler for three. Its drawback is sacrificing a permanent for each point of damage it takes. After surgery it's a 5/5 flying, first strike, lifelink creature with no drawback (it loses trample)."},
  {name:'Grinning Demon',url:sf('ons',153,'grinning-demon'),why:"A 6/6 for four that makes you lose 2 life every upkeep. Abigale removes the upkeep trigger, and the lifelink counter turns it into a life gain engine."},
  {name:'Lord of the Pit',url:sf('ima',96,'lord-of-the-pit'),why:"A 7/7 that makes you sacrifice another creature every upkeep or take 7 damage. Abigale removes that upkeep trigger. It loses trample, and the counter gives back flying."},
  {name:'Colossus of Sardia',url:sf('me4',193,'colossus-of-sardia'),why:"A colorless 9/9 that doesn't untap during your untap step. Once it has lost all abilities, it untaps normally, and the counters make it a 9/9 lifelinking flyer."},
  {name:'The Ozolith',url:sf('iko',237,'the-ozolith'),why:"When a creature you control with counters leaves the battlefield, The Ozolith keeps those counters. At the beginning of combat on your turn, you can move them onto another creature."},
  {name:'Ephemerate',url:sf('mh1',7,'ephemerate'),why:"One white mana to flicker Abigale for a fresh enter trigger. Rebound lets you cast it again for free on your next upkeep, for a second operation."},
  {name:'Restoration Angel',url:sf('inr',38,'restoration-angel'),why:"A flash flyer that can flicker Abigale, a non-Angel, at instant speed. Use it at the end of an opponent's turn to fix a creature you just played."},
  {name:"Ajani's Pridemate",url:sf('fdn',135,'ajanis-pridemate'),why:"Gets a +1/+1 counter whenever you gain life. With Abigale and every patient carrying lifelink, it grows whenever they deal damage."}
 ],
 methodology:'Editorially revised on November 27, 2026. The automated draft picked weak support cards, including Steel Golem, which stops you from casting creature spells, so the strategy and card notes were rewritten, and every card was checked against Scryfall (Oracle text, color identity and Commander legality). Strategy interactions are editorial hypotheses, not playtested or judge-certified.',
 status:'AI-assisted, source-checked and editorially revised; not independently playtested'
};

const NYMRIS={
 version:2,date:'2026-11-06',createdAt:'2026-11-22T03:30:00.000Z',
 commander:{name:"Nymris, Oona's Trickster",identity:['B','U'],
  oracle:"Flash Flying Whenever you cast your first spell during each opponent's turn, look at the top two cards of your library. Put one of those cards into your hand and the other into your graveyard.",
  scryfall:sf('cmr',288,'nymris-oonas-trickster'),edhrecCardUseRank:5757,
  imageUrl:'https://cards.scryfall.io/normal/front/b/8/b8cfc97a-3c8a-4d44-846b-7a523dc11878.jpg?1783928768'},
 theme:'Instant Recursion on Their Turn',
 usualBuild:'Approximate: Dimir flash and Faeries',
 hook:"Nymris rewards your first spell on each opponent's turn. Build around the card it puts in your graveyard, and every instant you lose comes back for a second cast.",
 selectionReason:"Nymris decks tend to stop at 'play flash creatures.' The half of its trigger that puts a card in your graveyard is the overlooked part, and Dimir has strong tools for recasting instants from there.",
 sections:{
  headline:'Nymris throws away a card every turn. Make that card matter.',
  diagnosis:"Nymris, Oona's Trickster triggers when you cast your first spell during each opponent's turn: look at the top two cards, keep one, and put the other into your graveyard. Most builds treat that graveyard card as the cost. In a deck full of good instants, it's a second hand. Every time Nymris bins a removal or draw spell, you can plan to cast it again.",
  prescription:"Pack cheap instants and flash creatures that start the trigger, then add recursion that cares about instants in the graveyard. Snapcaster Mage gives one flashback for its mana cost. Mission Briefing surveils two more cards, then lets you cast an instant or sorcery from your graveyard this turn. Torrential Gearhulk casts an instant from your graveyard for free. Think Twice has flashback on its own. Brazen Borrower and Faerie Mastermind are cheap flash spells for any turn, and Notion Thief punishes extra draws.",
  earlyGame:"Hold up mana on opponents' turns from the start. Faerie Mastermind, Petty Theft and Think Twice are cheap ways to cast a first spell during each opponent's turn. Nymris costs five, so spend your own turns on land drops and mana rocks rather than tapping out.",
  midGame:"Flash Nymris in at the end of an opponent's turn, then make sure you have a spell for each opponent's turn after that. When the trigger shows two good cards, keep the one you need now and bin the instant you want to recast later with Snapcaster Mage or Mission Briefing.",
  lateGame:"Torrential Gearhulk is the payoff: a 5/6 flash body that recasts your best binned instant for free. Notion Thief turns opponents' extra draws into yours. With three opponents, Nymris can trigger once on each of their turns, so every trip around the table adds cards to both your hand and your graveyard.",
  risks:"Graveyard exile effects shut off the recursion half of the plan. Nymris is a 1/6 flyer with no protection of its own, and the deck does little if you tap out on your own turn. Only your first spell during each opponent's turn triggers Nymris, so casting a second spell that turn doesn't trigger it again.",
  verdict:"Same colors and flash plan as the usual Nymris deck, but with a reason to love the graveyard half of the trigger. It plays like a control deck that rarely runs out of answers. Promising, untested, and worth trying if you enjoy instant-speed decisions."
 },
 synergies:[
  {name:'Snapcaster Mage',url:sf('inr',478,'snapcaster-mage'),why:"Cast it as your first spell on an opponent's turn: Nymris's trigger resolves first and bins a card, then Snapcaster can give that instant flashback."},
  {name:'Mission Briefing',url:sf('mkc',110,'mission-briefing'),why:"Two blue mana at instant speed. It triggers Nymris, surveils two more cards, then lets you cast an instant or sorcery from your graveyard this turn."},
  {name:'Torrential Gearhulk',url:sf('cmm',128,'torrential-gearhulk'),why:"A flash finisher that casts an instant from your graveyard without paying its mana cost when it enters. Nymris keeps that graveyard stocked."},
  {name:'Think Twice',url:sf('msc',787,'think-twice'),why:"A two-mana instant that starts the Nymris trigger. If Nymris bins it instead, it still has flashback for another card later."},
  {name:'Brazen Borrower',url:sf('soc',190,'brazen-borrower-petty-theft'),why:"Petty Theft is a two-mana instant that triggers Nymris and bounces a threat; the Borrower can later be cast from exile as a flash flyer."},
  {name:'Faerie Mastermind',url:sf('soc',114,'faerie-mastermind'),why:"A two-mana flash flyer that triggers Nymris on an opponent's turn and draws you a card whenever an opponent draws their second card in a turn."},
  {name:'Notion Thief',url:sf('znc',96,'notion-thief'),why:"A flash spell for your Nymris trigger that also replaces opponents' extra draws (beyond their first in each draw step) with draws for you."}
 ],
 methodology:'Editorial backfill prepared November 21, 2026 for the November 6 issue, which the automated publisher did not release. Commander candidates were taken from the same Scryfall search the publisher uses for that date. Every card was checked against Scryfall (Oracle text, color identity and Commander legality). Strategy interactions are editorial hypotheses, not playtested or judge-certified.',
 status:'AI-assisted source-checked editorial backfill; not independently playtested'
};

const GROTHAMA={
 version:2,date:'2026-11-13',createdAt:'2026-11-22T03:30:00.000Z',
 commander:{name:'Grothama, All-Devouring',identity:['G'],
  oracle:"Other creatures have \"Whenever this creature attacks, you may have it fight Grothama, All-Devouring.\" When Grothama leaves the battlefield, each player draws cards equal to the amount of damage dealt to Grothama this turn by sources they controlled.",
  scryfall:sf('bbd',71,'grothama-all-devouring'),edhrecCardUseRank:7021,
  imageUrl:'https://cards.scryfall.io/normal/front/a/b/ab8935b1-ec87-4330-9952-9ef8cd344531.jpg?1783934853'},
 theme:'Fight Club Card Draw',
 usualBuild:'Approximate: Mono-green big-creature stompy',
 hook:"Grothama invites every attacker to fight it, then pays out cards for the damage. Make sure your creatures land the biggest hits, and choose when it leaves.",
 selectionReason:"Grothama usually gets built as a giant stompy wurm. Its real hook is political: every attack becomes an optional fight, and whoever hit it hardest draws the most. A deck that controls when it leaves wins that bargain.",
 sections:{
  headline:'Let everyone fight the wurm. Just make sure you hit it hardest.',
  diagnosis:"Grothama, All-Devouring is a 10/8 for five that gives every other creature an optional fight whenever it attacks. When Grothama leaves the battlefield, each player draws cards equal to the damage their sources dealt to it that turn. Most decks treat it as a big body. The real engine is choosing when it leaves, right after your own huge creatures have fought it.",
  prescription:"Fill the deck with creatures that hit for 8 or more, so one fight is enough to destroy Grothama and cash out. Ghalta, Primal Hunger gets cheap with a 10-power Grothama on the board. Then add ways to remove Grothama yourself after the fights: Greater Good draws ten more when you sacrifice it, while Natural Order and Eldritch Evolution sacrifice it to fetch a creature. Heroic Intervention protects the board, and Garruk's Uprising and Craterhoof Behemoth reward big creatures.",
  earlyGame:"Ramp toward five mana and Grothama, and keep Heroic Intervention ready once it lands. Don't send small creatures into Grothama fights: it deals 10 damage back and they gain you very few cards.",
  midGame:"Once Grothama is out, opponents decide whether their attackers fight it, and every point they deal is a card they draw later. Make sure it leaves on your turn, after your big creatures have fought it. Ghalta, Primal Hunger costs just two green mana with Grothama's 10 power on your side.",
  lateGame:"Attack with your big creatures and have them fight Grothama. If a fight leaves it alive, sacrifice it to Greater Good: its leave trigger pays you for the fight damage, and Greater Good draws ten more for its power. Garruk's Uprising gives your attackers trample, and Craterhoof Behemoth turns a full hand and full board into a finish.",
  risks:"Fights are optional for opponents, and their damage turns into their cards, so a table of big attackers can out-draw you. Grothama deals 10 damage back in every fight, which kills most creatures. Greater Good makes you discard three after drawing. Mono-green has few answers to flyers and spells, so the extra cards need to turn into a fast win.",
  verdict:"A slower, sneakier Grothama than the usual stompy pile. Controlling when the wurm leaves turns its group-hug text into a mostly one-sided card engine. Unproven and a little swingy, but far more interesting than another big green beater."
 },
 synergies:[
  {name:'Greater Good',url:sf('msc',174,'greater-good'),why:"Sacrifice Grothama after your fights. Its leave trigger pays you for the damage, and Greater Good draws ten more for its 10 power before you discard three."},
  {name:'Natural Order',url:sf('ema',177,'natural-order'),why:"Grothama is a green creature, so you can sacrifice it as the cost after combat, collect the fight cards, and put a different green creature onto the battlefield."},
  {name:'Eldritch Evolution',url:sf('inr',195,'eldritch-evolution'),why:"Sacrifice Grothama after the fights to draw your cards, then search for a creature with mana value 7 or less and put it onto the battlefield."},
  {name:'Ghalta, Primal Hunger',url:sf('fdn',222,'ghalta-primal-hunger'),why:"Costs {X} less for your creatures' total power, so Grothama's 10 power brings it down to two green mana. A 12/12 survives Grothama's 10 damage and destroys it in one fight."},
  {name:"Garruk's Uprising",url:sf('ecc',109,'garruks-uprising'),why:"This deck's creatures have 4 or more power, so it draws a card as each one enters and gives your whole team trample."},
  {name:'Heroic Intervention',url:sf('trc',465,'heroic-intervention'),why:"Grothama is an obvious removal target. Giving your permanents hexproof and indestructible in response keeps the engine leaving on your terms."},
  {name:'Craterhoof Behemoth',url:sf('tdm',138,'craterhoof-behemoth'),why:"Once Grothama has filled your hand and board, Craterhoof gives your team trample and a big pump for a one-turn finish."}
 ],
 methodology:'Editorial backfill prepared November 21, 2026 for the November 13 issue, which the automated publisher did not release. Commander candidates were taken from the same Scryfall search the publisher uses for that date. Every card was checked against Scryfall (Oracle text, color identity and Commander legality). Strategy interactions are editorial hypotheses, not playtested or judge-certified.',
 status:'AI-assisted source-checked editorial backfill; not independently playtested'
};

export const EDITORIAL_EDITIONS=Object.freeze([ABIGALE,KRUPHIX,GROTHAMA,NYMRIS]);
