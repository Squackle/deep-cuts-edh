/* Hand-curated puzzles; no unverified AI word lists or overlapping card categories.
   Daily puzzles are also frozen in D1 the first time they are generated. */
// Official creature subtypes only (Comprehensive Rules 205.3m, June 2026).
// Archived five-letter pool for puzzles saved before October 15, 2026.
// https://media.wizards.com/2026/downloads/MagicCompRules%2020260619.pdf
export const CIPHER_WORDS=[["ALIEN","A creature type for beings from other worlds and beyond familiar fantasy."],["ANGEL","A celestial creature type often associated with flying and white mana."],["BEAST","A creature type covering many powerful wild animals and monsters."],["BISON","A herd animal creature type used on some large grazing creatures."],["CAMEL","A desert-dwelling animal creature type."],["CHILD","A creature type for younger characters, distinct from the Human type."],["CLOWN","A performer-themed creature type introduced in Unfinity."],["DALEK","An armored science-fiction creature type from Doctor Who."],["DEMON","A creature type often associated with powerful black creatures and steep bargains."],["DEVIL","A creature type often associated with red mana and chaotic damage."],["DJINN","A supernatural creature type often seen on blue flying creatures."],["DRAKE","A smaller dragonlike creature type that commonly has flying."],["DRONE","A creature type often associated with Eldrazi and other mechanical servants."],["DRUID","A creature type frequently associated with mana-producing abilities."],["DRYAD","A nature-spirit creature type often connected to forests and lands."],["DWARF","A humanoid creature type with a history of crafting and combat."],["ELDER","A creature type used for especially ancient or powerful beings."],["GAMER","A player-inspired creature type used in unusual Magic settings."],["GIANT","A creature type whose members often have considerable power and toughness."],["GNOLL","A hyena-like humanoid creature type seen in Dungeons & Dragons crossover cards."],["GNOME","A small humanoid creature type sometimes appearing on artifact creatures."],["GOLEM","An often-artifact creature type representing animated constructs."],["GUEST","A creature type associated with visitors in unusual Magic settings."],["HARPY","A winged creature type often associated with black mana."],["HIPPO","A large river-dwelling animal creature type."],["HORSE","An animal creature type commonly associated with mounts."],["HUMAN","One of Magic's most common humanoid creature types."],["HYDRA","A many-headed creature type often featuring +1/+1 counters."],["HYENA","An animal creature type inspired by scavenging pack hunters."],["KIRIN","A mystical East Asian creature type seen in Kamigawa."],["LAMIA","A mythological serpentlike creature type."],["LEMUR","A small primate creature type found on a few Magic cards."],["LICID","A creature type that can transform into an Aura-like enchantment."],["LLAMA","A woolly pack-animal creature type."],["MOUNT","A creature type associated with the saddle mechanic."],["MOUSE","A small animal creature type found among Bloomburrow's inhabitants."],["NINJA","A creature type associated with ninjutsu and evasive combat."],["NOBLE","A creature type for aristocrats and members of ruling families."],["NOMAD","A wandering traveler creature type."],["NYMPH","A nature-spirit creature type that appears on Theros cards."],["OTTER","An aquatic mammal creature type that often supports spellslinger themes."],["OUPHE","A mischievous small-fey creature type with famous artifact-hating members."],["PILOT","A creature type associated with operating Vehicles."],["PLANT","A creature type used for animated vegetation."],["REBEL","A creature type known for cards that can search out allied Rebels."],["RHINO","A large horned animal creature type."],["ROBOT","A mechanical creature type, often represented by artifacts."],["ROGUE","A creature type associated with theft, stealth, and evasive attacks."],["SABLE","An animal creature type for small fur-bearing mammals."],["SATYR","A mythological goatlike humanoid creature type, often red or green."],["SCION","A creature type associated with Eldrazi servants and mana-producing tokens."],["SCOUT","A creature type for explorers, trackers, and pathfinders."],["SHADE","A creature type often associated with black-mana power boosts."],["SHARK","An aquatic predator creature type."],["SHEEP","A woolly animal creature type."],["SIREN","A mythological creature type associated with alluring songs and deception."],["SKUNK","A small mammal creature type featured in newer Magic settings."],["SLITH","A creature type whose members are known for growing through combat damage."],["SLOTH","A slow-moving animal creature type."],["SNAIL","A shell-bearing animal creature type."],["SNAKE","A reptilian creature type with poison and deathtouch synergies."],["SPAWN","A creature type associated with Eldrazi offspring and mana tokens."],["SPIKE","A creature type known for moving +1/+1 counters between creatures."],["SQUID","An aquatic creature type with tentacles."],["SYNTH","A creature type for artificial humanoids from Fallout."],["TROLL","A creature type often associated with regeneration and resilience."],["WEIRD","An elemental creature type associated with Izzet magical experiments."],["WHALE","A large aquatic mammal creature type."]];
// Full official creature subtype catalog from Comprehensive Rules 205.3m.
// Includes Time Lord (two words), Assembly-Worker (hyphen), C’tan and Shi’ar.
// The original five-letter editions remain unchanged for frozen older puzzles.
// https://www.mtgtools.io/rules/205
export const CIPHER_TYPES = ["TIME LORD","ADVISOR","AETHERBORN","ALIEN","ALLY","ANGEL","ANTELOPE","APE","ARCHER","ARCHON","ARMADILLO","ARMY","ARTIFICER","ASSASSIN","ASSEMBLY-WORKER","ASTARTES","ATOG","AUROCHS","AVATAR","AZRA","BADGER","BALLOON","BARBARIAN","BARD","BASILISK","BAT","BEAR","BEAST","BEAVER","BEEBLE","BEHOLDER","BERSERKER","BIRD","BISON","BLINKMOTH","BOAR","BRINGER","BRUSHWAGG","CAMARID","CAMEL","CAPYBARA","CARIBOU","CARRIER","CAT","CENTAUR","CHILD","CHIMERA","CITIZEN","CLERIC","CLOWN","COCKATRICE","CONSTRUCT","COWARD","COYOTE","CRAB","CROCODILE","C’TAN","CUSTODES","CYBERMAN","CYCLOPS","DALEK","DAUTHI","DEMIGOD","DEMON","DESERTER","DETECTIVE","DEVIL","DINOSAUR","DJINN","DOCTOR","DOG","DRAGON","DRAKE","DREADNOUGHT","DRIX","DRONE","DRUID","DRYAD","DWARF","ECHIDNA","EFREET","EGG","ELDER","ELDRAZI","ELEMENTAL","ELEPHANT","ELF","ELK","EMPLOYEE","ETERNAL","EYE","FAERIE","FERRET","FISH","FLAGBEARER","FOX","FRACTAL","FROG","FUNGUS","GAMER","GAMMA","GARGOYLE","GERM","GIANT","GIRAFFE","GITH","GLIMMER","GNOLL","GNOME","GOAT","GOBLIN","GOD","GOLEM","GORGON","GRAVEBORN","GREMLIN","GRIFFIN","GUEST","HAG","HALFLING","HAMSTER","HARPY","HEDGEHOG","HELLION","HERO","HIPPO","HIPPOGRIFF","HOMARID","HOMUNCULUS","HORROR","HORSE","HUMAN","HYDRA","HYENA","ILLUSION","IMP","INCARNATION","INHUMAN","INKLING","INQUISITOR","INSECT","JACKAL","JELLYFISH","JUGGERNAUT","KANGAROO","KAVU","KIRIN","KITHKIN","KNIGHT","KOBOLD","KOR","KRAKEN","KREE","LLAMA","LAMIA","LAMMASU","LEECH","LEMUR","LEVIATHAN","LHURGOYF","LICID","LIZARD","LOBSTER","MANTICORE","MASTICORE","MERCENARY","MERFOLK","METATHRAN","MINION","MINOTAUR","MITE","MOLE","MONGER","MONGOOSE","MONK","MONKEY","MOOGLE","MOONFOLK","MOUNT","MOUSE","MUTANT","MYR","MYSTIC","NAUTILUS","NECRON","NEPHILIM","NIGHTMARE","NIGHTSTALKER","NINJA","NOBLE","NOGGLE","NOMAD","NYMPH","OCTOPUS","OGRE","OOZE","ORB","ORC","ORGG","OTTER","OUPHE","OX","OYSTER","PANGOLIN","PEASANT","PEGASUS","PENTAVITE","PERFORMER","PEST","PHELDDAGRIF","PHOENIX","PHYREXIAN","PILOT","PINCHER","PIRATE","PLANT","PLATYPUS","PORCUPINE","POSSUM","PRAETOR","PRIMARCH","PRISM","PROCESSOR","QU","RABBIT","RACCOON","RANGER","RAT","REBEL","REFLECTION","RHINO","RIGGER","ROBOT","ROGUE","SABLE","SALAMANDER","SAMURAI","SAND","SAPROLING","SATYR","SCARECROW","SCIENTIST","SCION","SCORPION","SCOUT","SCULPTURE","SEAL","SERF","SERPENT","SERVO","SHADE","SHAMAN","SHAPESHIFTER","SHARK","SHEEP","SHI’AR","SIREN","SKELETON","SKRULL","SKUNK","SLITH","SLIVER","SLOTH","SLUG","SNAIL","SNAKE","SOLDIER","SOLTARI","SORCERER","SPAWN","SPECTER","SPELLSHAPER","SPHINX","SPIDER","SPIKE","SPIRIT","SPLINTER","SPONGE","SPY","SQUID","SQUIRREL","STARFISH","SURRAKAR","SURVIVOR","SYMBIOTE","SYNTH","TENTACLE","TETRAVITE","THALAKOS","THOPTER","THRULL","TIEFLING","TOY","TREEFOLK","TRILOBITE","TRISKELAVITE","TROLL","TURTLE","TYRANID","UNICORN","UTROM","VAMPIRE","VARMINT","VEDALKEN","VILLAIN","VOLVER","WALL","WALRUS","WARLOCK","WARRIOR","WEASEL","WEIRD","WEREWOLF","WHALE","WIZARD","WOLF","WOLVERINE","WOMBAT","WORM","WRAITH","WURM","YETI","ZOMBIE","ZUBERA"].map(type=>[
 type,CIPHER_WORDS.find(entry=>entry[0]===type)?.[1]||
 "A recognized Magic: The Gathering creature subtype. Explore creatures of this type on Scryfall."
]);
export const cipherLetters=word=>String(word).toUpperCase().replace(/[^A-Z]/g,"");
export const cipherPattern=word=>String(word).toUpperCase().replace(/[A-Z]/g,"_");

