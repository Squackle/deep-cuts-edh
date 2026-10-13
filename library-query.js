/** Card Library Scryfall query assembly; currency is parsed in integer cents. */
export function dollarCents(input){
 const raw=String(input??"").trim();
 if(!raw)return null;
 const amount=raw.replace(/^\$\s*/,"");
 if(!/^(?:\d{1,6}(?:\.\d{1,2})?|\.\d{1,2})$/.test(amount))
  throw new Error("Use a USD price such as 0.50, .50, $1.25 or 20 (up to two decimals).");
 const [whole,fraction=""]=amount.split(".");
 const cents=Number(whole||0)*100+Number(fraction.padEnd(2,"0"));
 if(!Number.isSafeInteger(cents)||cents<0||cents>10000000)
  throw new Error("Price must be between $0.00 and $100,000.00.");
 return cents;
}
export function manaLimit(input){
 const raw=String(input??"").trim();
 if(!raw)return null;
 if(!/^\d{1,2}$/.test(raw)||Number(raw)>99)
  throw new Error("Maximum mana value must be a whole number from 0 to 99.");
 return Number(raw);
}
export function compileLibraryQuery({search="",format="commander",facetTerms=[],faceted=false,maxMana="",minPrice="",maxPrice=""}={}){
 const terms=[],raw=String(search).trim();
 if(raw)terms.push(raw);
 if(format)terms.push("f:"+format);
 terms.push(...facetTerms);
 const mv=manaLimit(maxMana);
 if(mv!==null)terms.push("mv<="+mv);
 const min=dollarCents(minPrice),max=dollarCents(maxPrice);
 if(min!==null&&max!==null&&min>max)
  throw new Error("The minimum price cannot exceed the maximum price.");
 if(min!==null)terms.push("usd>="+(min/100).toFixed(2));
 if(max!==null)terms.push("usd<="+(max/100).toFixed(2));
 if(!raw&&!faceted&&mv===null&&min===null&&max===null)terms.push("t:legendary");
 return terms.join(" ");
}
