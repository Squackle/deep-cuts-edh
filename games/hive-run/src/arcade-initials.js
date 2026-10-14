/** Arcade initials describe the run; the session cookie establishes identity. */
export const ARCADE_INITIALS_PATTERN=/^[A-Z0-9]{3}$/;
export function parseArcadeInitials(value){
 if(typeof value!=="string"||!/^[A-Z0-9]{3}$/i.test(value))return null;
 return value.toUpperCase();
}
export function editArcadeInitials(value){
 return String(value??"").replace(/[^A-Za-z0-9]/g,"").toUpperCase().slice(0,3);
}
