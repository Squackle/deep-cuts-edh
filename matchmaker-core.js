/* Deep Cuts Matchmaker — an editorial starting pool, NOT a popularity ranking.
 * Exact printings, current commander legality, colors and optional prices are
 * checked against Scryfall via /api/tool-cards before anything is recommended.
 */
export const IDEAS=[
 ["Toshiro Umezawa","spells","Mono-black reactive spells","Turn opposing creatures dying into opportunities to cast instants from your graveyard."],
 ["Rionya, Fire Dancer","copy","Big combat with temporary copies","Build around spells and powerful creature abilities, then copy a creature when you attack."],
 ["Tameshi, Reality Architect","artifacts","Artifacts and enchantments from the graveyard","Exchange lands and cards for recurring artifact and enchantment value."],
 ["The Council of Four","politics","Political card draw and tokens","Benefit when opponents draw extra cards or cast multiple spells in a turn."],
 ["Gretchen Titchwillow","ramp","Patient land-based value","Convert excess mana into cards and extra land drops."],
 ["Ghen, Arcanum Weaver","enchantments","Enchantments with a graveyard twist","Trade one enchantment for another from the graveyard."],
 ["Sefris of the Hidden Ways","graveyard","Dungeons and reanimation","Use creature cards moving to the graveyard to advance through dungeons."],
 ["Kros, Defense Contractor","politics","Counters and table manipulation","Place counters on opponents' creatures to encourage attacks elsewhere."],
 ["Mazirek, Kraul Death Priest","sacrifice","Sacrifice-fueled +1/+1 counters","Grow your team whenever a player sacrifices a permanent."],
 ["Ovika, Enigma Goliath","tokens","Noncreature spells into Goblin armies","Cast noncreature spells to build a fast-growing Goblin board."],
 ["Grismold, the Dreadsower","tokens","Shared creature tokens and sacrifice","Give everyone tokens, then profit when creatures die."],
 ["Kaza, Roil Chaser","spells","Wizards casting bigger spells","Use Wizards to reduce the cost of powerful instants and sorceries."],
 ["Kitt Kanto, Mayhem Diva","politics","Creature tokens and goad","Tap your creatures to redirect combat and control opponents' attacks."],
 ["Jaxis, the Troublemaker","copy","Temporary copies and death value","Copy useful creatures for enter-the-battlefield effects and extra cards."],
 ["Kambal, Consul of Allocation","control","Taxing opposing noncreature spells","Drain life when opponents cast noncreature spells."],
 ["Syr Konrad, the Grim","graveyard","Graveyard movement and life loss","Turn milling, discarding, and creature deaths into damage."],
 ["Obeka, Brute Chronologist","control","End-the-turn tricks","Explore the unusual timing opportunities of ending a turn."],
 ["Yurlok of Scorch Thrash","ramp","Dangerous shared mana","Give everyone mana and make unused mana a political weapon."],
 ["Kwain, Itinerant Meddler","politics","Group hug and card draw","Give the table cards and life while choosing what to do with the goodwill."],
 ["Saryth, the Viper's Fang","combat","Deathtouch and untapping","Manipulate tapping to protect attackers and threaten efficient blocks."],
 ["Arjun, the Shifting Flame","spells","Wheels and hand cycling","Change your hand whenever you cast a spell to dig for new options."],
 ["Doran, the Siege Tower","combat","Toughness-based creatures","Attack using creatures whose toughness is much higher than their power."],
 ["Hanna, Ship's Navigator","artifacts","Recurring artifacts and enchantments","Return useful artifacts and enchantments from your graveyard to hand."],
 ["Marisi, Breaker of the Coil","combat","Force opponents into combat","Connect in combat to goad enemy creatures and influence the table."],
 ["Brudiclad, Telchor Engineer","tokens","One type of token becomes an army","Transform all your tokens into copies of your strongest token."],
 ["Svella, Ice Shaper","ramp","Snow artifacts and large spells","Make mana-producing artifacts and use them to cast expensive cards."],
 ["Shirei, Shizo's Caretaker","graveyard","Tiny creatures with repeatable value","Recycle one-power creatures that die under your control."],
 ["Sevinne, the Chronoclasm","spells","Flashback and spell copying","Build around casting spells from the graveyard for additional value."],
 ["Ruxa, Patient Professor","combat","Creatures without abilities","Reward vanilla creatures with bigger attacks and resilience."],
 ["Alandra, Sky Dreamer","tokens","Draw cards and make Drakes","Make flying tokens from card draw, then turn big draws into a stronger attack."]
].map(([name,theme,playstyle,why])=>Object.freeze({name,theme,playstyle,why}));
export const THEMES=Object.freeze({
 any:"Any strategy",spells:"Spellslinger",copy:"Copies and tricks",
 artifacts:"Artifacts",enchantments:"Enchantments",graveyard:"Graveyards",
 politics:"Politics and table talk",ramp:"Ramp and big mana",
 tokens:"Creature tokens",sacrifice:"Sacrifice",control:"Control",
 combat:"Combat"
});
export const COLORS=Object.freeze({any:"Any colors",W:"White",U:"Blue",B:"Black",R:"Red",G:"Green",mono:"Exactly one color",multi:"Multiple colors"});
export function validCandidate(card){
 const type=String(card?.type_line||"");
 const text=String(card?.oracle_text||"");
 return typeof card?.name==="string"&&card.legalities?.commander==="legal"&&
  ((/Legendary/i.test(type)&&/Creature/i.test(type))||
   /can be your commander/i.test(text));
}
export function sameName(a,b){
 return String(a||"").normalize("NFKC").toLowerCase()===String(b||"").normalize("NFKC").toLowerCase();
}
function stableNoise(seed,name){
 let n=(Number(seed)||1)>>>0;
 for(const c of name){n=Math.imul(n^c.charCodeAt(0),16777619)>>>0}
 return (n%1009)/1009;
}
export function selectIdeas(verified,preferences={},seed=99,limit=5){
 const theme=Object.hasOwn(THEMES,preferences.theme)?preferences.theme:"any";
 const color=Object.hasOwn(COLORS,preferences.color)?preferences.color:"any";
 const max=preferences.max==="5"?5:preferences.max==="15"?15:null;
 const picks=[];
 for(const idea of IDEAS){
  const card=verified.find(c=>sameName(c.name,idea.name));
  if(!card||!validCandidate(card))continue;
  const identity=Array.isArray(card.color_identity)?card.color_identity:[];
  if(color==="mono"&&identity.length!==1)continue;
  if(color==="multi"&&identity.length<2)continue;
  if(["W","U","B","R","G"].includes(color)&&!identity.includes(color))continue;
  const value=Number(card.prices?.usd);
  if(max!==null&&(card.prices?.usd==null||!Number.isFinite(value)||value>max))continue;
  const preferred=theme==="any"||idea.theme===theme;
  const score=(preferred?100:0)+stableNoise(seed,idea.name)*14;
  picks.push({...idea,card,score,matchedTheme:preferred});
 }
 picks.sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name));
 // Encourage a variety of archetypes rather than five slight variants.
 const selected=[],themeCounts=new Map();
 for(const p of picks){if((themeCounts.get(p.theme)||0)>=2)continue;
  selected.push(p);themeCounts.set(p.theme,(themeCounts.get(p.theme)||0)+1);if(selected.length>=limit)break;
 }
 return selected;
}
