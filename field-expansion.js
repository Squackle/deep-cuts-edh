import {initEvidenceBoard,alignEvidenceCase} from "./field-evidence-ui.js";
import {initCollection,loadCollection,loadAvailableDecks} from "./field-collection-ui.js";
import {initComparison} from "./field-compare-ui.js";
import {loadReputation,attachProfileReputation} from "./field-reputation-ui.js";
import {initDispatches,loadDispatches,refreshDispatchBadge} from "./field-dispatch-ui.js";
export {attachProfileReputation,refreshDispatchBadge};
export function setupFieldExpansion(){
 initEvidenceBoard();initCollection();initComparison();initDispatches();
}
export function refreshFieldExpansion(tab){
 if(tab==="evidence")alignEvidenceCase();
 if(tab==="collection"){loadAvailableDecks();loadCollection()}
 if(tab==="compare")loadAvailableDecks();
 if(tab==="reputation")loadReputation();
 if(tab==="dispatches")loadDispatches();
}