export const BOARD_CATEGORIES=[["MANA ROCKS","Artifacts that help generate mana.",["Sol Ring","Arcane Signet","Fellwar Stone","Mind Stone"]],["BOARD WIPES","Spells that can clear many creatures at once.",["Wrath of God","Damnation","Blasphemous Act","Toxic Deluge"]],["SPOT REMOVAL","Spells that answer individual threats.",["Swords to Plowshares","Path to Exile","Beast Within","Generous Gift"]],["REANIMATION","Spells that bring creature cards back from the graveyard.",["Reanimate","Animate Dead","Victimize","Unburial Rites"]],["COUNTERMAGIC","Spells used to counter opposing spells.",["Counterspell","Mana Drain","Negate","Swan Song"]],["UTILITY LANDS","Popular multicolor-friendly lands in Commander.",["Command Tower","Exotic Orchard","Reflecting Pool","Path of Ancestry"]],["TREASURE MAKERS","Cards that generate Treasure tokens.",["Dockside Extortionist","Smothering Tithe","Big Score","Unexpected Windfall"]],["CARD DRAW ENGINES","Repeatable effects that supply extra cards.",["Rhystic Study","Mystic Remora","Phyrexian Arena","Guardian Project"]],["TOKEN DOUBLERS","Cards that increase how many tokens you make.",["Doubling Season","Anointed Procession","Parallel Lives","Mondrak, Glory Dominus"]],["EQUIPMENT","Artifacts that can be attached to creatures.",["Lightning Greaves","Swiftfoot Boots","Skullclamp","Sword of the Animist"]],["MANA CREATURES","Creatures commonly played to accelerate mana.",["Llanowar Elves","Elvish Mystic","Birds of Paradise","Fyndhorn Elves"]],["SACRIFICE OUTLETS","Cards that let you sacrifice permanents for value.",["Ashnod's Altar","Phyrexian Altar","Viscera Seer","Altar of Dementia"]],["EXTRA TURNS","Spells that grant another turn.",["Time Warp","Temporal Manipulation","Capture of Jingzhou","Expropriate"]],["PUMP EFFECTS","Spells that help creatures hit harder.",["Giant Growth","Overrun","Berserk","Unnatural Growth"]],["TUTORS","Spells that search a library for key cards.",["Demonic Tutor","Vampiric Tutor","Worldly Tutor","Enlightened Tutor"]],["LAND RAMP","Spells that find lands and put them onto the battlefield.",["Cultivate","Kodama's Reach","Nature's Lore","Three Visits"]]];
export function gameHash(str){let n=2166136261;for(const char of str)n=Math.imul(n^char.charCodeAt(0),16777619);return n>>>0;}
export function gameShuffle(values,seed){const a=[...values];let state=seed>>>0;for(let i=a.length-1;i>0;i--){state=(Math.imul(state,1664525)+1013904223)>>>0;const j=state%(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
export function chicagoDate(now=new Date()){const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/Chicago",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now);const get=k=>parts.find(p=>p.type===k)?.value||"";return get("year")+"-"+get("month")+"-"+get("day");}
export function buildArcanePuzzle(game,day,mode="daily",seed=0){
 const id=mode==="practice"?day+":practice:"+seed:day;
 if(game==="cipher"){
  const ordinal=Math.floor(Date.parse(day+"T00:00:00Z")/86400000);
  // Preserve the original published daily series and all D1-frozen answers.
  if(mode==="daily"&&day<"2026-10-15"){
   const [word,definition]=CIPHER_WORDS[ordinal%CIPHER_WORDS.length];
   return {word,definition,edition:"creature-types-v2"};
  }
  // A fixed permutation gives a fresh distinct type on consecutive days
  // until the complete catalog has been exhausted, then repeats the cycle.
  const catalog=gameShuffle(CIPHER_TYPES,gameHash("arcane-cipher-full-types-v3"));
  const index=mode==="daily"
   ?((ordinal-Math.floor(Date.parse("2026-10-15T00:00:00Z")/86400000))%catalog.length+catalog.length)%catalog.length
   :gameHash(id+":cipher:v3")%catalog.length;
  const [word,definition]=catalog[index];
  return {word,definition,edition:"creature-types-v3"};
 }
 // Conspiracy Board daily v2 begins October 22, 2026. Older daily editions
 // remain deterministic so existing historical snapshots/runs are replayable.
 // Partition 16 curated categories into 4 nonoverlapping days, reshuffle the
 // next cycle with a new seed, and avoid repeats across cycle boundaries.
 // This is deterministic for every visitor and never depends on their account.
 const BOARD_V2_START="2026-10-22";
 const legacyBoard=()=>gameShuffle(BOARD_CATEGORIES,gameHash(id+":board:groups")).slice(0,4);
 let chosen;
 if(mode==="daily"&&day>=BOARD_V2_START){
  const dayNumber=Math.floor(Date.parse(day+"T00:00:00Z")/86400000);
  const startNumber=Math.floor(Date.parse(BOARD_V2_START+"T00:00:00Z")/86400000);
  const index=dayNumber-startNumber,cycle=Math.floor(index/4),slot=index%4;
  let previousLast=null,categories=null;
  for(let i=0;i<=cycle;i++){
   categories=null;
   // Editorial seed 5 ensures today's first case is entirely new relative
   // to the already published original October 22 daily board.
   for(let attempt=i===0?5:0;attempt<256;attempt++){
    const next=gameShuffle(BOARD_CATEGORIES,gameHash("conspiracy-board-v2:cycle:"+i+":attempt:"+attempt));
    if(!previousLast||next.slice(0,4).every(g=>!previousLast.has(g[0]))){
     categories=next;break;
    }
   }
   if(!categories)throw Error("Could not build fresh category rotation");
   previousLast=new Set(categories.slice(12,16).map(g=>g[0]));
  }
  chosen=categories.slice(slot*4,slot*4+4);
 }else chosen=legacyBoard();
 return {groups:chosen.map(([title,description,cards])=>({title,description,cards})),
  tiles:gameShuffle(chosen.flatMap(g=>g[2]),gameHash(id+":board:tiles:"+(mode==="daily"&&day>=BOARD_V2_START?"v2":"v1"))),
  edition:mode==="daily"&&day>=BOARD_V2_START?"hand-curated-v2":"hand-curated-v1"};
}
export function cipherFeedback(guess,answer){
 const target=cipherLetters(answer),attempt=cipherLetters(guess);
 if(attempt.length!==target.length)throw new RangeError("Guess length does not match the cipher.");
 const result=Array(target.length).fill("absent"),remaining={};
 for(let i=0;i<target.length;i++){if(attempt[i]===target[i])result[i]="correct";else remaining[target[i]]=(remaining[target[i]]||0)+1;}
 for(let i=0;i<target.length;i++){if(result[i]==="correct")continue;if(remaining[attempt[i]]>0){result[i]="present";remaining[attempt[i]]--;}}
 return result;
}
export function boardMatch(puzzle,names){
 const target=new Set(names);
 return puzzle.groups.find(g=>g.cards.every(c=>target.has(c)))||null;
}
export function boardOneAway(puzzle,names,solved){
 const selected=new Set(names);
 return puzzle.groups.some(g=>!solved.includes(g.title)&&g.cards.filter(c=>selected.has(c)).length===3);
}
