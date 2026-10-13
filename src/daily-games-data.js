/* Deep Cuts EDH daily puzzle library.
 * EDHREC commander-deck counts manually checked 2026-10-13.
 * Editorial clues are original paraphrases of card mechanics, not Oracle text.
 * All comparisons use THIS immutable snapshot, never live mixed timestamps.
 */
export const SNAPSHOT_DATE="2026-10-13";
export const COMMANDERS=[
{name:"Chainer, Dementia Master",decks:1975,colors:"Black",year:2002,theme:"Graveyard recursion",hook:"Pays life to return creatures from any graveyard as Nightmares.",last:"The Torment-era nightmare master has a weakness involving losing Nightmares."},
{name:"Commander Mustard",decks:3719,colors:"Red and white",year:2024,theme:"Soldier typal aggro",hook:"Turns a squad of Soldiers into faster, harder-hitting attackers.",last:"This commanding officer comes from the Clue crossover."},
{name:"Alena, Kessig Trapper",decks:18,colors:"Red",year:2020,theme:"Creature-power mana ramp",hook:"Taps to make red mana based on the greatest creature power you control.",last:"A human scout with partner, first seen in Commander Legends."},
{name:"Gilanra, Caller of Wirewood",decks:17,colors:"Green",year:2020,theme:"Big-spell mana ramp",hook:"Taps for mana and rewards the casting of costly spells with card draw.",last:"An elf druid with partner from Commander Legends."},
{name:"Kangee, Aerie Keeper",decks:514,colors:"White and blue",year:2000,theme:"Bird typal counters",hook:"Enters with feather counters, making your Birds grow stronger.",last:"The bird lord is among the legendary creatures of Invasion."},
{name:"Ertai, Wizard Adept",decks:147,colors:"Blue",year:1997,theme:"Repeatable counterspells",hook:"An activated ability can counter a spell if this wizard stays untapped.",last:"A blue wizard from Tempest, long before his other versions."},
{name:"Zirilan of the Claw",decks:911,colors:"Red",year:1996,theme:"Dragon toolbox",hook:"Fetches a Dragon straight from your deck for a temporary assault.",last:"This Mirage-era Viashino recruits Dragons on demand."},
{name:"Lovisa Coldeyes",decks:847,colors:"Red",year:2006,theme:"Barbarian and Warrior typal",hook:"Gives several aggressive warrior-type creature families a boost.",last:"The Coldsnap legendary Human boosts Barbarians, Warriors, and Berserkers."},
{name:"Rubinia Soulsinger",decks:1102,colors:"Green, white and blue",year:1994,theme:"Creature theft",hook:"Can borrow an opposing creature for as long as she stays tapped.",last:"This Legends-era Faerie has a distinctive tap-to-steal ability."},
{name:"Treva, the Renewer",decks:457,colors:"Green, white and blue",year:2000,theme:"Dragon lifegain",hook:"Combat damage lets you choose a color and gain life for permanents of that color.",last:"One of the five allied-color legendary Dragons from Invasion."},
{name:"Volrath the Fallen",decks:811,colors:"Black",year:2000,theme:"Discard-fueled Voltron",hook:"Discarding a creature pumps this attacker according to that card's mana value.",last:"This Nemesis-era shapeshifter villain grows by pitching massive creatures."},
{name:"Intet, the Dreamer",decks:1109,colors:"Green, blue and red",year:2007,theme:"Topdeck casting",hook:"Combat damage can exile a card from the top of your deck for later free casting.",last:"One of the three-color legendary Dragons from Planar Chaos."},
{name:"Experiment Kraj",decks:1524,colors:"Green and blue",year:2006,theme:"+1/+1 counters and activated abilities",hook:"Borrows activated abilities from creatures with +1/+1 counters.",last:"A Dissension-era Ooze that treats other creatures' buttons as its own."},
{name:"Brion Stoutarm",decks:3912,colors:"Red and white",year:2007,theme:"Fling and lifegain",hook:"Sacrifices another creature to deal damage equal to its power.",last:"This Lorwyn giant has lifelink and loves a good fling."},
{name:"Braids, Conjurer Adept",decks:4905,colors:"Blue",year:2007,theme:"Group hug and big permanents",hook:"Gives each player a chance to place a permanent onto the battlefield for free.",last:"A blue alternate-reality Braids from Planar Chaos."},
{name:"Mishra, Artificer Prodigy",decks:1032,colors:"Blue, black and red",year:2006,theme:"Artifact combo",hook:"Searches for a matching artifact when you cast one, tricky in singleton.",last:"The Grixis brother from Time Spiral often exploits counterspell interactions."},
{name:"Sek'Kuar, Deathkeeper",decks:1852,colors:"Black, red and green",year:2006,theme:"Aristocrats and Graveborn tokens",hook:"Nontoken creature deaths create hasty Graveborn creature tokens.",last:"This Coldsnap Orc shaman commands the dead in Jund colors."},
{name:"Feldon of the Third Path",decks:2310,colors:"Red",year:2014,theme:"Artifact creature reanimation",hook:"Makes temporary artifact token copies of creatures from your graveyard.",last:"A mono-red artificer from Commander 2014 named for an emotional reunion."},
{name:"Skeleton Ship",decks:1157,colors:"Blue and black",year:1995,theme:"-1/-1 counters",hook:"A peculiar vehicle-like undead creature can put weakening counters on targets.",last:"An Ice Age skeleton ship that famously cares whether you control an Island."},
{name:"Daxos the Returned",decks:2126,colors:"White and black",year:2015,theme:"Enchantment experience counters",hook:"Casting enchantments builds experience and powers enchantment-creature tokens.",last:"An Orzhov legendary from Commander 2015 who returned from the underworld."},
{name:"Doran, the Siege Tower",decks:4777,colors:"White, black and green",year:2007,theme:"Toughness-matters combat",hook:"Creatures assign combat damage using toughness instead of power.",last:"The famous Lorwyn Treefolk makes walls surprisingly threatening."},
{name:"Hapatra, Vizier of Poisons",decks:6082,colors:"Black and green",year:2017,theme:"-1/-1 counters and Snakes",hook:"Placing -1/-1 counters can create poisonous little Snake tokens.",last:"Amonkhet's green-black vizier leads a nest of deathtouch Snakes."},
{name:"Ezuri, Renegade Leader",decks:2829,colors:"Green",year:2010,theme:"Elf typal overrun",hook:"Protects Elves and can repeatedly boost and trample a whole elf army.",last:"Scars of Mirrodin's rebel Elf leader."},
{name:"Zedruu the Greathearted",decks:12607,colors:"Blue, red and white",year:2011,theme:"Donation and group hug",hook:"Gives away permanents and gains life and cards for permanents you own but other players control.",last:"This goat-like Minotaur Monk rewards giving gifts that may be unwanted."},
{name:"Arcades, the Strategist",decks:23323,colors:"Green, white and blue",year:2018,theme:"Defender creatures",hook:"Turns creatures with defender into toughness-based attackers and card draw.",last:"A legendary Elder Dragon who makes Walls into the win condition."},
{name:"Krenko, Mob Boss",decks:44506,colors:"Red",year:2012,theme:"Goblin swarming",hook:"Can multiply a Goblin army by tapping to create more Goblin tokens.",last:"This Magic 2013 Goblin crime boss is famous for explosive token growth."},
{name:"Edgar Markov",decks:51731,colors:"White, black and red",year:2017,theme:"Vampire eminence",hook:"Creates extra Vampires even while waiting in the command zone.",last:"The 2017 Vampire patriarch possesses a notorious Eminence ability."},
{name:"The Ur-Dragon",decks:51327,colors:"White, blue, black, red and green",year:2017,theme:"Five-color Dragons",hook:"Reduces Dragon costs from the command zone and attacks with huge flying threats.",last:"This avatar of Dragonkind came in Commander 2017."},
{name:"Atraxa, Praetors' Voice",decks:45537,colors:"White, blue, black and green",year:2016,theme:"Proliferate counters",hook:"Proliferates at the end of your turn and sports a daunting collection of keywords.",last:"This four-color angelic Phyrexian originated in Commander 2016."},
{name:"Kaalia of the Vast",decks:40265,colors:"White, black and red",year:2011,theme:"Angels, Demons and Dragons",hook:"When attacking, can drop an Angel, Demon, or Dragon directly into combat.",last:"One of the original Commander 2011 generals, infamous for giant surprise attackers."}
];
export const COLD_POOL=COMMANDERS.map(x=>x.name);
export function hashSeed(input){
 let h=2166136261;
 for(let i=0;i<input.length;i++){h=Math.imul(h^input.charCodeAt(i),16777619)}
 return h>>>0;
}
export function shuffle(arr,seed){
 const x=[...arr];let a=seed>>>0;
 for(let i=x.length-1;i>0;i--){
  a=(Math.imul(a,1664525)+1013904223)>>>0;
  const j=a%(i+1);
  [x[i],x[j]]=[x[j],x[i]];
 }
 return x;
}
export function dayIndex(day){
 const ordinal=Math.floor(Date.parse(day+"T00:00:00Z")/86400000);
 // Every entry appears once before repeating; index driven by the date, not a
 // public sequential counter or secret depending on logged-in state.
 return (((ordinal+997)%COMMANDERS.length)+COMMANDERS.length)%COMMANDERS.length;
}
export function coldCase(day,mode="daily",seed=0){
 const base=mode==="daily"?dayIndex(day):hashSeed("cold-practice-"+seed)%COMMANDERS.length;
 const answer=COMMANDERS[base];
 const others=shuffle(COMMANDERS.filter(x=>x.name!==answer.name),hashSeed(day+"-suspects-"+base+"-"+seed)).slice(0,11);
 const choices=shuffle([answer,...others],hashSeed("choices-"+day+"-"+base+"-"+seed)).map(x=>x.name);
 const clues=[
  {label:"EVIDENCE 01 · COLOR IDENTITY",text:"The suspect's color identity is "+answer.colors+"."},
  {label:"EVIDENCE 02 · FIRST APPEARANCE",text:"First printed around "+answer.year+"."},
  {label:"EVIDENCE 03 · DECK ARCHETYPE",text:"Investigators typically build around "+answer.theme.toLowerCase()+"."},
  {label:"EVIDENCE 04 · ABILITY",text:answer.hook},
  {label:"EVIDENCE 05 · FINAL LEAD",text:answer.last}
 ];
 return {answer,choices,clues};
}
export function obscurityLadder(day,mode="daily",seed=0){
 const key=mode==="daily"?day:day+"-"+seed;
 // Thirty curated options, selected across several popularity bands to make
 // each daily ordering interesting, rather than sampling five near-identical ranks.
 const sorted=[...COMMANDERS].sort((a,b)=>a.decks-b.decks);
 const pools=[sorted.slice(0,6),sorted.slice(6,12),sorted.slice(12,18),sorted.slice(18,24),sorted.slice(24)];
 const entries=pools.map((pool,i)=>pool[hashSeed("ladder-"+key+"-"+i)%pool.length]);
 return {entries:shuffle(entries,hashSeed("shuffle-ladder-"+key)),solution:[...entries].sort((a,b)=>a.decks-b.decks)};
}
export function todayChicago(now=new Date()){
 const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/Chicago",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now);
 const get=k=>parts.find(x=>x.type===k)?.value||"";
 return get("year")+"-"+get("month")+"-"+get("day");
}
export function previousDay(day){
 return new Date(Date.parse(day+"T00:00:00Z")-86400000).toISOString().slice(0,10);
}
